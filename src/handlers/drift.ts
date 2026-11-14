/** Read-time staleness shared by the panel resolver and the Rovo/MCP check action. */
import type { AnalysisReport, StaleInfo } from '../contracts';
import { currentPageVersions } from '../adapters/confluence';
import type { Actor } from '../adapters/http';
import { store } from '../adapters/storage';
import { changedDecisions, decisionPages } from '../engine/drift';

/**
 * Why the stored report may be out of date, or null. Order: a stale mark written by a
 * trigger, then decision pages newer than the versions the report used. Ticket edits are
 * checked by the caller, which knows its own actor and site.
 */
export async function decisionStaleness(report: AnalysisReport, as: Actor): Promise<StaleInfo | null> {
  const stored = await store.getStale(report.issueKey);
  if (stored) return stored;
  const pages = decisionPages(report);
  if (pages.length === 0) return null;
  const current = await currentPageVersions(pages.map((p) => p.pageId), as);
  const changed = changedDecisions(pages, current);
  if (changed.length === 0) return null;
  return { reason: 'DECISION_UPDATED', at: new Date().toISOString(), decisionIds: changed };
}
