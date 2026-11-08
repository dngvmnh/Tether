/**
 * Reproducible per-scenario report on hand-labelled claims. No LLM/API requests.
 * Run: node --import tsx eval/report-offline.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assembleReport, assessClaims } from '../src/engine';
import { goldDecisions, goldScenarios } from './gold';
import { scoreScenario } from './score-scenario';

async function main() {
  const decisions = goldDecisions();
  const rows = [];
  for (const s of goldScenarios()) {
    const findings = await assessClaims({ claims: s.claims, decisions });
    const report = assembleReport({
      reportId: `offline-${s.id}`, issueKey: s.ticket.issueKey, ticket: s.ticket, claims: s.claims,
      decisions, findings, errors: [], spacesSearched: ['ENG'], decisionLabel: 'tether-decision',
      graph: { used: false, linkedPages: 0 }, generatedAt: new Date().toISOString(),
      durationMs: 0, llmCalls: 0, models: [],
    });
    rows.push(scoreScenario(s, report));
  }
  const result = {
    evaluation: 'offline-gold-claims', ranAt: new Date().toISOString(), node: process.version,
    liveLlm: false, liveAtlassianApis: false,
    limitation: 'Hand-labelled functional scenarios; this does not measure model extraction accuracy, live integration or real-world precision/recall.',
    total: rows.length, passed: rows.filter((r) => r.pass).length,
    missedConflicts: rows.filter((r) => r.missedConflict).length,
    falseConflicts: rows.filter((r) => r.falseConflict).length,
    falseNoConflict: rows.filter((r) => r.falseNoConflict).length,
    evidenceErrors: rows.reduce((n, r) => n + r.evidenceErrors.length, 0), rows,
  };
  writeFileSync(fileURLToPath(new URL('./offline-results.json', import.meta.url)), JSON.stringify(result, null, 2) + '\n');
  console.log(`${result.passed}/${result.total} passed; missed conflicts ${result.missedConflicts}; false conflicts ${result.falseConflicts}; false passes ${result.falseNoConflict}; evidence errors ${result.evidenceErrors}.`);
  if (result.passed !== result.total) process.exitCode = 1;
}

void main();
