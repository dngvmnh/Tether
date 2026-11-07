/** Job orchestration shared by the resolver, Rovo actions and triggers. */
import { Queue } from '@forge/events';
import type { Job } from '../contracts';
import { linkedPagesFromRemoteLinks, TeamworkGraphAdapter } from '../adapters/teamworkGraph';
import { JiraTicketAdapter } from '../adapters/jira';
import { store } from '../adapters/storage';
import type { GraphContext } from '../engine/ports';

export const QUEUE_KEY = 'tether-analysis';
const queue = new Queue({ key: QUEUE_KEY });

export interface AnalysisJobBody {
  kind: 'analysis';
  jobId: string;
  issueKey: string;
  siteUrl: string;
  accountId: string;
  /** Precomputed in user context (Teamwork Graph is asUser-only). */
  graph: (GraphContext & { error?: string }) | null;
  [k: string]: unknown;
}

export interface EvalJobBody {
  kind: 'eval';
  requestedAt: string;
  [k: string]: unknown;
}

export async function graphContextAsUser(cloudId: string, issueKey: string, siteUrl: string, useGraph: boolean) {
  const ticket = await new JiraTicketAdapter(siteUrl, 'user').getTicket(issueKey);
  if (useGraph) {
    try {
      return await new TeamworkGraphAdapter(cloudId).contextFor(ticket);
    } catch (e) {
      const ids = await linkedPagesFromRemoteLinks(issueKey);
      return { linkedPageIds: ids, ownerTeams: {}, note: 'Teamwork Graph unavailable; used Jira remote links.', error: (e as Error).message };
    }
  }
  return { linkedPageIds: await linkedPagesFromRemoteLinks(issueKey), ownerTeams: {}, note: 'Teamwork Graph disabled; used Jira remote links.' };
}

/**
 * Must be called from a user-invoked function (resolver / Rovo action). Verifies the
 * user can see the issue (getTicket asUser throws otherwise) before queueing.
 */
export async function startAnalysisJob(args: { issueKey: string; accountId: string; cloudId: string; siteUrl: string }): Promise<Job> {
  const config = await store.getConfig();
  const graph = await graphContextAsUser(args.cloudId, args.issueKey, args.siteUrl, config.useTeamworkGraph);
  const now = new Date().toISOString();
  const job: Job = { jobId: globalThis.crypto.randomUUID(), issueKey: args.issueKey, status: 'QUEUED', stage: 'QUEUED', createdAt: now, updatedAt: now };
  await store.putJob(job);
  const body: AnalysisJobBody = { kind: 'analysis', jobId: job.jobId, issueKey: args.issueKey, siteUrl: args.siteUrl, accountId: args.accountId, graph };
  await queue.push({ body });
  return job;
}

export async function startEvalJob(): Promise<void> {
  const body: EvalJobBody = { kind: 'eval', requestedAt: new Date().toISOString() };
  await queue.push({ body });
}

export async function waitForJob(jobId: string, budgetMs: number): Promise<Job | undefined> {
  const deadline = Date.now() + budgetMs;
  let job = await store.getJob(jobId);
  while (job && (job.status === 'QUEUED' || job.status === 'RUNNING') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    job = await store.getJob(jobId);
  }
  return job;
}
