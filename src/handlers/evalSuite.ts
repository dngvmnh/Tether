/**
 * In-Forge eval: runs the golden scenarios through the REAL pipeline (Forge LLMs for
 * extraction + semantic comparison) with fixture-backed ticket/decision ports, so no
 * site data is needed. Run from Tether settings (see docs/EVAL.md).
 */
import { runGoldenSuite } from '../../eval/run-suite';
import { goldScenarios } from '../../eval/gold';
import { ForgeLlmAdapter } from '../adapters/forgeLlm';
import { store } from '../adapters/storage';

export async function runEvalSuite() {
  const config = await store.getConfig();
  const all = goldScenarios();
  const ids = (value?: string) => value?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
  const selected = ids(process.env.TETHER_EVAL_SCENARIO_IDS);
  const diagnosticIds = ids(process.env.TETHER_EVAL_DIAGNOSTIC_IDS);
  for (const id of [...selected, ...diagnosticIds]) {
    if (!all.some((s) => s.id === id)) throw new Error(`Unknown evaluation scenario: ${id}`);
  }
  return runGoldenSuite(new ForgeLlmAdapter(config.models), {
    scenarios: selected.length ? all.filter((s) => selected.includes(s.id)) : all,
    diagnosticIds,
  });
}
