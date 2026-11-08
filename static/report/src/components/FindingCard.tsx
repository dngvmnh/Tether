import { useState } from 'react';
import type { Finding, ScopeCheckValue } from '../../../../src/contracts';
import { openUrl } from '../api/client';
import { DECISION_STATUS_COPY, HISTORY_HEADING, REASON_COPY } from '../copy';
import { OutcomeLozenge } from './Verdict';

const MARK: Record<ScopeCheckValue, string> = { MATCH: '✓', MISMATCH: '✕', UNKNOWN: '?' };
const MARK_TEXT: Record<ScopeCheckValue, string> = { MATCH: 'matches', MISMATCH: 'does not match', UNKNOWN: 'could not be determined' };

function ScopeChip({ name, value }: { name: string; value: ScopeCheckValue }) {
  return (
    <li className={`chip chip--${value}`}>
      <span aria-hidden>{MARK[value]}</span> {name}
      <span className="sr-only">: {MARK_TEXT[value]}</span>
    </li>
  );
}

function Quote({ who, quote, url, title }: { who: string; quote: string; url?: string; title?: string }) {
  return (
    <figure className="quote">
      <figcaption>{who}</figcaption>
      <blockquote>“{quote}”</blockquote>
      {url && (
        <button type="button" className="link" onClick={() => openUrl(url)}>
          {title ?? 'Open source'} <span aria-hidden>↗</span>
        </button>
      )}
    </figure>
  );
}

/** Decision lineage for one finding. Only shows relationships present in the data. */
function DecisionHistory({ finding }: { finding: Finding }) {
  const { history } = finding;
  if (history.length === 0) return null;
  const byId = new Map(history.map((h) => [h.decisionId, h]));
  const headingId = `history-${finding.id}`;
  return (
    <section className="history" aria-labelledby={headingId}>
      <h4 id={headingId} className="history__heading">
        {history.length > 1 ? HISTORY_HEADING : 'Decision'}
      </h4>
      <ol className="history__list">
        {history.map((h) => {
          const title = h.title.trim();
          const showTitle = title !== '' && title !== h.decisionId;
          const copy = DECISION_STATUS_COPY[h.status];
          const note = h.supersededBy.length > 0 ? null : h.current && h.status === 'ACCEPTED' ? null : copy.hint;
          return (
            <li key={h.decisionId} className={`history__item ${h.current ? 'history__item--current' : 'history__item--old'}`}>
              <div className="history__row">
                <span className={h.current ? 'history__name' : 'history__name history__name--old'}>
                  {h.url ? (
                    <button type="button" className="link" onClick={() => openUrl(h.url)}>
                      {h.decisionId}
                    </button>
                  ) : (
                    <span>{h.decisionId}</span>
                  )}
                  {showTitle && <span className="history__title"> {title}</span>}
                </span>
                <span className={`history__status history__status--${h.current ? 'CURRENT' : h.status}`}>
                  {h.current ? 'Current' : copy.label}
                </span>
              </div>
              {h.supersededBy.length > 0 && (
                <div className="history__note">
                  Replaced by{' '}
                  {h.supersededBy.map((id, i) => {
                    const target = byId.get(id);
                    return (
                      <span key={id}>
                        {i > 0 && ', '}
                        {target?.url ? (
                          <button type="button" className="link" onClick={() => openUrl(target.url)}>
                            {id}
                          </button>
                        ) : (
                          id
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              {note && <div className="history__note">{note[0]!.toUpperCase() + note.slice(1)}.</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function FindingCard({ finding, onFollowUp }: { finding: Finding; onFollowUp?: (f: Finding) => void }) {
  const [open, setOpen] = useState(finding.outcome === 'CONFLICT' || finding.outcome === 'NEEDS_REVIEW');
  const canFollowUp = finding.suggestedActions.some((a) => a.kind === 'CREATE_FOLLOW_UP');
  const sc = finding.scopeCheck;
  return (
    <article className={`finding finding--${finding.outcome}`}>
      <button type="button" className="finding__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <OutcomeLozenge outcome={finding.outcome} />
        <span className="finding__headline">{finding.headline}</span>
        <span aria-hidden className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="finding__body">
          <div className="quotes">
            <Quote who={`This ticket (${finding.ticketEvidence.location ?? 'text'})`} quote={finding.ticketEvidence.quote} />
            {finding.decisionEvidence.map((e) => (
              <Quote key={e.id + e.quote} who={e.title} quote={e.quote} url={e.url} title="Open decision" />
            ))}
          </div>
          <p className="explanation">
            {finding.explanation} {REASON_COPY[finding.reason] && <em>{REASON_COPY[finding.reason]}</em>}
          </p>
          {finding.method !== 'NONE' && (
            <ul className="chips" aria-label="Scope check">
              <ScopeChip name="service" value={sc.service} />
              <ScopeChip name="environment" value={sc.environment} />
              <ScopeChip name="conditions" value={sc.conditions} />
              <ScopeChip name="counting" value={sc.counting} />
              <li className="chip chip--method">{finding.method.toLowerCase()}</li>
            </ul>
          )}
          <DecisionHistory finding={finding} />

          <div className="actions">
            {finding.suggestedActions
              .filter((a) => a.kind !== 'CREATE_FOLLOW_UP')
              .map((a) => (
                <span key={a.label} className="action-hint">
                  → {a.label}
                </span>
              ))}
            {canFollowUp && onFollowUp && (
              <button type="button" className="btn btn--primary" onClick={() => onFollowUp(finding)}>
                Create clarification issue
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
