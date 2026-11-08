import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { AnalysisReport, Finding, FollowUpDraft, StaleInfo } from '../../../../src/contracts';
import { ApiError, call, openUrl } from '../api/client';
import { STALE_COPY } from '../copy';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';

const failureText = (e: ApiError) => (e.retryable ? `${e.message} You can try again.` : e.message);

/**
 * Preview -> user edits -> explicit confirm. Tether never creates issues silently:
 * the issue is only created by clicking "Create issue" (Enter does not submit).
 */
export function FollowUpModal({ report, finding, stale = null, onClose }: { report: AnalysisReport; finding: Finding; stale?: StaleInfo | null; onClose: () => void }) {
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [createError, setCreateError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ issueKey: string; url: string } | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const introId = useId();

  // Take focus on open; give it back to whatever opened the dialog on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Only the latest preview request may update state (a slow older response must not win).
  const loadSeq = useRef(0);
  const loadDraft = useCallback(() => {
    const seq = ++loadSeq.current;
    setLoadError(null);
    setDraft(null);
    call('previewFollowUp', { issueKey: report.issueKey, reportId: report.reportId, findingId: finding.id })
      .then((r) => seq === loadSeq.current && setDraft(r.draft))
      .catch((e: ApiError) => seq === loadSeq.current && setLoadError(e));
  }, [report.issueKey, report.reportId, finding.id]);

  useEffect(loadDraft, [loadDraft]);

  // Disabling the focused control drops focus to <body>, which would break Escape and the Tab
  // trap. Keep focus inside the dialog while busy, and put it back on the form afterwards.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (busy) dialog.focus();
    else if (!dialog.contains(document.activeElement) || document.activeElement === dialog) (summaryRef.current ?? dialog).focus();
  }, [busy]);

  // Move focus to the first field when the draft is ready, and to Close after success.
  const hasDraft = draft !== null;
  useEffect(() => {
    if (hasDraft && !created) summaryRef.current?.focus();
  }, [hasDraft, created]);
  useEffect(() => {
    if (created) closeRef.current?.focus();
  }, [created]);

  async function create() {
    if (!draft || busy || !draft.summary.trim()) return;
    setBusy(true);
    setCreateError(null);
    try {
      setCreated(await call('createFollowUp', { draft }));
    } catch (e) {
      setCreateError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      // Never abandon a request that is in flight.
      if (!busy) {
        e.stopPropagation();
        onClose();
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={created ? undefined : introId}
        aria-busy={busy}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>Create clarification issue</h2>

        {created ? (
          <p role="status">
            Created{' '}
            <button type="button" className="link" onClick={() => openUrl(created.url)}>
              {created.issueKey}
            </button>
            , linked to {report.issueKey} and the decision page(s). The original issue and decisions were not changed.
          </p>
        ) : (
          <>
            <p id={introId} className="muted modal__intro">
              Review the draft below. Nothing is created until you click “Create issue”.
            </p>
            {stale && (
              <div className="banner banner--stale" role="note">
                <div className="banner__text">
                  <strong className="banner__headline">This finding may be out of date.</strong>
                  <div className="banner__sub">
                    {STALE_COPY[stale.reason].title}. Close this and re-check the ticket first, or create the issue only if you have verified the conflict still applies.
                  </div>
                </div>
              </div>
            )}
            {loadError && (
              <div className="banner banner--FAILED" role="alert">
                <strong>Could not prepare the draft.</strong> {failureText(loadError)}
                <div className="banner__sub">
                  <button type="button" className="btn" onClick={loadDraft}>
                    Try again
                  </button>
                </div>
              </div>
            )}
            {!draft && !loadError && (
              <p role="status" aria-live="polite">
                Preparing draft…
              </p>
            )}
            {draft && (
              <>
                {createError && (
                  <div className="banner banner--FAILED" role="alert">
                    <strong>The issue was not confirmed as created.</strong> {failureText(createError)}
                    <div className="banner__sub">Your edits are kept. Check the project in Jira before trying again.</div>
                  </div>
                )}
                <label>
                  Summary
                  <input
                    ref={summaryRef}
                    value={draft.summary}
                    maxLength={255}
                    disabled={busy}
                    aria-invalid={!draft.summary.trim()}
                    onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea rows={10} value={draft.descriptionText} disabled={busy} onChange={(e) => setDraft({ ...draft, descriptionText: e.target.value })} />
                </label>
                <p className="muted">
                  Project {draft.projectKey} · {draft.issueTypeName} · links {draft.linkedIssueKey}
                  {draft.decisionLinks.length ? ` and ${draft.decisionLinks.map((d) => d.title).join(', ')}` : ''}. The original issue and
                  decisions are not changed.
                </p>
              </>
            )}
          </>
        )}

        <div className="modal__actions">
          {!created && (
            <button type="button" className="btn" disabled={busy} onClick={onClose}>
              Cancel
            </button>
          )}
          {!created ? (
            <button type="button" className="btn btn--primary" disabled={!draft || busy || !draft.summary.trim()} onClick={create}>
              {busy ? 'Creating…' : createError ? 'Try again' : 'Create issue'}
            </button>
          ) : (
            <button type="button" className="btn btn--primary" ref={closeRef} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
