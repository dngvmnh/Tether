/**
 * Mock only. Derives usage from the generated report fixtures, so the badge numbers can be
 * checked against the same data the issue panel shows. ?usage=empty | error | slow.
 */
import type { AnalysisReport, Outcome } from '../../../../src/contracts';
import fixtures from '../mocks/reports.json';
import { ApiError } from './client';
import type { DecisionUsage } from './decisionUsage';

const reports = Object.values(fixtures as unknown as Record<string, { report: AnalysisReport }>).map((f) => f.report);
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockDecisionUsage(decisionId: string): Promise<DecisionUsage> {
  const mode = new URLSearchParams(window.location.search).get('usage');
  await delay(mode === 'slow' ? 2500 : 300);
  if (mode === 'error') throw new ApiError('HTTP_500', 'Could not load usage for this decision.', true);

  // Several fixtures reuse an issue key, so count each ticket once; a conflict in any of its reports wins.
  const byTicket = new Map<string, Outcome>();
  if (mode !== 'empty') {
    for (const r of reports) {
      const mine = r.findings.filter((f) => f.decisionIds.includes(decisionId));
      if (mine.length === 0) continue;
      const outcome: Outcome = mine.some((f) => f.outcome === 'CONFLICT') ? 'CONFLICT' : mine[0]!.outcome;
      if (byTicket.get(r.issueKey) !== 'CONFLICT') byTicket.set(r.issueKey, outcome);
    }
  }
  const tickets: DecisionUsage['tickets'] = [...byTicket].map(([issueKey, outcome]) => ({ issueKey, outcome }));
  return { decisionId, referencedBy: tickets.length, conflicts: tickets.filter((t) => t.outcome === 'CONFLICT').length, tickets };
}
