import { useEffect, useState } from 'react';
import type { AnalysisReport, Finding, FollowUpDraft } from '../../../../src/contracts';
import { ApiError, call, openUrl } from '../api/client';

/** Preview -> user edits -> explicit confirm. Tether never creates issues silently. */
export function FollowUpModal({ report, finding, onClose }: { report: AnalysisReport; finding: Finding; onClose: () => void }) {
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ issueKey: string; url: string } | null>(null);

  useEffect(() => {
    call('previewFollowUp', { issueKey: report.issueKey, reportId: report.reportId, findingId: finding.id })
      .then((r) => setDraft(r.draft))
      .catch((e: ApiError) => setError(e.message));
  }, [report, finding]);

  async function create() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      setCreated(await call('createFollowUp', { draft }));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create clarification issue">
      <div className="modal">
        <h2>Create clarification issue</h2>
        {error && <div className="banner banner--FAILED">{error}</div>}
        {!draft && !error && <p>Preparing draft…</p>}
        {created ? (
          <p>
            Created{' '}
            <button type="button" className="link" onClick={() => openUrl(created.url)}>
              {created.issueKey}
            </button>
            , linked to {report.issueKey} and the decision page(s).
          </p>
        ) : (
          draft && (
            <>
              <label>
                Summary
                <input value={draft.summary} maxLength={255} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
              </label>
              <label>
                Description
                <textarea rows={10} value={draft.descriptionText} onChange={(e) => setDraft({ ...draft, descriptionText: e.target.value })} />
              </label>
              <p className="muted">
                Project {draft.projectKey} · {draft.issueTypeName} · links {draft.linkedIssueKey}
                {draft.decisionLinks.length ? ` and ${draft.decisionLinks.map((d) => d.title).join(', ')}` : ''}. The original issue and
                decisions are not changed.
              </p>
            </>
          )
        )}
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {created ? 'Close' : 'Cancel'}
          </button>
          {!created && (
            <button type="button" className="btn btn--primary" disabled={!draft || busy} onClick={create}>
              {busy ? 'Creating…' : 'Create issue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
