import { describe, expect, it } from 'vitest';
import type { Claim } from '../src/contracts';
import { PortError, type LlmPort } from '../src/engine';
import { goldDecisions, goldScenarios } from '../eval/gold';
import { runGoldenSuite } from '../eval/run-suite';

function extracted(c: Claim) {
  return { subject: c.subject, service: c.scope.service, attribute: c.attribute, attributeLabel: c.attributeLabel,
    operator: c.operator, value: c.value, valueMax: c.valueMax, textValue: c.textValue, unit: c.unit,
    countingSemantics: c.countingSemantics, modality: c.modality, environments: c.scope.environments,
    conditions: c.scope.conditions, quote: c.source.quote, location: c.source.location,
    material: c.material, confidence: c.confidence };
}

function fakeModel(failTickets = false) {
  const counts = { decisions: 0, tickets: 0 };
  const llm: LlmPort = { async callTool(req) {
    if (req.toolName === 'record_constraints') {
      counts.decisions++;
      const id = /Decision (\S+)/.exec(req.user)![1]!;
      return { model: 'test-only', args: { constraints: goldDecisions().find((d) => d.decisionId === id)!.constraints.map(extracted) } };
    }
    if (req.toolName === 'record_requirements') {
      counts.tickets++;
      if (failTickets) throw new PortError('Quota exhausted', 'LLM_UNAVAILABLE', true);
      const key = /Jira issue (\S+)/.exec(req.user)![1]!;
      return { model: 'test-only', args: { constraints: goldScenarios().find((s) => s.ticket.issueKey === key)!.claims.map(extracted) } };
    }
    return { model: 'test-only', args: { verdict: 'NOT_RELATED', explanation: 'No relevant restriction.', confidence: 0.8 } };
  } };
  return { llm, counts };
}

const scenarios = goldScenarios().filter((s) => ['S01', 'S13'].includes(s.id));

describe('evaluation suite orchestration', () => {
  it('extracts decisions once per suite, isolates cached values, and scores real engine reports', async () => {
    const { llm, counts } = fakeModel();
    const result = await runGoldenSuite(llm, { scenarios, onResult(s, report) {
      if (s.id === 'S01') for (const d of report.decisions) for (const c of d.constraints) c.value = 999;
    } });
    expect(result.complete).toBe(true);
    expect(result.evaluated).toBe(2);
    expect(result.passed).toBe(2);
    expect(result.models).toEqual(['test-only']);
    expect(counts.decisions).toBe(goldDecisions().length);
    expect(counts.tickets).toBe(2);
    await runGoldenSuite(llm, { scenarios: scenarios.slice(0, 1) });
    expect(counts.decisions).toBe(goldDecisions().length * 2);
  });

  it('stops on model unavailability and does not count skipped cases as passes', async () => {
    const { llm, counts } = fakeModel(true);
    const result = await runGoldenSuite(llm, { scenarios });
    expect(result.complete).toBe(false);
    expect(result.stoppedReason).toBe('LLM_UNAVAILABLE');
    expect(result.total).toBe(2);
    expect(result.evaluated).toBe(1);
    expect(result.skippedIds).toEqual(['S13']);
    expect(result.passed).toBe(0);
    expect(result.rows[0]!.operationalErrors).toContain('EXTRACT_CLAIMS:LLM_UNAVAILABLE');
    expect(counts.tickets).toBe(1);
  });

  it('respects a depleted time budget before starting model calls', async () => {
    const { llm, counts } = fakeModel();
    const result = await runGoldenSuite(llm, { scenarios, budgetMs: 0 });
    expect(result.stoppedReason).toBe('TIME_BUDGET');
    expect(result.evaluated).toBe(0);
    expect(result.skippedIds).toEqual(['S01', 'S13']);
    expect(counts).toEqual({ decisions: 0, tickets: 0 });
  });
});
