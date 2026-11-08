import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisReport, Finding, Job, StaleInfo } from '../../../../src/contracts';
import { ApiError, call } from '../api/client';
import { FindingCard } from '../components/FindingCard';
import { FollowUpModal } from '../components/FollowUpModal';
import { VerdictBanner } from '../components/Verdict';
import { OUTCOME_RANK, STAGE_LABEL } from '../copy';

type State =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'running'; job: Job }
  | { kind: 'report'; report: AnalysisReport; stale: StaleInfo | null }
  | { kind: 'error'; error: ApiError };

const POLL_MS = 1500;

export function IssuePanel({ issueKey }: { issueKey: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [followUp, setFollowUp] = useState<Finding | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    call('getLatestReport', { issueKey })
      .then(({ report, stale }) => setState(report ? { kind: 'report', report, stale } : { kind: 'idle' }))
      .catch((error: ApiError) => setState({ kind: 'error', error }));
    return () => window.clearTimeout(timer.current);
  }, [issueKey]);

  const poll = useCallback(async (jobId: string) => {
    try {
      const { job, report } = await call('getJob', { jobId });
      if ((job.status === 'DONE' || job.status === 'FAILED') && report) setState({ kind: 'report', report, stale: null });
      else if (job.status === 'FAILED') setState({ kind: 'error', error: new ApiError(job.error?.code ?? 'FAILED', job.error?.message ?? 'Check failed', true) });
      else {
        setState({ kind: 'running', job });
        timer.current = window.setTimeout(() => void poll(jobId), POLL_MS);
      }
    } catch (e) {
      setState({ kind: 'error', error: e as ApiError });
    }
  }, []);

  async function run() {
    // Immediate feedback: startAnalysis reads the issue and Teamwork Graph before it returns.
    setState({ kind: 'loading' });
    try {
      const { jobId } = await call('startAnalysis', { issueKey });
      void poll(jobId);
    } catch (e) {
      setState({ kind: 'error', error: e as ApiError });
    }
  }

  if (state.kind === 'loading') return <p className="muted" aria-live="polite">Loading…</p>;

  if (state.kind === 'idle') {
    return (
      <div className="empty">
        <p>Check whether this ticket contradicts decisions your team has already made in Confluence.</p>
        <button type="button" className="btn btn--primary" onClick={run}>
          Check implementation context
        </button>
      </div>
    );
  }

  if (state.kind === 'running') {
    return (
      <div className="running" aria-live="polite">
        <span className="spinner" aria-hidden /> {STAGE_LABEL[state.job.stage]}…
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="banner banner--FAILED" role="alert">
        <strong>Tether could not run the check.</strong> {state.error.message}
        <div className="banner__sub">This is an API or permission problem, not an analysis result.</div>
        {state.error.retryable && (
          <button type="button" className="btn" onClick={run}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const { report, stale } = state;
  const findings = [...report.findings].sort((a, b) => OUTCOME_RANK[a.outcome] - OUTCOME_RANK[b.outcome]);
  return (
    <div className="panel">
      {stale && (
        <div className="banner banner--stale">
          {stale.reason === 'DECISION_UPDATED'
            ? `A decision used in this check changed (${stale.decisionIds.join(', ')}).`
            : 'This ticket changed since the last check.'}{' '}
          <button type="button" className="btn" onClick={run}>
            Re-check
          </button>
        </div>
      )}
      <VerdictBanner report={report} />
      {report.errors.length > 0 && report.status !== 'FAILED' && (
        <section className="errors" aria-label="Problems during the check">
          <h3>Some parts could not be checked</h3>
          <ul>
            {report.errors.map((e, i) => (
              <li key={i}>
                <code>{e.stage}</code> {e.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="findings" aria-label="Findings">
        {findings.map((f) => (
          <FindingCard key={f.id} finding={f} onFollowUp={setFollowUp} />
        ))}
      </section>
      <footer className="muted footer">
        Checked against {report.context.decisionsConsidered} decision(s) labelled <code>{report.context.decisionLabel}</code> in{' '}
        {report.context.spacesSearched.join(', ') || 'no spaces'}
        {report.context.graph.note ? ` · ${report.context.graph.note}` : ''} · {new Date(report.generatedAt).toLocaleString()}
        <br />A lack of detected conflict is not proof of complete consistency.{' '}
        <button type="button" className="link" onClick={run}>
          Re-run check
        </button>
      </footer>
      {followUp && <FollowUpModal report={report} finding={followUp} onClose={() => setFollowUp(null)} />}
    </div>
  );
}
