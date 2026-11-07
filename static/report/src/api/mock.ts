/**
 * Mock backend for UI development. Reports come from src/mocks/reports.json, generated
 * from the golden scenarios by `npm run fixtures` (repo root). Pick a scenario with the
 * dev toolbar or ?scenario=S01 in the URL.
 */
import type { AnalysisReport, Job, ResolverApi, ResolverName, ResolverResult, TetherConfig } from '../../../../src/contracts';
import { buildFollowUpDraft } from '../../../../src/engine/present';
import fixtures from '../mocks/reports.json';

export const SCENARIOS = fixtures as unknown as Record<string, { title: string; report: AnalysisReport }>;

const STAGES: Job['stage'][] = ['QUEUED', 'FETCHING_TICKET', 'RETRIEVING_DECISIONS', 'VALIDATING_DECISIONS', 'EXTRACTING_CLAIMS', 'COMPARING', 'WRITING_REPORT', 'DONE'];
const STAGE_MS = 450;

export function currentScenario(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('scenario');
  return fromUrl && SCENARIOS[fromUrl] ? fromUrl : (sessionStorage.getItem('tether.scenario') ?? 'S01');
}
export function setScenario(id: string) {
  sessionStorage.setItem('tether.scenario', id);
}

const jobs = new Map<string, { started: number; issueKey: string; scenario: string }>();
let stored: AnalysisReport | null = null;
let config: TetherConfig = {
  spaceKeys: ['ENG'],
  decisionLabel: 'tether-decision',
  models: ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  useTeamworkGraph: true,
  autoRecheckOnDecisionChange: false,
};

const ok = <T>(data: T): ResolverResult<T> => ({ ok: true, data });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockInvoke<N extends ResolverName>(name: N, input: ResolverApi[N]['input']): Promise<ResolverResult<ResolverApi[N]['output']>> {
  await delay(150);
  const i = input as Record<string, unknown>;
  type Out = ResolverResult<ResolverApi[N]['output']>;
  switch (name) {
    case 'startAnalysis': {
      if (currentScenario() === 'E_API') {
        return { ok: false, error: { code: 'HTTP_403', message: 'You do not have permission to view this issue.', retryable: false } } as Out;
      }
      const jobId = `job-${Date.now()}`;
      jobs.set(jobId, { started: Date.now(), issueKey: String(i.issueKey), scenario: currentScenario() });
      return ok({ jobId }) as Out;
    }
    case 'getJob': {
      const j = jobs.get(String(i.jobId))!;
      const idx = Math.min(STAGES.length - 1, Math.floor((Date.now() - j.started) / STAGE_MS));
      const stage = STAGES[idx]!;
      const done = stage === 'DONE';
      const report = done ? SCENARIOS[j.scenario]!.report : null;
      if (report) stored = report;
      const now = new Date().toISOString();
      const failed = done && report?.status === 'FAILED';
      const job: Job = {
        jobId: String(i.jobId),
        issueKey: j.issueKey,
        status: failed ? 'FAILED' : done ? 'DONE' : idx === 0 ? 'QUEUED' : 'RUNNING',
        stage,
        createdAt: now,
        updatedAt: now,
        reportId: report?.reportId,
        error: failed ? report!.errors[0] : undefined,
      };
      return ok({ job, report }) as Out;
    }
    case 'getLatestReport':
      return ok({ report: stored, stale: null }) as Out;
    case 'previewFollowUp': {
      if (!stored) return { ok: false, error: { code: 'REPORT_STALE', message: 'Run the check first', retryable: false } } as Out;
      return ok({ draft: buildFollowUpDraft(stored, String(i.findingId), stored.issueKey.split('-')[0]!) }) as Out;
    }
    case 'createFollowUp':
      await delay(600);
      return ok({ issueKey: 'PAY-999', url: 'https://example.atlassian.net/browse/PAY-999' }) as Out;
    case 'getConfig':
      return ok({ config }) as Out;
    case 'setConfig':
      config = (i as { config: TetherConfig }).config;
      return ok({ config }) as Out;
    default:
      return { ok: false, error: { code: 'UNKNOWN', message: `No mock for ${name}`, retryable: false } } as Out;
  }
}
