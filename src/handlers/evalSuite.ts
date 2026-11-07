/**
 * In-Forge eval: runs the golden scenarios through the REAL pipeline (Forge LLMs for
 * extraction + semantic comparison) with fixture-backed ticket/decision ports, so no
 * site data is needed. Results: GET the eval web trigger (see docs/EVAL.md).
 */
import { goldRawDecisions, goldScenarios } from '../../eval/gold';
import { ForgeLlmAdapter } from '../adapters/forgeLlm';
import { store } from '../adapters/storage';
import { analyzeIssue } from '../engine';

export async function runEvalSuite() {
  const config = await store.getConfig();
  const llm = new ForgeLlmAdapter(config.models);
  const raws = goldRawDecisions();
  const rows = [];
  for (const s of goldScenarios()) {
    const r = await analyzeIssue(s.ticket.issueKey, {
      tickets: { getTicket: async () => s.ticket },
      decisions: { search: async () => ({ decisions: raws, spacesSearched: ['ENG'], decisionLabel: 'tether-decision' }) },
      llm,
    });
    const expected = s.expected.overall;
    const actual = r.overallOutcome;
    rows.push({
      id: s.id,
      title: s.title,
      expected,
      actual,
      pass: expected === actual,
      missedConflict: expected === 'CONFLICT' && actual !== 'CONFLICT',
      falseConflict: expected !== 'CONFLICT' && actual === 'CONFLICT',
      falseNoConflict: expected !== 'NO_CONFLICT_FOUND' && actual === 'NO_CONFLICT_FOUND',
      extractedClaims: r.claims.length,
      goldClaims: s.claims.length,
      errors: r.errors.map((e) => `${e.stage}:${e.code}`),
      llmCalls: r.run.llmCalls,
      durationMs: r.run.durationMs,
    });
  }
  const n = rows.length;
  return {
    ranAt: new Date().toISOString(),
    models: config.models,
    total: n,
    passed: rows.filter((x) => x.pass).length,
    missedConflicts: rows.filter((x) => x.missedConflict).length,
    falseConflicts: rows.filter((x) => x.falseConflict).length,
    falseNoConflict: rows.filter((x) => x.falseNoConflict).length,
    rows,
  };
}
