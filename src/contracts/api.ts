/**
 * Resolver API between the Custom UI (static/report) and the Forge backend.
 * Both sides import this file: the backend for input validation, the UI for types.
 *
 * Calling convention from the UI:  invoke<'startAnalysis'>('startAnalysis', { issueKey })
 */
import { z } from 'zod';
import type {
  AnalysisReport,
  FollowUpDraft,
  Job,
  StaleInfo,
  TetherConfig,
} from './schema';
import { FollowUpDraft as FollowUpDraftSchema, TetherConfig as TetherConfigSchema } from './schema';

export const StartAnalysisInput = z.object({ issueKey: z.string().min(1) });
export const GetJobInput = z.object({ jobId: z.string().min(1) });
export const GetLatestReportInput = z.object({ issueKey: z.string().min(1) });
export const PreviewFollowUpInput = z.object({
  issueKey: z.string().min(1),
  reportId: z.string().min(1),
  findingId: z.string().min(1),
});
export const CreateFollowUpInput = z.object({ draft: FollowUpDraftSchema });
export const SetConfigInput = z.object({ config: TetherConfigSchema });

export interface ResolverApi {
  /** Queues an analysis for the issue. Returns immediately. */
  startAnalysis: { input: z.infer<typeof StartAnalysisInput>; output: { jobId: string } };
  /** Poll every ~1.5 s while status is QUEUED/RUNNING. */
  getJob: {
    input: z.infer<typeof GetJobInput>;
    output: { job: Job; report: AnalysisReport | null };
  };
  /** Latest stored report for the issue, plus whether it is stale. */
  getLatestReport: {
    input: z.infer<typeof GetLatestReportInput>;
    output: { report: AnalysisReport | null; stale: StaleInfo | null };
  };
  /** Builds an editable follow-up issue draft. Creates nothing. */
  previewFollowUp: {
    input: z.infer<typeof PreviewFollowUpInput>;
    output: { draft: FollowUpDraft };
  };
  /** Creates the (user-reviewed) follow-up issue as the current user. */
  createFollowUp: {
    input: z.infer<typeof CreateFollowUpInput>;
    output: { issueKey: string; url: string };
  };
  getConfig: { input: Record<string, never>; output: { config: TetherConfig } };
  setConfig: { input: z.infer<typeof SetConfigInput>; output: { config: TetherConfig } };
}

export type ResolverName = keyof ResolverApi;

/** Every resolver returns this envelope so the UI can tell API failures from results. */
export type ResolverResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };
