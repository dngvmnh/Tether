import type { AnalysisStage, DecisionStatus, JobProgressStage, Outcome, ReasonCode } from '../../../src/contracts';

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

/** Order the worker actually runs the stages in (src/engine/pipeline.ts). */
export const STAGE_ORDER: JobProgressStage[] = [
  'QUEUED',
  'FETCHING_TICKET',
  'RETRIEVING_DECISIONS',
  'VALIDATING_DECISIONS',
  'EXTRACTING_CLAIMS',
  'COMPARING',
  'WRITING_REPORT',
];

/** Plain-language description of what an operational error means for the reader. */
export const ERROR_STAGE_COPY: Record<AnalysisStage, string> = {
  FETCH_TICKET: 'The ticket could not be read.',
  EXTRACT_CLAIMS: 'Requirements could not be extracted from the ticket.',
  TEAMWORK_GRAPH: 'Linked pages could not be looked up in Teamwork Graph, so Tether searched by label instead.',
  RETRIEVE_DECISIONS: 'Decisions could not be retrieved from Confluence.',
  EXTRACT_DECISION_CONSTRAINTS: 'A decision could not be read, so it was left out of the comparison.',
  COMPARE: 'Some requirements could not be compared.',
  PERMISSION: 'Tether does not have permission to read something it needed.',
  TIMEOUT: 'The check took too long and was stopped.',
  INTERNAL: 'Something went wrong inside Tether.',
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

/** Formats an ISO timestamp for display; null when missing or invalid so the banner still works. */
export function formatChangedAt(at: string | undefined): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
}

export const STALE_COPY = {
  DECISION_UPDATED: {
    title: 'A decision used in this check has changed',
    detail: 'These results may be out of date. Re-check to compare the ticket with the latest decision.',
  },
  TICKET_UPDATED: {
    title: 'This ticket changed after the last check',
    detail: 'These results may be out of date. Re-check to analyse the latest ticket text.',
  },
} as const;

/** Short status label and plain-language meaning for each decision status in the history list. */
export const DECISION_STATUS_COPY: Record<DecisionStatus, { label: string; hint: string }> = {
  ACCEPTED: { label: 'Accepted', hint: 'in force' },
  PROPOSED: { label: 'Proposed', hint: 'not accepted yet, so not authoritative' },
  SUPERSEDED: { label: 'Superseded', hint: 'replaced by a newer decision' },
  DEPRECATED: { label: 'Deprecated', hint: 'no longer recommended' },
  REJECTED: { label: 'Rejected', hint: 'was not adopted' },
  UNKNOWN: { label: 'Status unknown', hint: 'the decision page does not state a status' },
};

export const HISTORY_HEADING = 'Decision history';
