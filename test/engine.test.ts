import { describe, expect, it } from 'vitest';
import type { AnalysisError, Claim, DecisionRecord, RawDecision, TicketSnapshot } from '../src/contracts';
import { aggregate, analyzeIssue, compareConstraint, computeValidity, PortError, verifyQuote, type LlmPort } from '../src/engine';
import { goldDecisions, goldRawDecisions, goldScenarios } from '../eval/gold';

function claim(p: Partial<Claim>): Claim {
  return {
    id: 'C1',
    subject: 'Payment Service',
    attribute: 'retry.count',
    attributeLabel: 'retry limit',
    operator: 'EQ',
    unit: 'retries',
    countingSemantics: 'UNSPECIFIED',
    modality: 'MUST',
    scope: { service: 'payment-service', environments: [], conditions: [] },
    material: true,
    source: { kind: 'JIRA_ISSUE', id: 'PAY-1', title: 't', url: 'u', quote: 'q' },
    confidence: 1,
    ...p,
  };
}

describe('compareConstraint', () => {
  it('exactly 5 vs at most 3 is a conflict', () => {
    expect(compareConstraint(claim({ value: 5 }), claim({ operator: 'LTE', value: 3 })).verdict).toBe('CONFLICT');
  });
  it('max 5 vs max 3 is not a conflict', () => {
    expect(compareConstraint(claim({ operator: 'LTE', value: 5 }), claim({ operator: 'LTE', value: 3 })).verdict).toBe('COMPATIBLE_IF_TIGHTER');
  });
  it('4 attempts including initial equals 3 retries', () => {
    const t = claim({ operator: 'LTE', value: 4, unit: 'attempts', countingSemantics: 'INCLUDES_INITIAL' });
    expect(compareConstraint(t, claim({ operator: 'LTE', value: 3, countingSemantics: 'EXCLUDES_INITIAL' })).verdict).toBe('COMPATIBLE');
  });
  it('robust when both interpretations agree', () => {
    const t = claim({ operator: 'LTE', value: 2, unit: 'attempts' });
    expect(compareConstraint(t, claim({ operator: 'LTE', value: 3 })).verdict).not.toBe('AMBIGUOUS');
  });
  it('converts units', () => {
    const t = claim({ attribute: 'gateway.timeout', value: 15000, unit: 'ms', countingSemantics: 'NOT_APPLICABLE' });
    const d = claim({ attribute: 'gateway.timeout', operator: 'LTE', value: 15, unit: 's', countingSemantics: 'NOT_APPLICABLE' });
    expect(compareConstraint(t, d).verdict).toBe('COMPATIBLE');
  });
  it('refuses to compare different dimensions', () => {
    expect(compareConstraint(claim({ value: 5, unit: 'ms' }), claim({ operator: 'LTE', value: 3 })).verdict).toBe('INCOMPARABLE');
  });
});

describe('computeValidity', () => {
  it('accepted but superseded is not current', () => {
    const v = computeValidity(goldDecisions());
    expect(v.get('ADR-PAY-000')!.current).toBe(false);
    expect(v.get('ADR-PAY-001')!.current).toBe(true);
    expect(v.get('ADR-PAY-005')!.advisory).toBe(true);
  });
  it('detects supersession cycles', () => {
    const base = goldDecisions()[1]!;
    const a: DecisionRecord = { ...base, decisionId: 'A', status: 'ACCEPTED', supersedes: ['B'], supersededBy: [] };
    const b: DecisionRecord = { ...base, decisionId: 'B', status: 'ACCEPTED', supersedes: ['A'], supersededBy: [] };
    const v = computeValidity([a, b]);
    expect(v.get('A')!.inCycle && v.get('B')!.inCycle).toBe(true);
  });
});

describe('aggregate', () => {
  it('a failed fetch is never "no conflict"', () => {
    const errors: AnalysisError[] = [{ stage: 'FETCH_TICKET', code: 'HTTP_403', message: 'forbidden', retryable: false, claimIds: [] }];
    const a = aggregate([], [], errors);
    expect(a.status).toBe('FAILED');
    expect(a.overallOutcome).toBeNull();
  });
});

describe('verifyQuote', () => {
  it('tolerates whitespace and smart quotes, rejects invented text', () => {
    expect(verifyQuote('must  retry “failed” transactions', 'You must retry "failed" transactions now')).toBe(true);
    expect(verifyQuote('must retry 7 times', 'must retry 3 times')).toBe(false);
  });
});

describe('analyzeIssue with fake ports', () => {
  const s = goldScenarios()[0]!; // S01
  const gold = goldDecisions();
  const fakeLlm = (failClaims = false): LlmPort => ({
    async callTool(req) {
      if (req.toolName === 'record_constraints') {
        const id = /Decision (\S+)/.exec(req.user)![1];
        const d = gold.find((x) => x.decisionId === id)!;
        return { model: 'fake', args: { constraints: d.constraints.map(toExtracted) } };
      }
      if (req.toolName === 'record_requirements') {
        if (failClaims) throw new Error('model unavailable');
        return { model: 'fake', args: { constraints: s.claims.map(toExtracted) } };
      }
      return { model: 'fake', args: { verdict: 'NOT_RELATED', explanation: 'n/a', confidence: 0.5 } };
    },
  });
  const ports = (llm: LlmPort, ticketFails = false) => ({
    tickets: {
      async getTicket(): Promise<TicketSnapshot> {
        if (ticketFails) throw new PortError('No permission to view issue', 'HTTP_403', false, true);
        return s.ticket;
      },
    },
    decisions: {
      async search() {
        return { decisions: goldRawDecisions() as RawDecision[], spacesSearched: ['ENG'], decisionLabel: 'tether-decision' };
      },
    },
    llm,
  });

  it('produces the S01 conflict end to end', async () => {
    const r = await analyzeIssue(s.ticket.issueKey, ports(fakeLlm()));
    expect(r.errors).toEqual([]);
    expect(r.overallOutcome).toBe('CONFLICT');
  });
  it('reports a permission failure as FAILED, not as a verdict', async () => {
    const r = await analyzeIssue(s.ticket.issueKey, ports(fakeLlm(), true));
    expect(r.status).toBe('FAILED');
    expect(r.overallOutcome).toBeNull();
    expect(r.errors[0]!.stage).toBe('PERMISSION');
  });
  it('reports an extraction failure as FAILED', async () => {
    const r = await analyzeIssue(s.ticket.issueKey, ports(fakeLlm(true)));
    expect(r.status).toBe('FAILED');
    expect(r.overallOutcome).toBeNull();
  });
});

function toExtracted(c: Claim) {
  return {
    subject: c.subject,
    service: c.scope.service,
    attribute: c.attribute,
    attributeLabel: c.attributeLabel,
    operator: c.operator,
    value: c.value,
    valueMax: c.valueMax,
    unit: c.unit,
    countingSemantics: c.countingSemantics,
    modality: c.modality,
    environments: c.scope.environments,
    conditions: c.scope.conditions,
    quote: c.source.quote,
    location: c.source.location ?? 'description',
    material: c.material,
    confidence: c.confidence,
  };
}
