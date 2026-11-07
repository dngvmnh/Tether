/**
 * Forge KVS persistence (owner: integration). Key layout:
 *   job:<jobId>                      Job
 *   report:<issueKey>                latest AnalysisReport
 *   stale:<issueKey>                 StaleInfo
 *   dindex:<pageId>:<issueKey>       { issueKey, decisionId }  (drift detection)
 *   dcache:<pageId>:<version>        Claim[] extracted from a decision version
 *   config                           TetherConfig
 *   eval:latest                      last eval run
 * KVS values are limited to 240 KiB: keep reports lean.
 */
import { kvs, WhereConditions } from '@forge/kvs';
import { TetherConfig, type AnalysisReport, type Claim, type Job, type StaleInfo } from '../contracts';
import type { ConstraintCache } from '../engine/ports';

export const store = {
  getJob: (id: string) => kvs.get<Job>(`job:${id}`),
  putJob: (job: Job) => kvs.set(`job:${job.jobId}`, job),
  async patchJob(id: string, patch: Partial<Job>) {
    const j = await kvs.get<Job>(`job:${id}`);
    if (j) await kvs.set(`job:${id}`, { ...j, ...patch, updatedAt: new Date().toISOString() });
  },

  getReport: (issueKey: string) => kvs.get<AnalysisReport>(`report:${issueKey}`),
  putReport: (r: AnalysisReport) => kvs.set(`report:${r.issueKey}`, r),

  getStale: (issueKey: string) => kvs.get<StaleInfo>(`stale:${issueKey}`),
  putStale: (issueKey: string, s: StaleInfo) => kvs.set(`stale:${issueKey}`, s),
  clearStale: (issueKey: string) => kvs.delete(`stale:${issueKey}`),

  async indexDecisions(issueKey: string, pages: Array<{ pageId: string; decisionId: string }>) {
    for (const p of pages) await kvs.set(`dindex:${p.pageId}:${issueKey}`, { issueKey, decisionId: p.decisionId });
  },
  async issuesCheckedAgainst(pageId: string): Promise<Array<{ issueKey: string; decisionId: string }>> {
    const out: Array<{ issueKey: string; decisionId: string }> = [];
    let cursor: string | undefined;
    do {
      let q = kvs.query().where('key', WhereConditions.beginsWith(`dindex:${pageId}:`)).limit(50);
      if (cursor) q = q.cursor(cursor);
      const page = await q.getMany<{ issueKey: string; decisionId: string }>();
      out.push(...page.results.map((r) => r.value));
      cursor = page.nextCursor;
    } while (cursor);
    return out;
  },

  async getConfig(): Promise<TetherConfig> {
    return TetherConfig.parse((await kvs.get('config')) ?? {});
  },
  setConfig: (c: TetherConfig) => kvs.set('config', c),

  getEval: () => kvs.get('eval:latest'),
  putEval: (v: unknown) => kvs.set('eval:latest', v),
};

export const kvsConstraintCache: ConstraintCache = {
  get: (key) => kvs.get<Claim[]>(`dcache:${key}`),
  set: async (key, value) => {
    await kvs.set(`dcache:${key}`, value);
  },
};
