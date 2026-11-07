/**
 * Rovo actions (55 s limit). The same actions back three surfaces:
 *   rovo:agent "Tether", rovo:skill "decision-consistency", and rovo:mcp (external MCP clients).
 * Inputs come from an LLM and may be wrong: never use them for authorization.
 */
import api, { route } from '@forge/api';
import { ConfluenceDecisionAdapter } from '../adapters/confluence';
import { createFollowUpIssue } from '../adapters/jira';
import { store } from '../adapters/storage';
import { buildFollowUpDraft, summarizeForAgent } from '../engine/present';
import { startAnalysisJob, waitForJob } from './jobs';

interface ActionPayload {
  issueKey?: string;
  query?: string;
  findingId?: string;
  context?: { cloudId?: string; jira?: { issueKey?: string | number; url?: string } };
  [k: string]: unknown;
}

interface ActionContext {
  accountId?: string;
  principal?: { accountId?: string };
  cloudId?: string;
  [k: string]: unknown;
}

const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

function issueKeyFrom(p: ActionPayload): string {
  const fromContext = p.context?.jira?.url ? /browse\/([A-Z][A-Z0-9_]+-\d+)/.exec(p.context.jira.url)?.[1] : undefined;
  const key = (p.issueKey ?? fromContext ?? String(p.context?.jira?.issueKey ?? '')).trim().toUpperCase();
  if (!ISSUE_KEY.test(key)) throw new Error('Please give a Jira issue key such as PAY-142.');
  return key;
}

async function siteUrl(p: ActionPayload): Promise<string> {
  if (p.context?.jira?.url) return new URL(p.context.jira.url).origin;
  const res = await api.asApp().requestJira(route`/rest/api/3/serverInfo`);
  return ((await res.json()) as { baseUrl: string }).baseUrl.replace(/\/$/, '');
}

function accountOf(ctx: ActionContext): string {
  const id = ctx.accountId ?? ctx.principal?.accountId;
  if (!id) throw new Error('No user context for this action.');
  return id;
}

/** GET check-issue-consistency: uses a fresh stored report or runs a new check (waits ~40 s). */
export async function checkIssueConsistency(payload: ActionPayload, context: ActionContext) {
  const issueKey = issueKeyFrom(payload);
  const [report, stale] = await Promise.all([store.getReport(issueKey), store.getStale(issueKey)]);
  if (report && !stale) return summarizeForAgent(report);

  const job = await startAnalysisJob({
    issueKey,
    accountId: accountOf(context),
    cloudId: payload.context?.cloudId ?? context.cloudId ?? '',
    siteUrl: await siteUrl(payload),
  });
  const done = await waitForJob(job.jobId, 40_000);
  const fresh = await store.getReport(issueKey);
  if (done?.status === 'DONE' && fresh) return summarizeForAgent(fresh);
  if (done?.status === 'FAILED') return { issueKey, overallOutcome: null, markdown: `The check failed: ${done.error?.message ?? 'unknown error'}. This is not a "no conflict" result.` };
  return { issueKey, overallOutcome: null, markdown: `The check for ${issueKey} is still running. Open the Tether panel on the issue, or ask again in a minute.` };
}

/** GET find-decisions: lists decision records the user can read, optionally filtered. */
export async function findDecisions(payload: ActionPayload, context: ActionContext) {
  const config = await store.getConfig();
  const site = await siteUrl(payload);
  const adapter = new ConfluenceDecisionAdapter(site, config.spaceKeys, config.decisionLabel, 'app', accountOf(context));
  const { decisions } = await adapter.search({ linkedPageIds: [], keywords: [] });
  const q = (payload.query ?? '').toLowerCase();
  const hits = decisions.filter((d) => !q || `${d.decisionId} ${d.title} ${d.statement} ${d.scope.service}`.toLowerCase().includes(q));
  return {
    count: hits.length,
    decisions: hits.slice(0, 20).map((d) => ({
      decisionId: d.decisionId,
      title: d.title,
      status: d.status,
      service: d.scope.service,
      environments: d.scope.environments,
      statement: d.statement,
      supersedes: d.supersedes,
      owner: d.owner?.displayName,
      url: d.source.url,
    })),
    note: 'Status ACCEPTED does not by itself mean current: check whether another accepted decision supersedes it.',
  };
}

/** CREATE create-follow-up-issue: Rovo asks the user to confirm CREATE actions. */
export async function createFollowUp(payload: ActionPayload) {
  const issueKey = issueKeyFrom(payload);
  const report = await store.getReport(issueKey);
  if (!report) throw new Error(`No Tether report for ${issueKey}. Run check-issue-consistency first.`);
  const findingId = payload.findingId ?? report.findings.find((f) => f.outcome === 'CONFLICT' || f.outcome === 'NEEDS_REVIEW')?.id;
  if (!findingId) return { created: false, message: 'No conflict or review item to follow up on.' };
  const draft = buildFollowUpDraft(report, findingId, issueKey.split('-')[0]!);
  const created = await createFollowUpIssue(draft, await siteUrl(payload));
  return { created: true, ...created, summary: draft.summary };
}
