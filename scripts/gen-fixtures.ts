/**
 * Generates UI mock fixtures from the golden scenarios by running the deterministic
 * engine on gold claims. Output: static/report/src/mocks/reports.json
 * Re-run after any contract or engine change:  npm run fixtures
 */
import { writeFileSync } from 'node:fs';
import { AnalysisReport, type AnalysisError } from '../src/contracts';
import { assembleReport, assessClaims } from '../src/engine';
import { goldDecisions, goldScenarios } from '../eval/gold';

const decisions = goldDecisions();
const out: Record<string, { title: string; report: AnalysisReport }> = {};

async function build(id: string, title: string, s: ReturnType<typeof goldScenarios>[number], errors: AnalysisError[] = [], opts: { failed?: boolean } = {}) {
  const findings = opts.failed ? [] : await assessClaims({ claims: s.claims, decisions });
  // Fixtures only carry decisions a finding refers to, like a lean production report would.
  const used = new Set(findings.flatMap((f) => [...f.decisionIds, ...f.history.map((h) => h.decisionId)]));
  const report = assembleReport({
    reportId: `R-${id}`,
    issueKey: s.ticket.issueKey,
    ticket: s.ticket,
    claims: opts.failed ? [] : s.claims,
    decisions: decisions.filter((d) => used.has(d.decisionId)),
    findings,
    errors,
    spacesSearched: ['ENG'],
    decisionLabel: 'tether-decision',
    graph: errors.some((e) => e.stage === 'TEAMWORK_GRAPH')
      ? { used: false, linkedPages: 0, note: 'Teamwork Graph unavailable; fell back to label search.' }
      : { used: true, linkedPages: 1, note: `1 page linked to ${s.ticket.issueKey} in Teamwork Graph` },
    generatedAt: '2026-11-08T09:00:00.000Z',
    durationMs: 8400,
    llmCalls: 3,
    models: ['claude-sonnet-5'],
  });
  out[id] = { title, report: AnalysisReport.parse(report) };
}

async function main() {
const scenarios = goldScenarios();
for (const s of scenarios) await build(s.id, s.title, s);

const s09 = scenarios.find((s) => s.id === 'S09')!;
await build('E_PARTIAL', 'Partial: graph + one decision failed', s09, [
  { stage: 'TEAMWORK_GRAPH', code: 'HTTP_403', message: 'Teamwork Graph returned 403 (scope not granted)', retryable: false, claimIds: [] },
  { stage: 'EXTRACT_DECISION_CONSTRAINTS', code: 'LLM_UNAVAILABLE', message: 'ADR-SEC-003: model unavailable', retryable: true, claimIds: [] },
]);
await build('E_FAILED', 'Failed: ticket permission error', scenarios[0]!, [
  { stage: 'PERMISSION', code: 'HTTP_403', message: 'Tether cannot read this issue.', retryable: false, claimIds: [] },
], { failed: true });
out['E_API'] = { title: 'API error on start (resolver returns ok:false)', report: out['S01']!.report };

writeFileSync('static/report/src/mocks/reports.json', JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${Object.keys(out).length} fixtures to static/report/src/mocks/reports.json`);
}

void main();
