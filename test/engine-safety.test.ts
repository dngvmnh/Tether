import { describe, expect, it, vi } from 'vitest';
import type { Claim, DecisionRecord } from '../src/contracts';
import { assessClaims } from '../src/engine';
import type { SemanticComparator, SemanticResult } from '../src/engine/assess';
import { goldDecisions, goldScenarios } from '../eval/gold';

const retryDecision = () => goldDecisions().find((d) => d.decisionId === 'ADR-PAY-001')!;
const retryClaim = () => goldScenarios()[0]!.claims[0]!;

function qualitative(): { claim: Claim; decision: DecisionRecord } {
  const statement = 'The payment service must encrypt stored payment tokens with an approved key.';
  const claim: Claim = {
    ...retryClaim(), attribute: 'token.encryption', attributeLabel: 'token encryption',
    operator: 'QUALITATIVE', value: undefined, unit: undefined,
    countingSemantics: 'NOT_APPLICABLE', textValue: 'store tokens in plain text',
    scope: { service: 'payment-service', environments: ['production'], conditions: [] },
    source: { ...retryClaim().source, quote: 'Store payment tokens in plain text.' },
  };
  const base = retryDecision();
  const constraint: Claim = {
    ...claim, id: 'K-ENCRYPT', textValue: 'encrypt stored tokens',
    source: { ...base.source, quote: statement },
  };
  return { claim, decision: {
    ...base, decisionId: 'ADR-ENCRYPT', statement,
    scope: constraint.scope, source: { ...base.source, quote: statement },
    supersedes: [], supersededBy: [], constraints: [constraint],
  } };
}

function semantic(result: Partial<SemanticResult> = {}): SemanticComparator {
  return { compare: vi.fn(async (): Promise<SemanticResult> => ({
    verdict: 'CONFLICT', decisionId: 'ADR-ENCRYPT',
    decisionQuote: qualitative().decision.statement,
    explanation: 'The requirement and decision cannot both be satisfied.', confidence: 0.9,
    ...result,
  })) };
}

describe('evidence must support both conflicts and passes', () => {
  it('does not pass an unverified ticket claim', async () => {
    const c = { ...retryClaim(), value: 2 };
    const [f] = await assessClaims({ claims: [c], decisions: [retryDecision()], unverifiedClaimIds: new Set([c.id]) });
    expect([f!.outcome, f!.reason]).toEqual(['NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE']);
  });

  it('does not use a fabricated decision quote as numeric evidence', async () => {
    const d = retryDecision();
    d.constraints[0] = { ...d.constraints[0]!, source: { ...d.constraints[0]!.source, quote: 'The limit is exactly 99 retries.' } };
    const [f] = await assessClaims({ claims: [retryClaim()], decisions: [d] });
    expect([f!.outcome, f!.reason]).toEqual(['NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE']);
    expect(f!.decisionEvidence.every((e) => d.statement.includes(e.quote))).toBe(true);
  });

  it.each(['CONSISTENT', 'CONFLICT'] as const)('requires evidence for a semantic %s result', async (verdict) => {
    const { claim, decision } = qualitative();
    const [f] = await assessClaims({ claims: [claim], decisions: [decision], semantic: semantic({ verdict, decisionQuote: undefined }) });
    expect([f!.outcome, f!.reason]).toEqual(['NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE']);
  });

  it('does not silently assign an unknown semantic decision id to the first candidate', async () => {
    const { claim, decision } = qualitative();
    const [f] = await assessClaims({ claims: [claim], decisions: [decision], semantic: semantic({ decisionId: 'INVENTED-ID' }) });
    expect([f!.outcome, f!.reason]).toEqual(['NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE']);
    expect(f!.decisionIds).not.toContain('INVENTED-ID');
  });
});

describe('semantic comparison respects decision authority and scope', () => {
  it('accepts a supported qualitative conflict', async () => {
    const { claim, decision } = qualitative();
    const [f] = await assessClaims({ claims: [claim], decisions: [decision], semantic: semantic() });
    expect([f!.outcome, f!.reason]).toEqual(['CONFLICT', 'SEMANTIC_CONTRADICTION']);
  });

  it('does not confirm a semantic conflict with a recommendation', async () => {
    const { claim, decision } = qualitative();
    decision.constraints[0]!.modality = 'SHOULD';
    const [f] = await assessClaims({ claims: [claim], decisions: [decision], semantic: semantic() });
    expect([f!.outcome, f!.reason]).toEqual(['NEEDS_REVIEW', 'GUIDELINE_ONLY']);
  });

  it.each(['REJECTED', 'DEPRECATED', 'SUPERSEDED'] as const)('does not offer a %s decision to semantic fallback', async (status) => {
    const { claim, decision } = qualitative();
    claim.attribute = 'unmatched.encryption';
    decision.status = status;
    const comparator = semantic();
    const [f] = await assessClaims({ claims: [claim], decisions: [decision], semantic: comparator });
    expect(comparator.compare).not.toHaveBeenCalled();
    expect(f!.outcome).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('does not infer a confirmed conflict when the service is unknown', async () => {
    const c = { ...retryClaim(), scope: { ...retryClaim().scope, service: '*' } };
    const [f] = await assessClaims({ claims: [c], decisions: [retryDecision()] });
    expect([f!.outcome, f!.reason]).toEqual(['NEEDS_REVIEW', 'AMBIGUOUS_SCOPE']);
  });

  it('does not report a clean pass for a partially covered environment list', async () => {
    const c = { ...retryClaim(), value: 2, scope: { ...retryClaim().scope, environments: ['production', 'development'] } };
    const [f] = await assessClaims({ claims: [c], decisions: [retryDecision()] });
    expect([f!.outcome, f!.reason]).toEqual(['NEEDS_REVIEW', 'AMBIGUOUS_SCOPE']);
  });
});
