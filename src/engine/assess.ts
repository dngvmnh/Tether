import type {
  Claim,
  DecisionRecord,
  Finding,
  Outcome,
  ReasonCode,
  ScopeCheck,
  SourceRef,
  SuggestedAction,
} from '../contracts';
import { compareConstraint, describeConstraint, type PairVerdict } from './compare';
import { verifyQuote } from './evidence';
import { checkScope } from './scope';
import { computeValidity, historyEntry, type DecisionValidity } from './validity';

/** Optional LLM stage for qualitative requirements or claims with no attribute match. */
export interface SemanticComparator {
  compare(claim: Claim, candidates: DecisionRecord[]): Promise<SemanticResult | null>;
}

export interface SemanticResult {
  verdict: 'CONFLICT' | 'CONSISTENT' | 'UNCLEAR' | 'NOT_RELATED';
  decisionId?: string;
  /** Must appear verbatim in that decision's statement or it is discarded. */
  decisionQuote?: string;
  explanation: string;
  confidence: number;
}

export interface AssessInput {
  claims: Claim[];
  decisions: DecisionRecord[];
  /** Claims whose decision retrieval failed (API/permission error). */
  retrievalFailedClaimIds?: ReadonlySet<string>;
  /** Claims whose quote could not be verified in the ticket text. */
  unverifiedClaimIds?: ReadonlySet<string>;
  semantic?: SemanticComparator;
  /** Pipeline records claim-specific operational errors without discarding other findings. */
  onError?: (claim: Claim, error: unknown) => void;
}

interface Candidate {
  decision: DecisionRecord;
  constraint: Claim;
  validity: DecisionValidity;
  scope: ReturnType<typeof checkScope>;
}

const UNKNOWN_SCOPE: ScopeCheck = { service: 'UNKNOWN', environment: 'UNKNOWN', conditions: 'UNKNOWN', counting: 'UNKNOWN' };

function verifiedConstraint(c: Candidate): boolean {
  return c.constraint.source.id === c.decision.source.id && verifyQuote(c.constraint.source.quote, c.decision.statement);
}

function uncertainScope(c: Candidate): boolean {
  return c.scope.service === 'UNKNOWN' || c.scope.environment === 'UNKNOWN' || c.scope.conditions === 'UNKNOWN';
}

function ownerOf(d: DecisionRecord | undefined) {
  return d?.owner;
}

function actionsFor(outcome: Outcome, reason: ReasonCode, claim: Claim, d?: DecisionRecord): SuggestedAction[] {
  const owner = ownerOf(d);
  const ownerName = owner?.displayName ?? 'the decision owner';
  switch (outcome) {
    case 'CONFLICT':
      return [
        { kind: 'CLARIFY_TICKET', label: `Clarify the ${claim.attributeLabel} requirement in this ticket` },
        { kind: 'ASK_DECISION_OWNER', label: `Ask ${ownerName} whether ${d?.decisionId ?? 'the decision'} should change`, owner },
        { kind: 'CREATE_FOLLOW_UP', label: 'Create a clarification issue' },
      ];
    case 'NEEDS_REVIEW':
      return [
        {
          kind: 'ASK_DECISION_OWNER',
          label: reason === 'COMPETING_DECISIONS' ? 'Ask the decision owners which decision applies' : `Confirm the intent with ${ownerName}`,
          owner,
        },
        { kind: 'CREATE_FOLLOW_UP', label: 'Create a clarification issue' },
      ];
    case 'INSUFFICIENT_EVIDENCE':
      if (reason === 'RETRIEVAL_FAILED') return [];
      return [
        { kind: 'DOCUMENT_DECISION', label: `Record a decision for ${claim.subject}: ${claim.attributeLabel}` },
        { kind: 'LINK_DECISION', label: 'Link an existing decision page to this ticket' },
      ];
    case 'NO_CONFLICT_FOUND':
      return reason === 'CONSISTENT_IF_TIGHTER'
        ? [{ kind: 'CLARIFY_TICKET', label: `Note the ${d?.decisionId ?? 'decision'} limit in the acceptance criteria` }]
        : [];
  }
}

function finding(
  claim: Claim,
  outcome: Outcome,
  reason: ReasonCode,
  headline: string,
  explanation: string,
  opts: {
    drivers?: Candidate[];
    history?: Candidate[];
    method?: Finding['method'];
    scopeCheck?: ScopeCheck;
    decisionEvidence?: SourceRef[];
    confidence?: number;
  } = {},
): Finding {
  const drivers = opts.drivers ?? [];
  const historySource = opts.history ?? drivers;
  const seen = new Set<string>();
  const history = historySource
    .filter((c) => (seen.has(c.decision.decisionId) ? false : (seen.add(c.decision.decisionId), true)))
    .sort((a, b) => Number(b.validity.current) - Number(a.validity.current))
    .map((c) => historyEntry(c.decision, c.validity));
  return {
    id: `F-${claim.id}`,
    claimId: claim.id,
    outcome,
    reason,
    headline,
    explanation,
    ticketEvidence: claim.source,
    // Never publish an invented extracted quote, even on a Needs Review finding.
    decisionEvidence: opts.decisionEvidence ?? drivers.map((c) => verifiedConstraint(c)
      ? c.constraint.source
      : { ...c.decision.source, quote: c.decision.statement }),
    decisionIds: [...new Set(drivers.map((c) => c.decision.decisionId))],
    history,
    scopeCheck: opts.scopeCheck ?? UNKNOWN_SCOPE,
    method: opts.method ?? (drivers.length ? 'DETERMINISTIC' : 'NONE'),
    confidence: opts.confidence ?? Math.min(claim.confidence, ...drivers.map((c) => c.constraint.confidence), 1),
    suggestedActions: actionsFor(outcome, reason, claim, drivers[0]?.decision),
  };
}

function scopeCheckOf(c: Candidate, v?: PairVerdict): ScopeCheck {
  return { service: c.scope.service, environment: c.scope.environment, conditions: c.scope.conditions, counting: v?.counting ?? 'UNKNOWN' };
}

async function semanticFallback(
  claim: Claim,
  pool: Candidate[],
  input: AssessInput,
  fallback: () => Finding,
): Promise<Finding> {
  if (!input.semantic || pool.length === 0) return fallback();
  const decisions = [...new Map(pool.map((c) => [c.decision.decisionId, c.decision])).values()];
  const r = await input.semantic.compare(claim, decisions);
  if (!r || r.verdict === 'NOT_RELATED') return fallback();
  const cand = pool.find((c) => c.decision.decisionId === r.decisionId);
  if (!cand) {
    return finding(claim, 'NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE', 'Semantic result has no verified decision',
      'The comparison did not identify a decision from the supplied candidates. Its conclusion cannot be verified.',
      { history: pool, method: 'SEMANTIC', confidence: 0 });
  }
  const quoteOk = !!r.decisionQuote && verifyQuote(r.decisionQuote, cand.decision.statement);
  const evidence: SourceRef[] = quoteOk ? [{ ...cand.decision.source, quote: r.decisionQuote! }] : [cand.decision.source];
  const base = { drivers: [cand], method: 'SEMANTIC' as const, scopeCheck: scopeCheckOf(cand), decisionEvidence: evidence, confidence: r.confidence };
  if (!quoteOk) {
    return finding(claim, 'NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE', `Comparison with ${cand.decision.decisionId} needs evidence`,
      'The comparison did not supply a quote verified against this decision. Neither a conflict nor a clean pass is established.', base);
  }
  if (uncertainScope(cand)) {
    return finding(claim, 'NEEDS_REVIEW', 'AMBIGUOUS_SCOPE', `Confirm the scope of ${cand.decision.decisionId}`, r.explanation, base);
  }
  if (r.verdict === 'CONFLICT') {
    if (cand.constraint.modality !== 'MUST' || claim.modality !== 'MUST') {
      return finding(claim, 'NEEDS_REVIEW', 'GUIDELINE_ONLY', `Clarify the requirement against ${cand.decision.decisionId}`, r.explanation, base);
    }
    return cand.validity.authoritative
      ? finding(claim, 'CONFLICT', 'SEMANTIC_CONTRADICTION', `Contradicts ${cand.decision.decisionId}`, r.explanation, base)
      : finding(claim, 'NEEDS_REVIEW', 'NON_AUTHORITATIVE_DECISION_DISAGREES', `${cand.decision.decisionId} (${cand.decision.status.toLowerCase()}) disagrees`, r.explanation, base);
  }
  if (r.verdict === 'UNCLEAR') {
    return finding(claim, 'NEEDS_REVIEW', 'SEMANTIC_UNCLEAR', `Unclear against ${cand.decision.decisionId}`, r.explanation, base);
  }
  if (!cand.validity.authoritative) return fallback();
  return finding(claim, 'NO_CONFLICT_FOUND', 'CONSISTENT', `Consistent with ${cand.decision.decisionId}`, r.explanation, base);
}

async function assessClaim(claim: Claim, input: AssessInput, validity: Map<string, DecisionValidity>): Promise<Finding> {
  const label = `${claim.subject} ${claim.attributeLabel}`;

  if (input.retrievalFailedClaimIds?.has(claim.id)) {
    return finding(claim, 'INSUFFICIENT_EVIDENCE', 'RETRIEVAL_FAILED', `Could not check ${label}`, 'Decision retrieval failed for this requirement, so it was not checked. This is not a "no conflict" result.');
  }
  if (input.unverifiedClaimIds?.has(claim.id)) {
    return finding(claim, 'NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE', `Verify the source of ${label}`,
      'The extracted ticket statement was not found in the ticket text. It cannot support a conflict or a clean pass.');
  }

  const all: Candidate[] = [];
  for (const d of input.decisions) {
    const v = validity.get(d.decisionId)!;
    for (const c of d.constraints) {
      all.push({ decision: d, constraint: c, validity: v, scope: checkScope(claim.scope, c.scope) });
    }
  }
  const sameAttr = all.filter((c) => c.constraint.attribute === claim.attribute);
  const servicePool = all.filter((c) => c.scope.applicable && !c.validity.inCycle
    && (c.validity.authoritative || c.validity.advisory) && verifiedConstraint(c));

  if (sameAttr.length === 0) {
    // These independent feature obligations require their own decision constraint;
    // sibling retry-count/log-retention limits do not establish configuration or
    // logging coverage. Keep them explicitly unassessed instead of speculating.
    if (claim.attribute === 'retry.count.config_scope' || claim.attribute === 'retry.logging') {
      return finding(claim, 'INSUFFICIENT_EVIDENCE', 'NO_DECISION_FOUND', `No decision covers ${label}`,
        `No decision record in the configured spaces constrains ${claim.attributeLabel} for ${claim.subject}.`);
    }
    return semanticFallback(claim, servicePool, input, () =>
      finding(claim, 'INSUFFICIENT_EVIDENCE', 'NO_DECISION_FOUND', `No decision covers ${label}`, `No decision record in the configured spaces constrains ${claim.attributeLabel} for ${claim.subject}.`),
    );
  }

  const applicable = sameAttr.filter((c) => c.scope.applicable);
  if (applicable.length === 0) {
    const ids = [...new Set(sameAttr.map((c) => c.decision.decisionId))].join(', ');
    return finding(
      claim,
      'INSUFFICIENT_EVIDENCE',
      'DECISION_NOT_APPLICABLE',
      `Retrieved decisions do not apply to ${claim.subject}`,
      `${ids} constrain ${claim.attributeLabel}, but for a different service or environment. No applicable decision was found.`,
      { history: sameAttr, scopeCheck: scopeCheckOf(sameAttr[0]!) },
    );
  }

  if (applicable.some((c) => c.validity.inCycle)) {
    const cyc = applicable.filter((c) => c.validity.inCycle);
    return finding(claim, 'NEEDS_REVIEW', 'SUPERSESSION_CYCLE', 'Decision history is circular', 'These decisions supersede each other in a loop, so the current one cannot be determined.', { drivers: cyc, history: sameAttr });
  }

  const auth = applicable.filter((c) => c.validity.authoritative);
  const advisory = applicable.filter((c) => c.validity.advisory);

  const unverified = [...auth, ...advisory].filter((c) => !verifiedConstraint(c));
  if (unverified.length) {
    return finding(claim, 'NEEDS_REVIEW', 'UNVERIFIED_EVIDENCE', `Verify the decision evidence for ${label}`,
      'At least one extracted constraint could not be verified against its decision statement. Review the original decision before relying on this comparison.',
      { drivers: unverified, history: sameAttr });
  }

  if (auth.length === 0) {
    const disagreeing = advisory
      .map((c) => ({ c, v: compareConstraint(claim, c.constraint) }))
      .filter(({ v }) => v.verdict === 'CONFLICT' || v.verdict === 'AMBIGUOUS');
    if (disagreeing.length) {
      const { c, v } = disagreeing[0]!;
      return finding(claim, 'NEEDS_REVIEW', 'NON_AUTHORITATIVE_DECISION_DISAGREES', `${c.decision.decisionId} (${c.decision.status.toLowerCase()}) disagrees`, `${v.detail} ${c.decision.decisionId} is ${c.decision.status.toLowerCase()}, not accepted, so this is not a confirmed conflict.`, {
        drivers: [c],
        history: sameAttr,
        scopeCheck: scopeCheckOf(c, v),
      });
    }
    const onlySuperseded = advisory.length === 0;
    return finding(
      claim,
      'INSUFFICIENT_EVIDENCE',
      onlySuperseded ? 'ONLY_SUPERSEDED_DECISIONS' : 'NO_DECISION_FOUND',
      onlySuperseded ? `Only superseded decisions cover ${label}` : `No accepted decision covers ${label}`,
      onlySuperseded
        ? 'Every applicable decision on this topic has been superseded and no current replacement was found.'
        : 'Only proposed decisions exist for this topic, and they do not contradict the ticket.',
      { history: sameAttr },
    );
  }

  // Competing active decisions: two authoritative constraints that cannot both hold.
  for (let i = 0; i < auth.length; i++) {
    for (let j = i + 1; j < auth.length; j++) {
      const a = auth[i]!;
      const b = auth[j]!;
      if (a.decision.decisionId === b.decision.decisionId) continue;
      const pairScope = checkScope(a.constraint.scope, b.constraint.scope);
      if (a.constraint.modality === 'MUST' && b.constraint.modality === 'MUST'
        && pairScope.applicable && pairScope.conditions !== 'UNKNOWN'
        && compareConstraint(a.constraint, b.constraint).verdict === 'CONFLICT') {
        return finding(
          claim,
          'NEEDS_REVIEW',
          'COMPETING_DECISIONS',
          `${a.decision.decisionId} and ${b.decision.decisionId} disagree`,
          `Two current decisions set ${claim.attributeLabel} differently (${describeConstraint(a.constraint)} vs ${describeConstraint(b.constraint)}). A human needs to confirm which one applies.`,
          { drivers: [a, b], history: sameAttr, scopeCheck: scopeCheckOf(a) },
        );
      }
    }
  }

  const compared = auth.map((c) => ({ c, v: compareConstraint(claim, c.constraint) }));
  const conflict = compared.find(({ v }) => v.verdict === 'CONFLICT');
  if (conflict) {
    const { c, v } = conflict;
    const sc = scopeCheckOf(c, v);
    if (uncertainScope(c)) {
      return finding(claim, 'NEEDS_REVIEW', 'AMBIGUOUS_SCOPE', `May conflict with ${c.decision.decisionId}`, `${v.detail} The service, environment coverage or operating conditions are not fully matched, so applicability needs confirmation.`, { drivers: [c], history: sameAttr, scopeCheck: sc });
    }
    if (c.constraint.modality !== 'MUST' || claim.modality !== 'MUST') {
      return finding(claim, 'NEEDS_REVIEW', 'GUIDELINE_ONLY', `Clarify the requirement against ${c.decision.decisionId}`, `${v.detail} At least one side is advisory or optional, rather than two binding requirements.`, { drivers: [c], history: sameAttr, scopeCheck: sc });
    }
    return finding(claim, 'CONFLICT', v.reason, `Contradicts ${c.decision.decisionId}`, `${v.detail} ${c.decision.decisionId} is accepted and current for ${c.decision.scope.service}.`, { drivers: [c], history: sameAttr, scopeCheck: sc });
  }

  const ambiguous = compared.find(({ v }) => v.verdict === 'AMBIGUOUS');
  if (ambiguous) {
    const { c, v } = ambiguous;
    return finding(claim, 'NEEDS_REVIEW', v.reason, `Ambiguous against ${c.decision.decisionId}`, v.detail, { drivers: [c], history: sameAttr, scopeCheck: scopeCheckOf(c, v) });
  }

  const comparable = compared.filter(({ v }) => v.verdict !== 'INCOMPARABLE');
  if (comparable.length === 0) {
    return semanticFallback(claim, auth, input, () =>
      finding(claim, 'INSUFFICIENT_EVIDENCE', 'INCOMPARABLE', `Could not compare ${label}`, compared[0]!.v.detail, { drivers: auth, history: sameAttr }),
    );
  }

  const tighter = comparable.find(({ v }) => v.verdict === 'COMPATIBLE_IF_TIGHTER');
  const { c, v } = tighter ?? comparable[0]!;
  if (comparable.some((x) => uncertainScope(x.c))) {
    return finding(claim, 'NEEDS_REVIEW', 'AMBIGUOUS_SCOPE', `Confirm the scope of ${c.decision.decisionId}`,
      'The requirement and decision may apply to different services, environments or operating conditions. The comparison does not establish full coverage.',
      { drivers: comparable.map((x) => x.c), history: sameAttr, scopeCheck: scopeCheckOf(c, v) });
  }
  return finding(
    claim,
    'NO_CONFLICT_FOUND',
    v.reason,
    tighter ? `Compatible with ${c.decision.decisionId} if kept within its limit` : `Consistent with ${c.decision.decisionId}`,
    v.detail,
    { drivers: comparable.map((x) => x.c), history: sameAttr, scopeCheck: scopeCheckOf(c, v) },
  );
}

/** Assesses every claim. Deterministic unless a SemanticComparator is supplied. */
export async function assessClaims(input: AssessInput): Promise<Finding[]> {
  const validity = computeValidity(input.decisions);
  const out: Finding[] = [];
  for (const claim of input.claims) {
    try {
      out.push(await assessClaim(claim, input, validity));
    } catch (error) {
      if (!input.onError) throw error;
      input.onError(claim, error);
      out.push(finding(claim, 'INSUFFICIENT_EVIDENCE', 'INCOMPARABLE', 'Comparison could not be completed',
        'The comparison failed for this requirement. Other supported findings remain available; inspect the separate operational error.'));
    }
  }
  return out;
}
