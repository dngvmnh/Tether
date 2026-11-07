import type { JobProgressStage, Outcome, ReasonCode } from '../../../src/contracts';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  CONFLICT: 'Conflict',
  NEEDS_REVIEW: 'Needs review',
  NO_CONFLICT_FOUND: 'No conflict found',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
};

/** Order findings by how urgently a developer should look at them. */
export const OUTCOME_RANK: Record<Outcome, number> = { CONFLICT: 0, NEEDS_REVIEW: 1, INSUFFICIENT_EVIDENCE: 2, NO_CONFLICT_FOUND: 3 };

export const REASON_COPY: Partial<Record<ReasonCode, string>> = {
  VALUE_CONTRADICTION: 'No implementation can satisfy both.',
  PROHIBITION_VIOLATED: 'The ticket requires something the decision prohibits.',
  AMBIGUOUS_COUNTING: 'Depends on whether the first request counts as an attempt.',
  AMBIGUOUS_SCOPE: 'The decision may not cover these conditions.',
  COMPETING_DECISIONS: 'Two current decisions disagree with each other.',
  NON_AUTHORITATIVE_DECISION_DISAGREES: 'A proposed (not accepted) decision disagrees.',
  GUIDELINE_ONLY: 'The decision is a recommendation, not a rule.',
  UNVERIFIED_EVIDENCE: 'The quoted text could not be verified in the source.',
  CONSISTENT_IF_TIGHTER: 'Compatible if the implementation stays within the decision.',
  NO_DECISION_FOUND: 'No decision covers this requirement.',
  DECISION_NOT_APPLICABLE: 'Decisions exist, but for another service or environment.',
  ONLY_SUPERSEDED_DECISIONS: 'Only superseded decisions cover this.',
  RETRIEVAL_FAILED: 'Decisions could not be retrieved. Not checked.',
};

export const STAGE_LABEL: Record<JobProgressStage, string> = {
  QUEUED: 'Queued',
  FETCHING_TICKET: 'Reading the ticket',
  RETRIEVING_DECISIONS: 'Finding decisions in Confluence',
  VALIDATING_DECISIONS: 'Checking decision status and history',
  EXTRACTING_CLAIMS: 'Extracting technical requirements',
  COMPARING: 'Comparing requirements with decisions',
  WRITING_REPORT: 'Writing the report',
  DONE: 'Done',
};
