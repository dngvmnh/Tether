/** Pure presentation helpers shared by the resolver (follow-up drafts) and Rovo/MCP actions. */
import type { AnalysisReport, Finding, FollowUpDraft } from '../contracts';
import { describeConstraint } from './compare';

export function buildFollowUpDraft(report: AnalysisReport, findingId: string, projectKey: string): FollowUpDraft {
  const f = report.findings.find((x) => x.id === findingId);
  if (!f) throw new Error(`Finding ${findingId} not in report ${report.reportId}`);
  const claim = report.claims.find((c) => c.id === f.claimId);
  const decisions = report.decisions.filter((d) => f.decisionIds.includes(d.decisionId));
  const ids = f.decisionIds.join(' / ') || 'existing decisions';
  const label = claim?.attributeLabel ?? 'requirement';
  const summary = `Clarify ${claim?.subject ?? ''} ${label} in ${report.issueKey} against ${ids}`.replace(/\s+/g, ' ').slice(0, 255);
  const lines = [
    `Tether found: ${f.headline} (${f.outcome.replace(/_/g, ' ').toLowerCase()}).`,
    `Original requirement (${report.issueKey}): "${f.ticketEvidence.quote}"${claim ? ` (${describeConstraint(claim)})` : ''}`,
    ...f.decisionEvidence.map((e) => `Existing decision (${e.title}): "${e.quote}"`),
    `Why: ${f.explanation}`,
    'Required action: confirm whether the existing decision should change or the Jira requirement should be revised.',
    ...decisions.map((d) => `Decision owner for ${d.decisionId}: ${d.owner?.displayName ?? 'unknown'}`),
  ];
  return {
    findingId,
    projectKey,
    issueTypeName: 'Task',
    summary,
    descriptionText: lines.join('\n\n'),
    linkedIssueKey: report.issueKey,
    decisionLinks: decisions.map((d) => ({ title: `${d.decisionId}: ${d.title}`, url: d.source.url })),
  };
}

function findingLine(f: Finding): string {
  const src = f.decisionEvidence[0];
  return `- [${f.outcome}] ${f.headline}. Ticket: "${f.ticketEvidence.quote}"${src ? `. Decision: "${src.quote}" (${src.url})` : ''}`;
}

/** Compact, citation-first summary for Rovo agents and MCP clients. */
export function summarizeForAgent(report: AnalysisReport) {
  const important = report.findings.filter((f) => f.outcome !== 'NO_CONFLICT_FOUND');
  return {
    issueKey: report.issueKey,
    overallOutcome: report.overallOutcome,
    status: report.status,
    headline: report.headline,
    coverage: report.coverage.summary,
    generatedAt: report.generatedAt,
    findings: report.findings.map((f) => ({
      id: f.id,
      outcome: f.outcome,
      reason: f.reason,
      headline: f.headline,
      explanation: f.explanation,
      ticketQuote: f.ticketEvidence.quote,
      decisions: f.decisionEvidence.map((e) => ({ title: e.title, quote: e.quote, url: e.url })),
    })),
    errors: report.errors.map((e) => `${e.stage}: ${e.message}`),
    markdown: [
      `**${report.overallOutcome ?? 'CHECK FAILED'}**: ${report.headline}`,
      report.coverage.summary,
      ...important.map(findingLine),
      ...(report.errors.length ? [`Errors (not analysis results): ${report.errors.map((e) => e.message).join('; ')}`] : []),
      'A lack of detected conflict is not proof of complete consistency.',
    ].join('\n'),
  };
}
