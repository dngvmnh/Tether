import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '../src/contracts';
import { assembleReport, assessClaims } from '../src/engine';
import { goldDecisions, goldScenarios } from '../eval/gold';
import { scoreScenario } from '../eval/score-scenario';

async function fixture(id = 'S09') {
  const scenario = goldScenarios().find((s) => s.id === id)!;
  const decisions = goldDecisions();
  const findings = await assessClaims({ claims: scenario.claims, decisions });
  const report = assembleReport({
    reportId: `score-${id}`, issueKey: scenario.ticket.issueKey, ticket: scenario.ticket,
    claims: scenario.claims, decisions, findings, errors: [], spacesSearched: ['ENG'], decisionLabel: 'tether-decision',
    graph: { used: false, linkedPages: 0 }, generatedAt: '2026-11-08T09:00:00Z', durationMs: 0, llmCalls: 0, models: [],
  });
  return { scenario, report: structuredClone(report) };
}

describe('per-claim evaluation detects errors hidden by correct overall verdicts', () => {
  it('accepts the known gold reports', async () => {
    for (const s of goldScenarios()) {
      const { scenario, report } = await fixture(s.id);
      expect(scoreScenario(scenario, report).pass, s.id).toBe(true);
    }
  });

  it('detects an omitted requirement even when the overall CONFLICT is correct', async () => {
    const { scenario, report } = await fixture();
    const removed = report.claims.pop()!;
    report.findings = report.findings.filter((f) => f.claimId !== removed.id);
    const score = scoreScenario(scenario, report);
    expect(score.outcomeMatch).toBe(true);
    expect(score.pass).toBe(false);
    expect(score.missingClaims).toEqual([removed.id]);
  });

  it.each([
    ['operator', (r: AnalysisReport) => { r.claims[0]!.operator = 'LTE'; }],
    ['value', (r: AnalysisReport) => { r.claims[0]!.value = 99; }],
    ['material', (r: AnalysisReport) => { r.claims[0]!.material = false; }],
    ['service', (r: AnalysisReport) => { r.claims[0]!.scope.service = 'notification-service'; }],
    ['environments', (r: AnalysisReport) => { r.claims[0]!.scope.environments = ['staging']; }],
  ])('detects wrong %s extraction despite an unchanged report verdict', async (field, mutate) => {
    const { scenario, report } = await fixture();
    mutate(report);
    const score = scoreScenario(scenario, report);
    expect(score.pass).toBe(false);
    expect(score.claimErrors[0]!.fields).toContain(field);
  });

  it('matches reordered claims with new ids to their sources', async () => {
    const { scenario, report } = await fixture();
    const ids = new Map(report.claims.map((c, i) => [c.id, `generated-${10 - i}`]));
    report.claims.reverse();
    report.claims.forEach((c) => { c.id = ids.get(c.id)!; });
    report.findings.forEach((f) => { f.claimId = ids.get(f.claimId)!; });
    expect(scoreScenario(scenario, report).pass).toBe(true);
  });

  it('accepts equivalent numeric units', async () => {
    const { scenario, report } = await fixture('S14');
    report.claims[0]!.value = 15;
    report.claims[0]!.unit = 's';
    expect(scoreScenario(scenario, report).pass).toBe(true);
  });

  it('rejects a fabricated quote even if the extracted fields match gold', async () => {
    const { scenario, report } = await fixture();
    report.claims[0]!.source.quote = 'Retry exactly 99 times, as demanded by a fabricated requirement.';
    const score = scoreScenario(scenario, report);
    expect(score.pass).toBe(false);
    expect(score.evidenceErrors.length).toBeGreaterThan(0);
  });

  it('rejects an extra material claim and duplicate ids', async () => {
    const { scenario, report } = await fixture();
    report.claims.push(structuredClone(report.claims[0]!));
    const score = scoreScenario(scenario, report);
    expect(score.pass).toBe(false);
    expect(score.unexpectedClaims).toHaveLength(1);
    expect(score.structuralErrors).toContain('Duplicate claim ids');
  });

  it('does not let a report validate invented decision evidence against itself', async () => {
    const { scenario, report } = await fixture();
    const evidence = report.findings[0]!.decisionEvidence[0]!;
    const decision = report.decisions.find((d) => d.source.id === evidence.id)!;
    decision.statement = evidence.quote = 'A fabricated decision requires exactly 123 retries.';
    const score = scoreScenario(scenario, report);
    expect(score.pass).toBe(false);
    expect(score.evidenceErrors.length).toBeGreaterThan(0);
  });

  it('rejects incorrect per-claim findings despite a correct ticket verdict', async () => {
    const { scenario, report } = await fixture();
    report.findings[1]!.outcome = 'CONFLICT';
    const score = scoreScenario(scenario, report);
    expect(score.outcomeMatch).toBe(true);
    expect(score.pass).toBe(false);
    expect(score.claimErrors.some((e) => e.fields.includes('outcome'))).toBe(true);
  });

  it('does not count a failed/partial run as a full evaluation pass', async () => {
    const { scenario, report } = await fixture();
    report.status = 'PARTIAL';
    report.errors = [{ stage: 'COMPARE', code: 'LLM_UNAVAILABLE', message: 'Model unavailable', retryable: true, claimIds: [] }];
    expect(scoreScenario(scenario, report).pass).toBe(false);
  });
});
