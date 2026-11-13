/**
 * Drift detection: Tether keeps tickets tethered *over time*, not just at check time.
 *  - A decision page changes  -> every issue checked against it is marked stale
 *    (and optionally re-checked).
 *  - A ticket's text changes  -> its report is marked stale.
 */
import { store } from '../adapters/storage';

interface PageEvent {
  content?: { id?: string; title?: string; version?: { number?: number } };
}

interface IssueEvent {
  issue?: { key?: string };
  changelog?: { items?: Array<{ field?: string; fieldId?: string }> };
}

const TEXT_FIELDS = new Set(['summary', 'description', 'labels', 'components']);

export async function onDecisionUpdated(event: PageEvent) {
  const pageId = event.content?.id != null ? String(event.content.id) : undefined;
  if (!pageId) {
    console.warn('[tether] page event without content.id', JSON.stringify(event).slice(0, 500));
    return;
  }
  const affected = await store.issuesCheckedAgainst(pageId);
  const at = new Date().toISOString();
  for (const a of affected) {
    await store.putStale(a.issueKey, { reason: 'DECISION_UPDATED', at, decisionIds: [a.decisionId] });
  }
  // TODO(integration): if config.autoRecheckOnDecisionChange, enqueue re-checks. The worker
  // needs a requesting accountId for permission filtering: use the account that ran the last check.
  console.log(`[tether] decision page ${pageId} changed; ${affected.length} issue(s) marked stale`);
}

export async function onIssueUpdated(event: IssueEvent) {
  const key = event.issue?.key;
  if (!key) return;
  const changed = (event.changelog?.items ?? []).some((i) => TEXT_FIELDS.has((i.fieldId ?? i.field ?? '').toLowerCase()));
  if (!changed) return;
  const report = await store.getReport(key);
  if (report) await store.putStale(key, { reason: 'TICKET_UPDATED', at: new Date().toISOString(), decisionIds: [] });
}
