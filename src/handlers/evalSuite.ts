/**
 * In-Forge eval: runs the golden scenarios through the REAL pipeline (Forge LLMs for
 * extraction + semantic comparison) with fixture-backed ticket/decision ports, so no
 * site data is needed. Results: GET the eval web trigger (see docs/EVAL.md).
 */
import { runGoldenSuite } from '../../eval/run-suite';
import { ForgeLlmAdapter } from '../adapters/forgeLlm';
import { store } from '../adapters/storage';

export async function runEvalSuite() {
  const config = await store.getConfig();
  return runGoldenSuite(new ForgeLlmAdapter(config.models));
}
