/** UI resolvers (25 s limit): fast operations only; analysis runs in the queue worker. */
import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import type { z } from 'zod';
import {
  CreateFollowUpInput,
  GetJobInput,
  GetLatestReportInput,
  PreviewFollowUpInput,
  SeedDemoInput,
  SetConfigInput,
  StartAnalysisInput,
  type ResolverApi,
  type ResolverName,
  type ResolverResult,
  type StaleInfo,
} from '../contracts';
import { createFollowUpIssue, isJiraAdmin, JiraTicketAdapter } from '../adapters/jira';
import { store } from '../adapters/storage';
import { PortError } from '../engine/ports';
import { buildFollowUpDraft } from '../engine/present';
import { decisionStaleness } from './drift';
import { runSeedStep } from './seed';
import { startAnalysisJob, startEvalJob } from './jobs';

export interface ForgeContext {
  accountId: string;
  cloudId: string;
  siteUrl?: string;
  extension?: { issue?: { key?: string }; project?: { key?: string }; type?: string };
  [k: string]: unknown;
}

const resolver = new Resolver();

function define<N extends ResolverName>(
  name: N,
  schema: z.ZodType<ResolverApi[N]['input']> | null,
  fn: (input: ResolverApi[N]['input'], ctx: ForgeContext) => Promise<ResolverApi[N]['output']>,
) {
  resolver.define(name, async (req): Promise<ResolverResult<ResolverApi[N]['output']>> => {
    try {
      const input = schema ? schema.parse(req.payload ?? {}) : ({} as ResolverApi[N]['input']);
      return { ok: true, data: await fn(input, req.context as unknown as ForgeContext) };
    } catch (e) {
      console.error(`[tether] resolver ${name} failed`, e);
      if (e instanceof PortError) return { ok: false, error: { code: e.code, message: e.message, retryable: e.retryable } };
      return { ok: false, error: { code: 'INTERNAL', message: e instanceof Error ? e.message : String(e), retryable: false } };
    }
  });
}

const siteOf = (ctx: ForgeContext) => (ctx.siteUrl ?? '').replace(/\/$/, '');
/** Never trust the UI for the issue key when the module context provides one. */
const issueOf = (ctx: ForgeContext, fallback: string) => ctx.extension?.issue?.key ?? fallback;

define('startAnalysis', StartAnalysisInput, async ({ issueKey }, ctx) => {
  const job = await startAnalysisJob({ issueKey: issueOf(ctx, issueKey), accountId: ctx.accountId, cloudId: ctx.cloudId, siteUrl: siteOf(ctx), via: 'panel' });
  return { jobId: job.jobId };
});

define('getJob', GetJobInput, async ({ jobId }) => {
  const job = await store.getJob(jobId);
  if (!job) throw new PortError(`Unknown job ${jobId}`, 'JOB_NOT_FOUND');
  const report = job.status === 'DONE' || job.status === 'FAILED' ? ((await store.getReport(job.issueKey)) ?? null) : null;
  return { job, report };
});

define('getLatestReport', GetLatestReportInput, async ({ issueKey }, ctx) => {
  const key = issueOf(ctx, issueKey);
  const report = (await store.getReport(key)) ?? null;
  if (!report) return { report: null, stale: null };
  let stale: StaleInfo | null = await decisionStaleness(report, 'user');
  if (!stale) {
    const updated = await new JiraTicketAdapter(siteOf(ctx), 'user').getUpdatedAt(key);
    if (updated && report.ticketUpdatedAt && updated !== report.ticketUpdatedAt) {
      stale = { reason: 'TICKET_UPDATED', at: updated, decisionIds: [] };
    }
  }
  return { report, stale };
});

define('previewFollowUp', PreviewFollowUpInput, async ({ issueKey, reportId, findingId }, ctx) => {
  const key = issueOf(ctx, issueKey);
  const report = await store.getReport(key);
  if (!report || report.reportId !== reportId) throw new PortError('Report is out of date; re-run the check', 'REPORT_STALE');
  return { draft: buildFollowUpDraft(report, findingId, key.split('-')[0]!) };
});

define('createFollowUp', CreateFollowUpInput, async ({ draft }, ctx) => createFollowUpIssue(draft, siteOf(ctx)));

define('getConfig', null, async () => ({ config: await store.getConfig() }));

define('setConfig', SetConfigInput, async ({ config }) => {
  if (!(await isJiraAdmin())) throw new PortError('Only Jira admins can change Tether settings', 'FORBIDDEN', false, true);
  await store.setConfig(config);
  return { config };
});

define('runEval', null, async () => {
  if (!(await isJiraAdmin())) throw new PortError('Only Jira admins can run the eval', 'FORBIDDEN', false, true);
  await startEvalJob();
  return { queued: true as const };
});

define('getEval', null, async () => ({ result: (await store.getEval()) ?? null }));

define('seedDemo', SeedDemoInput, async ({ step }, ctx) => {
  if (!(await isJiraAdmin())) throw new PortError('Only Jira admins can load demo data', 'FORBIDDEN', false, true);
  let site = siteOf(ctx);
  if (!site) {
    const res = await api.asUser().requestJira(route`/rest/api/3/serverInfo`);
    site = ((await res.json()) as { baseUrl: string }).baseUrl.replace(/\/$/, '');
  }
  const result = await runSeedStep(step, ctx.accountId, site);
  console.log(`[tether] demo data step ${step + 1}/${result.total} (${result.title}): ${result.lines.length} item(s)`);
  return result;
});

export const handler = resolver.getDefinitions();
