/**
 * Pull-based decision drift. A report records the page version of every decision it used;
 * when any of those pages now has a newer version, the report may be out of date.
 *
 * This runs where the report is read (Jira panel, Rovo, MCP). It does not depend on the
 * Confluence page trigger, which runs in the Confluence installation and cannot read the
 * Jira installation's storage.
 */
import type { AnalysisReport } from '../contracts';

export interface DecisionPageRef {
  pageId: string;
  decisionId: string;
  version: number;
}

/** Confluence-page decisions in a report that carry a version (others cannot drift-check). */
export function decisionPages(report: Pick<AnalysisReport, 'decisions'>): DecisionPageRef[] {
  const seen = new Set<string>();
  const out: DecisionPageRef[] = [];
  for (const d of report.decisions) {
    const s = d.source;
    if (s.kind !== 'CONFLUENCE_PAGE' || s.version == null || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ pageId: s.id, decisionId: d.decisionId, version: s.version });
  }
  return out;
}

/**
 * Decision ids whose page is now newer than the version the report used.
 * Pages missing from `current` (deleted, unreadable, lookup failed) are not treated as changed.
 */
export function changedDecisions(pages: DecisionPageRef[], current: ReadonlyMap<string, number>): string[] {
  return pages.filter((p) => {
    const now = current.get(p.pageId);
    return now != null && now > p.version;
  }).map((p) => p.decisionId);
}
