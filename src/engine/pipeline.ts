import {
  SCHEMA_VERSION,
  type AnalysisError,
  type AnalysisReport,
  type AnalysisStage,
  type Claim,
  type DecisionRecord,
  type Finding,
  type TicketSnapshot,
} from '../contracts';
import { aggregate } from './aggregate';
import { assessClaims } from './assess';
import { verifyQuote } from './evidence';
import { extractDecisionConstraints, extractTicketClaims, ticketText, type Vocabulary } from './llm/extract';
import { llmSemanticComparator } from './llm/semantic';
import { PortError, type EngineDeps, type GraphContext } from './ports';

function toError(stage: AnalysisStage, e: unknown, claimIds: string[] = []): AnalysisError {
  if (e instanceof PortError) {
    return { stage: e.permission ? 'PERMISSION' : stage, code: e.code, message: e.message, retryable: e.retryable, claimIds };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { stage, code: 'UNEXPECTED', message, retryable: true, claimIds };
}

export function buildVocabulary(decisions: DecisionRecord[]): Vocabulary {
  const services = new Set<string>();
  const attributes = new Map<string, string>();
  for (const d of decisions) {
    if (d.scope.service !== '*') services.add(d.scope.service);
    for (const c of d.constraints) attributes.set(c.attribute, c.attributeLabel);
  }
  return { services: [...services], attributes: [...attributes].map(([key, label]) => ({ key, label })) };
}

export interface AssembleArgs {
  reportId: string;
  issueKey: string;
  ticket?: TicketSnapshot;
  claims: Claim[];
  decisions: DecisionRecord[];
  findings: Finding[];
  errors: AnalysisError[];
  spacesSearched: string[];
  decisionLabel: string;
  graph: { used: boolean; linkedPages: number; note?: string };
  generatedAt: string;
  durationMs: number;
  llmCalls: number;
  models: string[];
}

/** Pure: turns stage outputs into a contract-valid report. Also used by fixture generation. */
export function assembleReport(a: AssembleArgs): AnalysisReport {
  const agg = aggregate(a.claims, a.findings, a.errors);
  return {
    schemaVersion: SCHEMA_VERSION,
    reportId: a.reportId,
    issueKey: a.issueKey,
    issueUrl: a.ticket?.url ?? '',
    ticketUpdatedAt: a.ticket?.updatedAt ?? '',
    generatedAt: a.generatedAt,
    status: agg.status,
    overallOutcome: agg.overallOutcome,
    headline: agg.headline,
    claims: a.claims,
    decisions: a.decisions,
    findings: a.findings,
    coverage: agg.coverage,
    errors: a.errors,
    context: {
      spacesSearched: a.spacesSearched,
      decisionLabel: a.decisionLabel,
      decisionsConsidered: a.decisions.length,
      graph: a.graph,
    },
    run: { durationMs: a.durationMs, llmCalls: a.llmCalls, models: a.models },
  };
}

/**
 * End-to-end analysis of one Jira issue. Never throws: every failure becomes an
 * AnalysisError on the report, and a failed run has overallOutcome = null.
 */
export async function analyzeIssue(issueKey: string, deps: EngineDeps): Promise<AnalysisReport> {
  const now = deps.now ?? (() => new Date());
  const started = now().getTime();
  const reportId = deps.newId?.() ?? globalThis.crypto.randomUUID();
  const progress = async (s: Parameters<NonNullable<EngineDeps['onProgress']>>[0]) => deps.onProgress?.(s);
  const errors: AnalysisError[] = [];
  const counter = { calls: 0 };
  const models = new Set<string>();
  let spacesSearched: string[] = [];
  let decisionLabel = '';
  let graphInfo: AssembleArgs['graph'] = { used: false, linkedPages: 0 };

  const finish = (p: Partial<AssembleArgs> & { ticket?: TicketSnapshot }) =>
    assembleReport({
      reportId,
      issueKey,
      claims: [],
      decisions: [],
      findings: [],
      errors,
      spacesSearched,
      decisionLabel,
      graph: graphInfo,
      generatedAt: now().toISOString(),
      durationMs: now().getTime() - started,
      llmCalls: counter.calls,
      models: [...models],
      ...p,
    });

  // 1. Ticket
  await progress('FETCHING_TICKET');
  let ticket: TicketSnapshot;
  try {
    ticket = await deps.tickets.getTicket(issueKey);
  } catch (e) {
    errors.push(toError('FETCH_TICKET', e));
    return finish({});
  }

  // 2. Teamwork Graph context (optional, never fatal)
  let graph: GraphContext = { linkedPageIds: [], ownerTeams: {} };
  if (deps.graph) {
    try {
      graph = await deps.graph.contextFor(ticket);
      graphInfo = { used: true, linkedPages: graph.linkedPageIds.length, note: graph.note };
    } catch (e) {
      errors.push(toError('TEAMWORK_GRAPH', e));
      graphInfo = { used: false, linkedPages: 0, note: 'Teamwork Graph unavailable; fell back to label search.' };
    }
  }

  // 3. Decisions
  await progress('RETRIEVING_DECISIONS');
  let retrievalFailed = false;
  const decisions: DecisionRecord[] = [];
  try {
    const found = await deps.decisions.search({
      linkedPageIds: graph.linkedPageIds,
      keywords: ticket.summary.split(/\W+/).filter((w) => w.length > 3).slice(0, 8),
    });
    spacesSearched = found.spacesSearched;
    decisionLabel = found.decisionLabel;

    await progress('VALIDATING_DECISIONS');
    const vocab0: Vocabulary = { services: [...new Set(found.decisions.map((d) => d.scope.service))], attributes: [] };
    for (const raw of found.decisions) {
      const key = `${raw.source.id}:${raw.source.version ?? 0}`;
      try {
        let constraints = await deps.cache?.get(key);
        if (!constraints) {
          const r = await extractDecisionConstraints(deps.llm, raw, vocab0);
          counter.calls += r.calls;
          models.add(r.model);
          constraints = r.constraints;
          await deps.cache?.set(key, constraints);
        }
        decisions.push({ ...raw, ownerTeam: raw.ownerTeam ?? graph.ownerTeams[raw.decisionId], constraints });
      } catch (e) {
        errors.push({ ...toError('EXTRACT_DECISION_CONSTRAINTS', e), message: `${raw.decisionId}: ${(e as Error).message}` });
      }
    }
  } catch (e) {
    retrievalFailed = true;
    errors.push(toError('RETRIEVE_DECISIONS', e));
  }

  // 4. Ticket claims
  await progress('EXTRACTING_CLAIMS');
  let claims: Claim[];
  try {
    const r = await extractTicketClaims(deps.llm, ticket, buildVocabulary(decisions));
    counter.calls += r.calls;
    models.add(r.model);
    claims = r.claims;
  } catch (e) {
    errors.push(toError('EXTRACT_CLAIMS', e));
    return finish({ ticket, decisions });
  }
  const text = ticketText(ticket);
  const unverified = new Set(claims.filter((c) => !verifyQuote(c.source.quote, text)).map((c) => c.id));

  // 5. Compare
  await progress('COMPARING');
  let findings: Finding[] = [];
  try {
    findings = await assessClaims({
      claims,
      decisions,
      retrievalFailedClaimIds: retrievalFailed ? new Set(claims.map((c) => c.id)) : undefined,
      unverifiedClaimIds: unverified,
      semantic: llmSemanticComparator(deps.llm, counter),
    });
  } catch (e) {
    errors.push(toError('COMPARE', e, claims.map((c) => c.id)));
  }

  await progress('WRITING_REPORT');
  return finish({ ticket, claims, decisions, findings });
}
