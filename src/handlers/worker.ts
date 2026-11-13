/** Queue consumer (900 s limit): runs analyses and eval suites. */
import { Queue, type AsyncEvent } from '@forge/events';
import type { JobProgressStage } from '../contracts';
import { ConfluenceDecisionAdapter } from '../adapters/confluence';
import { ForgeLlmAdapter } from '../adapters/forgeLlm';
import { JiraTicketAdapter } from '../adapters/jira';
import { kvsConstraintCache, store } from '../adapters/storage';
import { analyzeIssue } from '../engine';
import type { AnalysisJobBody, EvalJobBody } from './jobs';
import { runEvalSuite } from './evalSuite';

const STAGES_RUNNING = new Set<JobProgressStage>(['FETCHING_TICKET', 'EXTRACTING_CLAIMS', 'RETRIEVING_DECISIONS', 'VALIDATING_DECISIONS', 'COMPARING', 'WRITING_REPORT']);

async function runAnalysis(body: AnalysisJobBody) {
  const config = await store.getConfig();
  await store.patchJob(body.jobId, { status: 'RUNNING' });
  const report = await analyzeIssue(body.issueKey, {
    // The worker has no user context: read as the app, then filter pages by the requester's permissions.
    tickets: new JiraTicketAdapter(body.siteUrl, 'app'),
    decisions: new ConfluenceDecisionAdapter(body.siteUrl, config.spaceKeys, config.decisionLabel, 'app', body.accountId),
    graph: body.graph
      ? {
          async contextFor() {
            if (body.graph!.error) throw new Error(body.graph!.error);
            return body.graph!;
          },
        }
      : undefined,
    llm: new ForgeLlmAdapter(config.models),
    cache: kvsConstraintCache,
    onProgress: async (stage) => {
      if (STAGES_RUNNING.has(stage)) await store.patchJob(body.jobId, { stage });
    },
  });
  await store.putReport(report);
  await store.clearStale(body.issueKey);
  const pages = report.decisions.map((d) => ({ pageId: d.source.id, decisionId: d.decisionId }));
  await store.indexDecisions(body.issueKey, pages);
  console.log(`[tether] indexed ${body.issueKey} against ${pages.map((p) => `${p.pageId}(${p.decisionId})`).join(', ') || 'no pages'}`);
  // Compact diagnosis (no full text): lets the team compare a live run with gold without reading KVS.
  const c = (x: { attribute?: string; operator?: string; value?: unknown; unit?: string; modality?: string; scope?: unknown; conditions?: unknown }) =>
    `${x.attribute} ${x.operator} ${JSON.stringify(x.value)}${x.unit ? ' ' + x.unit : ''} [${x.modality ?? ''}] scope=${JSON.stringify(x.scope ?? {})} cond=${JSON.stringify(x.conditions ?? [])}`;
  console.log(
    `[tether] diag ${body.issueKey} ${JSON.stringify({
      via: body.via ?? 'unknown',
      jobId: body.jobId,
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      graph: body.graph ? { pages: body.graph.linkedPageIds.length, error: body.graph.error ?? null } : null,
      outcome: report.overallOutcome,
      status: report.status,
      claims: report.claims.map((x) => `${x.id}: ${c(x as never)}`),
      decisions: report.decisions.map((d) => ({ id: d.decisionId, status: d.status, v: d.source.version, constraints: d.constraints.map((x) => c(x as never)) })),
      findings: report.findings.map((f) => `${f.outcome}/${f.reason} ${f.decisionIds.join(',')}`),
      errors: report.errors.map((e) => `${e.stage}:${e.code}`),
    }).slice(0, 7000)}`,
  );
  await store.patchJob(body.jobId, {
    status: report.status === 'FAILED' ? 'FAILED' : 'DONE',
    stage: 'DONE',
    reportId: report.reportId,
    error: report.status === 'FAILED' ? report.errors[0] : undefined,
  });
}

export async function handler(event: AsyncEvent) {
  const body = event.body as unknown as AnalysisJobBody | EvalJobBody;
  if (body.kind === 'eval') {
    // An eval batch is an explicit experiment, not a retryable user analysis.
    // In particular, never re-run all LLM calls after a 900-second timeout.
    if (event.retryContext) {
      await new Queue({ key: event.queueName }).getJob(event.jobId).cancel();
      console.warn('[tether] cancelled eval retry', event.jobId);
      return;
    }
    try {
      await store.putEval({ ...await runEvalSuite(), requestedAt: body.requestedAt });
    } catch (e) {
      console.error('[tether] eval worker failed', e);
      await new Queue({ key: event.queueName }).getJob(event.jobId).cancel();
      await store.putEval({
        ranAt: new Date().toISOString(), requestedAt: body.requestedAt,
        complete: false, stoppedReason: 'EVAL_WORKER_FAILURE',
        message: 'Evaluation failed; inspect worker logs before starting another run.',
      });
    }
    return;
  }
  try {
    await runAnalysis(body);
  } catch (e) {
    console.error('[tether] analysis worker crashed', e);
    await store.patchJob(body.jobId, {
      status: 'FAILED',
      error: { stage: 'INTERNAL', code: 'WORKER_CRASH', message: (e as Error).message, retryable: true, claimIds: [] },
    });
  }
}
