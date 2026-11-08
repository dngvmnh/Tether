/** Pure evaluation harness. The integration owner supplies the real LlmPort. */
import type { AnalysisReport, Claim } from '../src/contracts';
import { analyzeIssue, type LlmPort } from '../src/engine';
import { goldRawDecisions, goldScenarios, GOLD_SPACE, type GoldScenario } from './gold';
import { scoreScenario } from './score-scenario';

type Score = ReturnType<typeof scoreScenario>;
export interface SuiteOptions {
  scenarios?: readonly GoldScenario[];
  /** Checked between scenarios; cannot interrupt an in-flight model call. */
  budgetMs?: number;
  /** Full reports for named cases only, capped to leave room in Forge KVS. */
  diagnosticIds?: readonly string[];
  /** Persist full reports here if needed; the returned summary stays smaller. */
  onResult?: (scenario: GoldScenario, report: AnalysisReport, score: Score) => void | Promise<void>;
}

/**
 * Reuse validated decision extraction only within THIS suite invocation. No gold
 * constraints are injected into the pipeline, and no cache crosses sites or runs.
 * Run completion is separate from accuracy; skipped cases never count as passes.
 */
export async function runGoldenSuite(llm: LlmPort, options: SuiteOptions = {}) {
  const scenarios = options.scenarios ?? goldScenarios();
  const started = Date.now();
  const budgetMs = options.budgetMs ?? 12 * 60_000;
  if (!Number.isFinite(budgetMs) || budgetMs < 0) throw new Error('budgetMs must be finite and non-negative');
  const constraints = new Map<string, Claim[]>();
  const raws = goldRawDecisions();
  const diagnosticIds = new Set(options.diagnosticIds ?? []);
  const diagnostics: Array<{ id: string; report: AnalysisReport }> = [];
  const diagnosticsOmittedIds: string[] = [];
  let diagnosticBytes = 0;
  const rows: Array<Score & {
    status: AnalysisReport['status']; models: string[]; llmCalls: number;
    durationMs: number; extractedClaims: number; goldClaims: number;
  }> = [];
  let stoppedReason: 'TIME_BUDGET' | 'LLM_UNAVAILABLE' | null = null;

  for (const scenario of scenarios) {
    if (Date.now() - started >= budgetMs) { stoppedReason = 'TIME_BUDGET'; break; }
    const report = await analyzeIssue(scenario.ticket.issueKey, {
      tickets: { getTicket: async () => scenario.ticket },
      decisions: { search: async () => ({ decisions: raws, spacesSearched: [GOLD_SPACE.key], decisionLabel: 'tether-decision' }) },
      llm,
      cache: {
        get: async (key) => {
          const value = constraints.get(key);
          return value === undefined ? undefined : structuredClone(value);
        },
        set: async (key, value) => { constraints.set(key, structuredClone(value)); },
      },
    });
    const score = scoreScenario(scenario, report);
    rows.push({ ...score, status: report.status, models: report.run.models,
      llmCalls: report.run.llmCalls, durationMs: report.run.durationMs,
      extractedClaims: report.claims.length, goldClaims: scenario.claims.length });
    if (diagnosticIds.has(scenario.id)) {
      const snapshot = { id: scenario.id, report: structuredClone(report) };
      const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
      if (diagnosticBytes + bytes <= 120_000) { diagnostics.push(snapshot); diagnosticBytes += bytes; }
      else diagnosticsOmittedIds.push(scenario.id);
    }
    await options.onResult?.(scenario, report, score);
    // Avoid burning the rest of a suite on a known unavailable model boundary.
    if (report.errors.some((e) => e.code === 'LLM_UNAVAILABLE')) {
      stoppedReason = 'LLM_UNAVAILABLE';
      break;
    }
  }

  return {
    ranAt: new Date().toISOString(), durationMs: Date.now() - started,
    complete: stoppedReason === null && rows.length === scenarios.length,
    stoppedReason, total: scenarios.length, evaluated: rows.length,
    skippedIds: scenarios.slice(rows.length).map((s) => s.id),
    passed: rows.filter((r) => r.pass).length,
    verdictPassed: rows.filter((r) => r.outcomeMatch).length,
    missedConflicts: rows.filter((r) => r.missedConflict).length,
    falseConflicts: rows.filter((r) => r.falseConflict).length,
    falseNoConflict: rows.filter((r) => r.falseNoConflict).length,
    models: [...new Set(rows.flatMap((r) => r.models))], rows, diagnostics, diagnosticsOmittedIds,
  };
}
