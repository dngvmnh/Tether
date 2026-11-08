/**
 * Mock backend for UI development. Reports come from src/mocks/reports.json, generated
 * from the golden scenarios by `npm run fixtures` (repo root). Pick a scenario with the
 * dev toolbar or ?scenario=S01 in the URL.
 */
import type { AnalysisReport, Job, ResolverApi, ResolverName, ResolverResult, StaleInfo, TetherConfig } from '../../../../src/contracts';
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
  // A ?scenario= in the URL wins in currentScenario(), so keep the URL in sync with the picker.
  const url = new URL(window.location.href);
  if (url.searchParams.has('scenario')) {
    url.searchParams.set('scenario', id);
    window.history.replaceState(null, '', url);
  }
  stored = null; // a report from the previous scenario must not carry over
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

const failedOnce = { preview: 0, create: false, load: 0, save: false };
const settingsMode = () => new URLSearchParams(window.location.search).get('settings');
const followUpMode = () => new URLSearchParams(window.location.search).get('followup');

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
    case 'getLatestReport': {
      // ?state=report | stale-ticket | stale-decision opens the panel with a report already stored.
      const state = new URLSearchParams(window.location.search).get('state');
      if (state === 'report' || state === 'stale-ticket' || state === 'stale-decision') {
        const report = SCENARIOS[currentScenario()]!.report;
        stored = report;
        const at = new Date().toISOString();
        const stale: StaleInfo | null =
          state === 'stale-ticket'
            ? { reason: 'TICKET_UPDATED', at, decisionIds: [] }
            : state === 'stale-decision'
              ? { reason: 'DECISION_UPDATED', at, decisionIds: report.findings[0]?.decisionIds.slice(0, 1) ?? [] }
              : null;
        return ok({ report, stale }) as Out;
      }
      return ok({ report: stored, stale: null }) as Out;
    }
    case 'previewFollowUp': {
      // ?followup=preview-fail makes the first open fail so the retry path can be tested.
      // Two calls fail because React StrictMode (dev) runs the modal's load effect twice.
      if (followUpMode() === 'preview-fail' && failedOnce.preview < 2) {
        failedOnce.preview++;
        return { ok: false, error: { code: 'HTTP_503', message: 'Jira is temporarily unavailable.', retryable: true } } as Out;
      }
      if (!stored) return { ok: false, error: { code: 'REPORT_STALE', message: 'Run the check first', retryable: false } } as Out;
      return ok({ draft: buildFollowUpDraft(stored, String(i.findingId), stored.issueKey.split('-')[0]!) }) as Out;
    }
    case 'createFollowUp':
      await delay(600);
      if (followUpMode() === 'create-fail-once' && !failedOnce.create) {
        failedOnce.create = true;
        return { ok: false, error: { code: 'HTTP_500', message: 'Jira could not create the issue.', retryable: true } } as Out;
      }
      return ok({ issueKey: 'PAY-999', url: 'https://example.atlassian.net/browse/PAY-999' }) as Out;
    case 'getConfig': {
      // ?settings=load-fail makes the first load fail (two calls: React StrictMode runs effects twice in dev).
      if (settingsMode() === 'load-fail' && failedOnce.load < 2) {
        failedOnce.load++;
        return { ok: false, error: { code: 'HTTP_503', message: 'Forge storage is temporarily unavailable.', retryable: true } } as Out;
      }
      return ok({ config }) as Out;
    }
    case 'setConfig': {
      await delay(400);
      // ?settings=forbidden mimics a non-admin; ?settings=save-fail-once fails the first save.
      if (settingsMode() === 'forbidden') {
        return { ok: false, error: { code: 'FORBIDDEN', message: 'Only Jira admins can change Tether settings', retryable: false } } as Out;
      }
      if (settingsMode() === 'save-fail-once' && !failedOnce.save) {
        failedOnce.save = true;
        return { ok: false, error: { code: 'HTTP_500', message: 'Forge storage write failed.', retryable: true } } as Out;
      }
      config = (i as { config: TetherConfig }).config;
      return ok({ config }) as Out;
    }
    case 'runEval':
      return ok({ queued: true }) as Out;
    case 'getEval':
      return ok({ result: null }) as Out;
    default:
      return { ok: false, error: { code: 'UNKNOWN', message: `No mock for ${name}`, retryable: false } } as Out;
  }
}
