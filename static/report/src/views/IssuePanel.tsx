import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisReport, Finding, Job, StaleInfo } from '../../../../src/contracts';
import { ApiError, call } from '../api/client';
import { FindingCard } from '../components/FindingCard';
import { FollowUpModal } from '../components/FollowUpModal';
import { VerdictBanner } from '../components/Verdict';
import { ERROR_STAGE_COPY, OUTCOME_RANK, STAGE_LABEL, STAGE_ORDER, STALE_COPY, formatChangedAt } from '../copy';

type State =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'running'; job: Job }
  | { kind: 'report'; report: AnalysisReport; stale: StaleInfo | null }
  | { kind: 'error'; error: ApiError };

const POLL_MS = 1500;

/**
 * The panel body swaps whole views as state changes, so a screen reader would miss the change.
 * This wrapper keeps one polite live region mounted and the body reports progress/results to it.
 */
export function IssuePanel({ issueKey }: { issueKey: string }) {
  const [announcement, setAnnouncement] = useState('');
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <PanelBody issueKey={issueKey} announce={setAnnouncement} />
    </>
  );
}

function PanelBody({ issueKey, announce }: { issueKey: string; announce: (message: string) => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [followUp, setFollowUp] = useState<Finding | null>(null);
  const timer = useRef<number>();

  // False once the panel unmounts (e.g. the mock scenario changes): stops late responses
  // from restarting the poll loop or touching state.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    call('getLatestReport', { issueKey })
      .then(({ report, stale }) => alive.current && setState(report ? { kind: 'report', report, stale } : { kind: 'idle' }))
      .catch((error: ApiError) => alive.current && setState({ kind: 'error', error }));
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, [issueKey]);

  const poll = useCallback(async (jobId: string) => {
    try {
      const { job, report } = await call('getJob', { jobId });
      if (!alive.current) return;
      const finished = job.status === 'DONE' || job.status === 'FAILED';
      // Never show a stored report that belongs to an earlier run (e.g. the worker crashed).
      const mine = report && job.reportId && report.reportId === job.reportId ? report : null;
      if (finished && mine) {
        announce(`Check complete. ${mine.headline}`);
        setState({ kind: 'report', report: mine, stale: null });
      }
      else if (finished) {
        setState({
          kind: 'error',
          error: new ApiError(
            job.error?.code ?? 'NO_REPORT',
            job.error?.message ?? 'The check finished without producing a report.',
            job.error?.retryable ?? true,
          ),
        });
      } else {
        announce(STAGE_LABEL[job.stage] ?? 'Checking');
        setState({ kind: 'running', job });
        timer.current = window.setTimeout(() => void poll(jobId), POLL_MS);
      }
    } catch (e) {
      if (alive.current) setState({ kind: 'error', error: e as ApiError });
    }
  }, [announce]);

  async function run() {
    try {
      const { jobId } = await call('startAnalysis', { issueKey });
      if (alive.current) void poll(jobId);
    } catch (e) {
      if (alive.current) setState({ kind: 'error', error: e as ApiError });
    }
  }

  if (state.kind === 'loading') return <p className="muted" role="status">Loading…</p>;

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
      <div className="running">
        <ol className="stages" aria-label="Check progress">
          {STAGE_ORDER.map((s, i) => {
            const cur = Math.max(0, STAGE_ORDER.indexOf(state.job.stage));
            const status = i < cur ? 'done' : i === cur ? 'current' : 'pending';
            return (
              <li key={s} className={`stage stage--${status}`} aria-current={status === 'current' ? 'step' : undefined}>
                <span className="stage__icon" aria-hidden>
                  {status === 'done' ? '✓' : status === 'current' ? <span className="spinner" /> : '○'}
                </span>
                {STAGE_LABEL[s]}
                {status === 'current' ? '…' : ''}
              </li>
            );
          })}
        </ol>
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
        <div className="banner banner--stale" role="status">
          <div className="banner__text">
            <strong className="banner__headline">{STALE_COPY[stale.reason].title}</strong>
            <div className="banner__sub">
              {STALE_COPY[stale.reason].detail}
              {stale.reason === 'DECISION_UPDATED' && stale.decisionIds.length > 0 && (
                <>
                  {' '}
                  Updated decision: <strong>{stale.decisionIds.join(', ')}</strong>.
                </>
              )}
              {formatChangedAt(stale.at) && <> Detected {formatChangedAt(stale.at)}.</>}
            </div>
          </div>
          <button type="button" className="btn" onClick={run} aria-label="Re-check this ticket now">
            Re-check
          </button>
        </div>
      )}
      <VerdictBanner report={report} />
      {report.errors.length > 0 && (
        <section className="errors" aria-label="Problems during the check">
          <h3>{report.status === 'FAILED' ? 'What went wrong' : 'Some parts could not be checked'}</h3>
          <ul>
            {report.errors.map((e, i) => (
              <li key={i}>
                {ERROR_STAGE_COPY[e.stage]}
                <details>
                  <summary>Technical detail</summary>
                  <code>{e.stage}</code> {e.message}
                </details>
              </li>
            ))}
          </ul>
          {report.errors.some((e) => e.retryable) && (
            <button type="button" className="btn" onClick={run}>
              Try again
            </button>
          )}
        </section>
      )}
      {findings.length === 0 && report.status !== 'FAILED' ? (
        <p className="empty-findings">
          {report.coverage.totalClaims === 0
            ? 'No technical requirements were found in this ticket, so there was nothing to compare with your decisions.'
            : 'No findings to show for this ticket.'}
        </p>
      ) : (
        <section className="findings" aria-label="Findings">
          {findings.map((f) => (
            <FindingCard key={f.id} finding={f} onFollowUp={setFollowUp} />
          ))}
        </section>
      )}
      <footer className="muted footer">
        {report.context.decisionsConsidered === 0 && report.coverage.totalClaims > 0 ? (
          <>
            No decisions found labelled <code>{report.context.decisionLabel}</code> in {report.context.spacesSearched.join(', ') || 'no spaces'}
          </>
        ) : (
          <>
            Checked against {report.context.decisionsConsidered} decision(s) labelled <code>{report.context.decisionLabel}</code> in{' '}
            {report.context.spacesSearched.join(', ') || 'no spaces'}
          </>
        )}
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
