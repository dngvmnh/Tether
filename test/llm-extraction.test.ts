import { describe, expect, it } from 'vitest';
import type { Claim } from '../src/contracts';
import { extractDecisionConstraints, extractTicketClaims } from '../src/engine/llm/extract';
import { llmSemanticComparator } from '../src/engine/llm/semantic';
import { StructuredOutputError } from '../src/engine/llm/structured';
import type { LlmPort, LlmToolRequest } from '../src/engine/ports';
import { goldDecisions, goldScenarios } from '../eval/gold';

const scenario = () => goldScenarios()[0]!;
const decision = () => goldDecisions().find((d) => d.decisionId === 'ADR-PAY-001')!;

function extracted(c: Claim) {
  return {
    subject: c.subject, service: c.scope.service, attribute: c.attribute, attributeLabel: c.attributeLabel,
    operator: c.operator, value: c.value, valueMax: c.valueMax, textValue: c.textValue,
    unit: c.unit, countingSemantics: c.countingSemantics, modality: c.modality,
    environments: c.scope.environments, conditions: c.scope.conditions,
    quote: c.source.quote, location: c.source.location ?? 'acceptance criteria',
    material: c.material, confidence: c.confidence,
  };
}

function fake(...answers: unknown[]) {
  const requests: LlmToolRequest[] = [];
  const llm: LlmPort = { async callTool(req) {
    requests.push(req);
    return { model: 'fake-not-a-live-model', args: answers[Math.min(requests.length - 1, answers.length - 1)] };
  } };
  return { llm, requests };
}

const vocab = { services: ['payment-service'], attributes: [{ key: 'retry.count', label: 'retry limit' }] };

describe('extraction boundary validation (fake LLM, not a model-quality evaluation)', () => {
  it('repairs a request-type scope copied from another decision into a general retry ticket', async () => {
    const s = goldScenarios().find((s) => s.id === 'S13')!;
    const valid = extracted(s.claims[0]!);
    const f = fake({ constraints: [{ ...valid, conditions: ['payment creation requests'] }] }, { constraints: [valid] });
    const result = await extractTicketClaims(f.llm, s.ticket, vocab);
    expect(result.calls).toBe(2);
    expect(result.claims[0]!.scope.conditions).toEqual([]);
  });

  it('retains a genuinely stated request-type restriction', async () => {
    const s = goldScenarios().find((s) => s.id === 'S27')!;
    const valid = { ...extracted(s.claims[0]!), conditions: ['payment creation request'] };
    const f = fake({ constraints: [valid] });
    const result = await extractTicketClaims(f.llm, s.ticket, vocab);
    expect(result.calls).toBe(1);
    expect(result.claims[0]!.scope.conditions).toEqual(['payment creation request']);
  });
  it('repairs an explicit should numeric guideline promoted to a mandatory rule', async () => {
    const d = goldDecisions().find((d) => d.decisionId === 'ADR-PAY-009')!;
    const valid = extracted(d.constraints[0]!);
    const f = fake({ constraints: [{ ...valid, modality: 'MUST' }] }, { constraints: [valid] });
    const result = await extractDecisionConstraints(f.llm, d, vocab);
    expect(result.calls).toBe(2);
    expect(result.constraints[0]).toMatchObject({ modality: 'SHOULD', operator: 'LTE', value: 60 });
  });
  it('repairs a required refund threshold incorrectly treated as an upper allowance', async () => {
    const s = goldScenarios().find((s) => s.id === 'S12')!;
    const valid = extracted(s.claims[0]!);
    const f = fake({ constraints: [{ ...valid, operator: 'LTE' }] }, { constraints: [valid] });
    const result = await extractTicketClaims(f.llm, s.ticket, vocab);
    expect(result.calls).toBe(2);
    expect(result.claims[0]).toMatchObject({ attribute: 'refund.auto_approval.max_amount', operator: 'EQ', value: 50000, unit: 'USD' });
  });

  it('requires a categorical configuration qualifier in the existing textValue field', async () => {
    const s = goldScenarios().find((s) => s.id === 'S02')!;
    const valid = extracted(s.claims[1]!);
    const f = fake({ constraints: [{ ...valid, textValue: undefined }] }, { constraints: [valid] });
    const result = await extractTicketClaims(f.llm, s.ticket, vocab);
    expect(result.calls).toBe(2);
    expect(result.claims[0]).toMatchObject({ attribute: 'retry.count.config_scope', operator: 'REQUIRED', textValue: 'merchant' });
  });
  it('repairs optional modality on a binding maximum attempts permission', async () => {
    const s = goldScenarios().find((s) => s.id === 'S13')!;
    const valid = extracted(s.claims[0]!);
    const f = fake({ constraints: [{ ...valid, modality: 'MAY' }] }, { constraints: [valid] });
    const result = await extractTicketClaims(f.llm, s.ticket, vocab);
    expect(result.calls).toBe(2);
    expect(result.claims[0]).toMatchObject({ modality: 'MUST', operator: 'LTE', value: 4, unit: 'attempts', countingSemantics: 'INCLUDES_INITIAL' });
  });

  it('preserves genuine optional configuration instead of globally promoting every may to must', async () => {
    const s = goldScenarios().find((s) => s.id === 'S13')!;
    const quote = 'Teams may optionally configure a retry cap of 4 total attempts, including the initial request.';
    const optional = { ...extracted(s.claims[0]!), attribute: 'retry.configurability', modality: 'MAY', quote };
    const f = fake({ constraints: [optional] });
    const result = await extractTicketClaims(f.llm, { ...s.ticket, acceptanceCriteria: quote }, vocab);
    expect(result.calls).toBe(1);
    expect(result.claims[0]!.modality).toBe('MAY');
  });
  it('repairs a duration stored under a strategy key without discarding the numeric requirement', async () => {
    const s = goldScenarios().find((s) => s.id === 'S11')!;
    const valid = extracted(s.claims[0]!);
    const f = fake({ constraints: [{ ...valid, attribute: 'webhook.retry.backoff_strategy' }] }, { constraints: [valid] });
    const result = await extractTicketClaims(f.llm, s.ticket, {
      services: ['payment-service'], attributes: [{ key: 'webhook.retry.initial_backoff', label: 'initial backoff delay' }],
    });
    expect(result.calls).toBe(2);
    expect(result.claims[0]).toMatchObject({ attribute: 'webhook.retry.initial_backoff', operator: 'EQ', value: 1, unit: 's' });
  });
  it('preserves operator, units and counting while assigning source identity in code', async () => {
    const s = goldScenarios()[12]!;
    const c = extracted(s.claims[0]!);
    const f = fake({ constraints: [{ ...c, id: 'invented', source: { url: 'invented' } }] });
    const r = await extractTicketClaims(f.llm, s.ticket, vocab);
    expect(r.claims[0]).toMatchObject({
      id: `${s.ticket.issueKey}-C1`, operator: 'LTE', value: 4, unit: 'attempts', countingSemantics: 'INCLUDES_INITIAL',
      source: { id: s.ticket.issueKey, url: s.ticket.url, quote: c.quote },
    });
  });

  it.each([
    ['invented quote', { quote: 'The payment service must retry exactly 99 times.' }],
    ['wrong source field', { location: 'summary' }],
    ['missing numeric value', { value: undefined }],
    ['inverted range', { operator: 'RANGE', value: 5, valueMax: 2 }],
    ['fractional retries', { value: 2.5 }],
    ['missing qualitative behaviour', { operator: 'QUALITATIVE', textValue: undefined }],
  ])('repairs %s before trusting extraction', async (_name, invalid) => {
    const valid = extracted(scenario().claims[0]!);
    const f = fake({ constraints: [{ ...valid, ...invalid }] }, { constraints: [valid] });
    const result = await extractTicketClaims(f.llm, scenario().ticket, vocab);
    expect(result.calls).toBe(2);
    expect(result.claims[0]!.source.quote).toBe(valid.quote);
    expect(f.requests[1]!.user).toContain('previous tool call was invalid');
  });

  it('fails closed when source evidence is still invented after repair', async () => {
    const c = { ...extracted(scenario().claims[0]!), quote: 'This sentence is not in the ticket.' };
    const f = fake({ constraints: [c] });
    await expect(extractTicketClaims(f.llm, scenario().ticket, vocab)).rejects.toBeInstanceOf(StructuredOutputError);
    expect(f.requests).toHaveLength(2);
  });

  it('validates Confluence evidence and keeps declared decision scope', async () => {
    const d = decision();
    const c = { ...extracted(d.constraints[0]!), service: 'invented-service', environments: ['development'] };
    const f = fake({ constraints: [{ ...c, quote: 'The ADR permits exactly 99 retries.' }] }, { constraints: [c] });
    const r = await extractDecisionConstraints(f.llm, d, vocab);
    expect(r.calls).toBe(2);
    expect(r.constraints[0]!.scope).toEqual(d.scope);
    expect(r.constraints[0]!.source).toMatchObject({ id: d.source.id, version: d.source.version });
  });
});

describe('semantic comparison boundary (fake LLM)', () => {
  const verdict = () => ({ verdict: 'CONFLICT', decisionId: decision().decisionId,
    decisionQuote: decision().statement, explanation: 'The two constraints disagree.', confidence: 0.9 });

  it('repairs a decision id or quote not present in the supplied candidates', async () => {
    const f = fake({ ...verdict(), decisionId: 'UNKNOWN' }, verdict());
    const count = { calls: 0 };
    const r = await llmSemanticComparator(f.llm, count).compare(scenario().claims[0]!, [decision()]);
    expect(r?.verdict).toBe('CONFLICT');
    expect(count.calls).toBe(2);
  });

  it('does not accept CONSISTENT without evidence', async () => {
    const f = fake({ ...verdict(), verdict: 'CONSISTENT', decisionQuote: undefined });
    await expect(llmSemanticComparator(f.llm, { calls: 0 }).compare(scenario().claims[0]!, [decision()]))
      .rejects.toBeInstanceOf(StructuredOutputError);
  });

  it('allows NOT_RELATED without claiming evidence exists', async () => {
    const f = fake({ verdict: 'NOT_RELATED', explanation: 'No decision addresses this topic.', confidence: 0.8 });
    const r = await llmSemanticComparator(f.llm, { calls: 0 }).compare(scenario().claims[0]!, [decision()]);
    expect(r?.verdict).toBe('NOT_RELATED');
  });

  it('does not claim full coverage when only eight of nine candidates were sent', async () => {
    const f = fake({ ...verdict(), verdict: 'CONSISTENT' });
    const candidates = Array.from({ length: 9 }, (_, i) => ({ ...decision(), decisionId: i ? `D-${i}` : decision().decisionId }));
    const r = await llmSemanticComparator(f.llm, { calls: 0 }).compare(scenario().claims[0]!, candidates);
    expect(r?.verdict).toBe('UNCLEAR');
    const payload = JSON.parse(f.requests[0]!.user);
    expect(payload.requirement.scope).toEqual(scenario().claims[0]!.scope);
    expect(payload.decisions).toHaveLength(8);
  });
});
