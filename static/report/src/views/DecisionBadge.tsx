import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getDecisionUsage, type DecisionUsage } from '../api/decisionUsage';
import { OUTCOME_LABEL } from '../copy';

type State = { kind: 'loading' } | { kind: 'ready'; usage: DecisionUsage } | { kind: 'error'; error: ApiError };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Confluence byline badge for a decision page. Shows how many tickets cite the decision and
 * how many of them conflict with it. Numbers come from the backend; the UI never counts itself.
 */
export function DecisionBadge({ decisionId }: { decisionId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    getDecisionUsage(decisionId)
      .then((usage) => setState({ kind: 'ready', usage }))
      .catch((e: ApiError) => setState({ kind: 'error', error: e instanceof ApiError ? e : new ApiError('NETWORK', String(e), true) }));
  }, [decisionId]);
  useEffect(load, [load]);

  if (state.kind === 'loading') {
    return (
      <p className="muted" role="status">
        Checking which tickets use this decision…
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="usage usage--error" role="alert">
        <span>Could not load ticket usage. {state.error.message}</span>
        {state.error.retryable && (
          <button type="button" className="btn" onClick={load}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const { usage } = state;
  if (usage.referencedBy === 0) {
    return <p className="muted usage usage--empty">No checked tickets reference {usage.decisionId} yet. A lack of references is not a sign the decision is unused.</p>;
  }

  const panelId = `usage-${usage.decisionId}`;
  return (
    <div className={`usage${usage.conflicts ? ' usage--conflict' : ''}`}>
      <button type="button" className="usage__summary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        <strong>{usage.decisionId}</strong>: referenced by {plural(usage.referencedBy, 'ticket', 'tickets')},{' '}
        <span className={usage.conflicts ? 'usage__conflicts' : undefined}>{plural(usage.conflicts, 'conflict', 'conflicts')}</span>
      </button>
      <p className="muted">Based on the latest check of each ticket. Unchecked tickets are not counted.</p>
      {open && (
        <ul id={panelId} className="usage__list">
          {usage.tickets.map((t) => (
            <li key={t.issueKey}>
              {t.issueKey}: <span className={t.outcome === 'CONFLICT' ? 'usage__conflicts' : undefined}>{OUTCOME_LABEL[t.outcome]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
