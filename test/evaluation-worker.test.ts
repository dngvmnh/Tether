import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncEvent } from '@forge/events';

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(), getJob: vi.fn(), queue: vi.fn(), runSuite: vi.fn(), putEval: vi.fn(),
}));
vi.mock('@forge/events', () => ({ Queue: class {
  constructor(options: unknown) { mocks.queue(options); }
  getJob(id: string) { mocks.getJob(id); return { cancel: mocks.cancel }; }
} }));
vi.mock('../src/adapters/confluence', () => ({ ConfluenceDecisionAdapter: class {} }));
vi.mock('../src/adapters/forgeLlm', () => ({ ForgeLlmAdapter: class {} }));
vi.mock('../src/adapters/jira', () => ({ JiraTicketAdapter: class {} }));
vi.mock('../src/adapters/storage', () => ({ store: { putEval: mocks.putEval }, kvsConstraintCache: {} }));
vi.mock('../src/handlers/evalSuite', () => ({ runEvalSuite: mocks.runSuite }));
import { handler } from '../src/handlers/worker';

const event: AsyncEvent = {
  queueName: 'tether-analysis', jobId: 'eval-job-1', eventId: 'eval-event-1',
  body: { kind: 'eval', requestedAt: '2026-11-08T04:16:05Z' },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cancel.mockResolvedValue(undefined);
  mocks.putEval.mockResolvedValue(undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('evaluation worker retry control', () => {
  it('cancels even a platform retry with count zero without running models or overwriting results', async () => {
    await handler({ ...event, retryContext: { retryCount: 0, retryReason: 'PLATFORM_ERROR', retryData: null } });
    expect(mocks.queue).toHaveBeenCalledWith({ key: event.queueName });
    expect(mocks.getJob).toHaveBeenCalledWith(event.jobId);
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.runSuite).not.toHaveBeenCalled();
    expect(mocks.putEval).not.toHaveBeenCalled();
  });

  it('runs an explicitly queued batch once and tags its saved result', async () => {
    mocks.runSuite.mockResolvedValue({ complete: true, total: 30, rows: [] });
    await handler(event);
    expect(mocks.runSuite).toHaveBeenCalledOnce();
    expect(mocks.putEval).toHaveBeenCalledWith({ complete: true, total: 30, rows: [], requestedAt: event.body.requestedAt });
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it('cancels a crashed batch and records operational failure rather than rethrowing for automatic LLM replay', async () => {
    mocks.runSuite.mockRejectedValue(new Error('Suite crashed'));
    await handler(event);
    expect(mocks.runSuite).toHaveBeenCalledOnce();
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.putEval).toHaveBeenCalledWith(expect.objectContaining({
      complete: false, stoppedReason: 'EVAL_WORKER_FAILURE', requestedAt: event.body.requestedAt,
    }));
  });

  it('does not rerun a finished suite when saving the result fails', async () => {
    mocks.runSuite.mockResolvedValue({ complete: true });
    mocks.putEval.mockRejectedValueOnce(new Error('Storage unavailable'));
    await handler(event);
    expect(mocks.runSuite).toHaveBeenCalledOnce();
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.putEval).toHaveBeenLastCalledWith(expect.objectContaining({ complete: false, stoppedReason: 'EVAL_WORKER_FAILURE' }));
  });
});
