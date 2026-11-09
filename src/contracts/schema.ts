/**
 * Tether data contracts: the single source of truth shared by the engine, the Forge
 * backend, the Rovo/MCP actions and the UI.
 *
 * Rules:
 *  - Changing anything here is a contract change: open a PR labelled `contract`, get a
 *    review from all three owners, bump SCHEMA_VERSION on breaking changes and
 *    regenerate UI fixtures (`npm run fixtures`).
 *  - The UI imports *types only* from this folder (`import type`), never runtime code.
 *  - Every LLM output is parsed with these schemas before it is trusted.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = '1.0' as const;

/* ------------------------------------------------------------------ outcomes */

/** Verdict for one claim and, aggregated, for the whole ticket. */
export const Outcome = z.enum([
  'CONFLICT', // a clear contradiction with an applicable, current decision
  'NEEDS_REVIEW', // ambiguity, competing decisions or a non-authoritative decision disagrees
  'NO_CONFLICT_FOUND', // checked against applicable current decisions, no contradiction
  'INSUFFICIENT_EVIDENCE', // could not be reliably assessed (missing / not applicable / failed)
]);
export type Outcome = z.infer<typeof Outcome>;

/** Machine-readable reason behind an outcome. The UI maps each code to copy. */
export const ReasonCode = z.enum([
  // CONFLICT
  'VALUE_CONTRADICTION',
  'PROHIBITION_VIOLATED',
  'SEMANTIC_CONTRADICTION',
  // NEEDS_REVIEW
  'AMBIGUOUS_COUNTING',
  'AMBIGUOUS_SCOPE',
  'COMPETING_DECISIONS',
  'NON_AUTHORITATIVE_DECISION_DISAGREES',
  'GUIDELINE_ONLY',
  'SEMANTIC_UNCLEAR',
  'UNVERIFIED_EVIDENCE',
  'SUPERSESSION_CYCLE',
  // NO_CONFLICT_FOUND
  'CONSISTENT',
  'CONSISTENT_IF_TIGHTER',
  // INSUFFICIENT_EVIDENCE
  'NO_DECISION_FOUND',
  'DECISION_NOT_APPLICABLE',
  'ONLY_SUPERSEDED_DECISIONS',
  'INCOMPARABLE',
  'RETRIEVAL_FAILED',
  'NO_TECHNICAL_CLAIMS',
]);
export type ReasonCode = z.infer<typeof ReasonCode>;

/* ------------------------------------------------------------------ sources */

export const SourceRef = z.object({
  kind: z.enum(['JIRA_ISSUE', 'CONFLUENCE_PAGE', 'TEAMWORK_GRAPH']),
  /** Issue key (PAY-142) or Confluence page id. */
  id: z.string(),
  title: z.string(),
  url: z.string(),
  version: z.number().int().optional(),
  /** Where in the source: 'description', 'acceptance criteria', 'Decision', ... */
  location: z.string().optional(),
  /** Exact text. Engine verifies it appears verbatim in the source before showing it. */
  quote: z.string(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const Person = z.object({
  accountId: z.string().optional(),
  displayName: z.string(),
});
export type Person = z.infer<typeof Person>;

/* ------------------------------------------------------------------ claims */

export const Operator = z.enum([
  'EQ',
  'LTE',
  'LT',
  'GTE',
  'GT',
  'RANGE', // value..valueMax inclusive
  'REQUIRED', // "must use idempotency keys"
  'PROHIBITED', // "must not store PANs"
  'QUALITATIVE', // anything else: compared semantically by the LLM stage
]);
export type Operator = z.infer<typeof Operator>;

export const Modality = z.enum(['MUST', 'SHOULD', 'MAY']);
export type Modality = z.infer<typeof Modality>;

/** Whether a count includes the initial request (attempts vs retries). */
export const CountingSemantics = z.enum([
  'INCLUDES_INITIAL',
  'EXCLUDES_INITIAL',
  'UNSPECIFIED',
  'NOT_APPLICABLE',
]);
export type CountingSemantics = z.infer<typeof CountingSemantics>;

export const Scope = z.object({
  /** Canonical service slug, e.g. 'payment-service'. '*' means every service. */
  service: z.string(),
  /** [] means unspecified, i.e. applies to every environment. */
  environments: z.array(z.string()).default([]),
  /** Free-text operating conditions, e.g. 'transient failures'. */
  conditions: z.array(z.string()).default([]),
});
export type Scope = z.infer<typeof Scope>;

/**
 * One atomic technical constraint. Used both for requirements extracted from a Jira
 * ticket and for constraints extracted from a decision statement.
 */
export const Claim = z.object({
  id: z.string(),
  /** Human label, e.g. 'Payment Service'. */
  subject: z.string(),
  /** Canonical attribute key shared across tickets and decisions, e.g. 'retry.count'. */
  attribute: z.string(),
  attributeLabel: z.string(),
  operator: Operator,
  value: z.number().optional(),
  valueMax: z.number().optional(),
  textValue: z.string().optional(),
  /** 'retries' | 'attempts' | 'ms' | 's' | 'days' | 'USD' | ... */
  unit: z.string().optional(),
  countingSemantics: CountingSemantics.default('NOT_APPLICABLE'),
  modality: Modality,
  scope: Scope,
  /** False for incidental statements that should not affect coverage. */
  material: z.boolean(),
  source: SourceRef,
  confidence: z.number().min(0).max(1),
});
export type Claim = z.infer<typeof Claim>;

/* ------------------------------------------------------------------ decisions */

export const DecisionStatus = z.enum([
  'ACCEPTED',
  'PROPOSED',
  'SUPERSEDED',
  'DEPRECATED',
  'REJECTED',
  'UNKNOWN',
]);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

/** A decision record as retrieved from Confluence, before constraint extraction. */
export const RawDecision = z.object({
  decisionId: z.string(),
  title: z.string(),
  status: DecisionStatus,
  scope: Scope,
  owner: Person.optional(),
  /** Resolved from Teamwork Graph when available. */
  ownerTeam: z.string().optional(),
  statement: z.string(),
  rationale: z.string().optional(),
  supersedes: z.array(z.string()).default([]),
  supersededBy: z.array(z.string()).default([]),
  effectiveDate: z.string().optional(),
  /** Page reference. `quote` holds the decision statement. */
  source: SourceRef,
  parse: z.object({
    method: z.enum(['PAGE_PROPERTIES', 'LLM', 'FIXTURE']),
    warnings: z.array(z.string()).default([]),
  }),
});
export type RawDecision = z.infer<typeof RawDecision>;

export const DecisionRecord = RawDecision.extend({
  /** Normalised constraints extracted from `statement`. */
  constraints: z.array(Claim),
});
export type DecisionRecord = z.infer<typeof DecisionRecord>;

export const DecisionHistoryEntry = z.object({
  decisionId: z.string(),
  title: z.string(),
  status: DecisionStatus,
  current: z.boolean(),
  supersededBy: z.array(z.string()).default([]),
  url: z.string(),
});
export type DecisionHistoryEntry = z.infer<typeof DecisionHistoryEntry>;

/* ------------------------------------------------------------------ findings */

export const ScopeCheckValue = z.enum(['MATCH', 'MISMATCH', 'UNKNOWN']);
export type ScopeCheckValue = z.infer<typeof ScopeCheckValue>;

export const ScopeCheck = z.object({
  service: ScopeCheckValue,
  environment: ScopeCheckValue,
  conditions: ScopeCheckValue,
  counting: ScopeCheckValue,
});
export type ScopeCheck = z.infer<typeof ScopeCheck>;

export const FollowUpDraft = z.object({
  findingId: z.string(),
  projectKey: z.string(),
  issueTypeName: z.string(),
  summary: z.string().max(255),
  descriptionText: z.string(),
  linkedIssueKey: z.string(),
  decisionLinks: z.array(z.object({ title: z.string(), url: z.string() })),
});
export type FollowUpDraft = z.infer<typeof FollowUpDraft>;

export const SuggestedAction = z.object({
  kind: z.enum([
    'CLARIFY_TICKET',
    'ASK_DECISION_OWNER',
    'CREATE_FOLLOW_UP',
    'LINK_DECISION',
    'DOCUMENT_DECISION',
  ]),
  label: z.string(),
  owner: Person.optional(),
});
export type SuggestedAction = z.infer<typeof SuggestedAction>;

/** The assessment of one ticket claim. Every material claim gets exactly one finding. */
export const Finding = z.object({
  id: z.string(),
  claimId: z.string(),
  outcome: Outcome,
  reason: ReasonCode,
  headline: z.string(),
  explanation: z.string(),
  ticketEvidence: SourceRef,
  decisionEvidence: z.array(SourceRef),
  /** Decisions that drove the outcome (current/authoritative first). */
  decisionIds: z.array(z.string()),
  history: z.array(DecisionHistoryEntry),
  scopeCheck: ScopeCheck,
  method: z.enum(['DETERMINISTIC', 'SEMANTIC', 'NONE']),
  confidence: z.number().min(0).max(1),
  suggestedActions: z.array(SuggestedAction),
});
export type Finding = z.infer<typeof Finding>;

/* ------------------------------------------------------------------ report */

export const AnalysisStage = z.enum([
  'FETCH_TICKET',
  'EXTRACT_CLAIMS',
  'TEAMWORK_GRAPH',
  'RETRIEVE_DECISIONS',
  'EXTRACT_DECISION_CONSTRAINTS',
  'COMPARE',
  'PERMISSION',
  'TIMEOUT',
  'INTERNAL',
]);
export type AnalysisStage = z.infer<typeof AnalysisStage>;

/** Operational failure. Never folded into an outcome: shown separately in the UI. */
export const AnalysisError = z.object({
  stage: AnalysisStage,
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  /** Claims this error prevented from being checked. Empty = whole report. */
  claimIds: z.array(z.string()).default([]),
});
export type AnalysisError = z.infer<typeof AnalysisError>;

export const Coverage = z.object({
  totalClaims: z.number().int(),
  materialClaims: z.number().int(),
  checkedMaterialClaims: z.number().int(),
  unchecked: z.array(z.object({ claimId: z.string(), reason: ReasonCode })),
  /** e.g. "2 of 3 requirements checked. 1 has insufficient evidence." */
  summary: z.string(),
});
export type Coverage = z.infer<typeof Coverage>;

export const AnalysisReport = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  reportId: z.string(),
  issueKey: z.string(),
  issueUrl: z.string(),
  /** Jira `updated` timestamp of the ticket version that was analysed. */
  ticketUpdatedAt: z.string(),
  generatedAt: z.string(),
  /** FAILED = nothing trustworthy; PARTIAL = some stages failed, see errors. */
  status: z.enum(['COMPLETE', 'PARTIAL', 'FAILED']),
  /** null only when status is FAILED. A failed run is never "no conflict". */
  overallOutcome: Outcome.nullable(),
  headline: z.string(),
  claims: z.array(Claim),
  decisions: z.array(DecisionRecord),
  findings: z.array(Finding),
  coverage: Coverage,
  errors: z.array(AnalysisError),
  context: z.object({
    spacesSearched: z.array(z.string()),
    decisionLabel: z.string(),
    decisionsConsidered: z.number().int(),
    graph: z.object({
      used: z.boolean(),
      linkedPages: z.number().int(),
      note: z.string().optional(),
    }),
  }),
  run: z.object({
    durationMs: z.number().int(),
    llmCalls: z.number().int(),
    models: z.array(z.string()),
  }),
});
export type AnalysisReport = z.infer<typeof AnalysisReport>;

/* ------------------------------------------------------------------ jobs */

export const JobStatus = z.enum(['QUEUED', 'RUNNING', 'DONE', 'FAILED']);
export const JobProgressStage = z.enum([
  'QUEUED',
  'FETCHING_TICKET',
  'EXTRACTING_CLAIMS',
  'RETRIEVING_DECISIONS',
  'VALIDATING_DECISIONS',
  'COMPARING',
  'WRITING_REPORT',
  'DONE',
]);
export type JobProgressStage = z.infer<typeof JobProgressStage>;

export const Job = z.object({
  jobId: z.string(),
  issueKey: z.string(),
  status: JobStatus,
  stage: JobProgressStage,
  createdAt: z.string(),
  updatedAt: z.string(),
  reportId: z.string().optional(),
  error: AnalysisError.optional(),
});
export type Job = z.infer<typeof Job>;

/** Why the latest stored report may no longer reflect reality. */
export const StaleInfo = z.object({
  reason: z.enum(['TICKET_UPDATED', 'DECISION_UPDATED']),
  at: z.string(),
  decisionIds: z.array(z.string()).default([]),
});
export type StaleInfo = z.infer<typeof StaleInfo>;

/* ------------------------------------------------------------------ ticket */

/** Normalised Jira issue as consumed by the engine. */
export const TicketSnapshot = z.object({
  issueKey: z.string(),
  issueId: z.string(),
  projectKey: z.string(),
  issueType: z.string(),
  url: z.string(),
  summary: z.string(),
  description: z.string(),
  /** Text under an "Acceptance criteria" heading or a dedicated field, if any. */
  acceptanceCriteria: z.string().default(''),
  labels: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  updatedAt: z.string(),
});
export type TicketSnapshot = z.infer<typeof TicketSnapshot>;

/* ------------------------------------------------------------------ config */

export const TetherConfig = z.object({
  spaceKeys: z.array(z.string()).default(['ENG']),
  decisionLabel: z.string().default('tether-decision'),
  /** Tried in order; the first available one is used. */
  models: z.array(z.string()).default(['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']),
  useTeamworkGraph: z.boolean().default(true),
  /**
   * Key of the persisted Cypher query (registered in TWG Labs) that returns the Confluence
   * pages linked to a work item. Raw cypherQuery is closed to new apps. See docs/TEAM-SETUP.md.
   */
  twgLinkedPagesQueryKey: z.string().optional(),
  /** Re-run the check automatically when a linked decision changes. */
  autoRecheckOnDecisionChange: z.boolean().default(false),
});
export type TetherConfig = z.infer<typeof TetherConfig>;
