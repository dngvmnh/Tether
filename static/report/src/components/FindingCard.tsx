import { useState } from 'react';
import type { Finding, ScopeCheckValue } from '../../../../src/contracts';
import { openUrl } from '../api/client';
import { REASON_COPY } from '../copy';
import { OutcomeLozenge } from './Verdict';

const MARK: Record<ScopeCheckValue, string> = { MATCH: '✓', MISMATCH: '✕', UNKNOWN: '?' };

function Quote({ who, quote, url, title }: { who: string; quote: string; url?: string; title?: string }) {
  return (
    <figure className="quote">
      <figcaption>{who}</figcaption>
      <blockquote>“{quote}”</blockquote>
      {url && (
        <button type="button" className="link" onClick={() => openUrl(url)}>
          {title ?? 'Open source'} ↗
        </button>
      )}
    </figure>
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
              <li className={`chip chip--${sc.service}`}>{MARK[sc.service]} service</li>
              <li className={`chip chip--${sc.environment}`}>{MARK[sc.environment]} environment</li>
              <li className={`chip chip--${sc.conditions}`}>{MARK[sc.conditions]} conditions</li>
              <li className={`chip chip--${sc.counting}`}>{MARK[sc.counting]} counting</li>
              <li className="chip chip--method">{finding.method.toLowerCase()}</li>
            </ul>
          )}
          {finding.history.length > 0 && (
            <ol className="history" aria-label="Decision history">
              {finding.history.map((h) => (
                <li key={h.decisionId} className={h.current ? 'history--current' : 'history--old'}>
                  <button type="button" className="link" onClick={() => openUrl(h.url)}>
                    {h.decisionId}
                  </button>{' '}
                  {h.current
                    ? `${h.status.toLowerCase()}, current`
                    : h.supersededBy.length
                      ? `superseded by ${h.supersededBy.join(', ')}`
                      : h.status.toLowerCase()}
                </li>
              ))}
            </ol>
          )}
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
