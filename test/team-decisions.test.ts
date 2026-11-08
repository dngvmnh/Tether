import { describe, expect, it, vi } from 'vitest';
import type { Claim, Operator } from '../src/contracts';
import { assessClaims } from '../src/engine/assess';
import { aggregate } from '../src/engine/aggregate';
import { compareConstraint } from '../src/engine/compare';
import { assembleReport } from '../src/engine/pipeline';
import { goldDecisions, goldScenarios } from '../eval/gold';
import { scoreScenario } from '../eval/score-scenario';

async function reportFor(id: string, mutate?: (claims: Claim[]) => void) {
  const scenario = goldScenarios().find((s) => s.id === id)!;
  const claims = structuredClone(scenario.claims);
  mutate?.(claims);
  const decisions = goldDecisions();
  const findings = await assessClaims({ claims, decisions });
  const report = assembleReport({ reportId: 'test-report', issueKey: scenario.ticket.issueKey,
    ticket: scenario.ticket, claims, decisions, findings, errors: [], spacesSearched: ['ENG'],
    decisionLabel: 'tether-decision', graph: { used: false, linkedPages: 0 },
    generatedAt: '2026-11-08T09:00:00.000Z', durationMs: 0, llmCalls: 0, models: [] });
  return { scenario, report };
}

describe('team-approved annotation and threshold semantics', () => {
  it.each([['S01', 'CONFLICT'], ['S02', 'INSUFFICIENT_EVIDENCE']])('keeps %s at honest 1/2 coverage without borrowing evidence from numeric policies', async (id, expected) => {
    const scenario = goldScenarios().find((s) => s.id === id)!;
    const compare = vi.fn();
    const findings = await assessClaims({ claims: scenario.claims, decisions: goldDecisions(), semantic: { compare } });
    const result = aggregate(scenario.claims, findings, []);
    expect(compare).not.toHaveBeenCalled();
    expect(result.overallOutcome).toBe(expected);
    expect(result.coverage).toMatchObject({ materialClaims: 2, checkedMaterialClaims: 1 });
    expect(findings[1]).toMatchObject({ outcome: 'INSUFFICIENT_EVIDENCE', reason: 'NO_DECISION_FOUND' });
  });

  it.each(['EQ', 'GTE'] as Operator[])('detects the production refund conflict for a required %s 50,000 threshold', async (operator) => {
    const claim = structuredClone(goldScenarios().find((s) => s.id === 'S12')!.claims[0]!);
    claim.operator = operator;
    claim.scope.environments = ['production'];
    const findings = await assessClaims({ claims: [claim], decisions: goldDecisions() });
    expect(findings[0]).toMatchObject({ outcome: 'CONFLICT', reason: 'VALUE_CONTRADICTION' });
  });

  it('accepts the approved GTE alternative for S12 but still rejects LTE despite the same staging verdict', async () => {
    const good = await reportFor('S12', (claims) => { claims[0]!.operator = 'GTE'; });
    expect(scoreScenario(good.scenario, good.report).pass).toBe(true);
    const bad = await reportFor('S12', (claims) => { claims[0]!.operator = 'LTE'; });
    const score = scoreScenario(bad.scenario, bad.report);
    expect(score.outcomeMatch).toBe(true);
    expect(score.pass).toBe(false);
    expect(score.claimErrors[0]!.fields).toContain('operator');
  });

  it('accepts singular/plural creation-request labels without accepting a refund-request scope', async () => {
    const same = await reportFor('S27', (claims) => { claims[0]!.scope.conditions = ['payment creation request']; });
    expect(scoreScenario(same.scenario, same.report).pass).toBe(true);
    const other = await reportFor('S27', (claims) => { claims[0]!.scope.conditions = ['refund requests']; });
    expect(other.report.findings[0]).toMatchObject({ outcome: 'NEEDS_REVIEW', reason: 'AMBIGUOUS_SCOPE' });
    expect(scoreScenario(other.scenario, other.report).pass).toBe(false);
  });

  it('does not treat different configuration qualifiers as equivalent just because both are required', () => {
    const claim = goldScenarios().find((s) => s.id === 'S02')!.claims[1]!;
    expect(claim.textValue).toBe('merchant');
    expect(compareConstraint(claim, { ...claim, textValue: 'global' }).verdict).toBe('INCOMPARABLE');
    expect(compareConstraint(claim, { ...claim }).verdict).toBe('COMPATIBLE');
  });

  it('scores a missing merchant qualifier as a field error instead of losing it in gold loading', async () => {
    const { scenario, report } = await reportFor('S02', (claims) => { delete claims[1]!.textValue; });
    const result = scoreScenario(scenario, report);
    expect(result.outcomeMatch).toBe(true);
    expect(result.pass).toBe(false);
    expect(result.claimErrors.some((c) => c.fields.includes('textValue'))).toBe(true);
  });
});
