/**
 * Eval web trigger (development only). Protected by a per-developer secret:
 *   forge variables set --encrypt -e <your-env> TETHER_EVAL_TOKEN <random>
 *   POST <url> with header  x-tether-eval-token: <random>   -> queue a run
 *   GET  <url> with the same header                          -> latest results
 * Get the URL with: forge webtrigger  (choose the eval-runner trigger)
 */
import { store } from '../adapters/storage';
import { startEvalJob } from './jobs';

interface WebTriggerRequest {
  method: string;
  headers: Record<string, string[] | undefined>;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': ['application/json'] },
  body: JSON.stringify(body, null, 2),
});

export async function handler(req: WebTriggerRequest) {
  const expected = process.env.TETHER_EVAL_TOKEN;
  const got = req.headers['x-tether-eval-token']?.[0];
  if (!expected || got !== expected) return json(401, { error: 'unauthorized' });
  if (req.method === 'POST') {
    await startEvalJob();
    return json(202, { queued: true });
  }
  return json(200, (await store.getEval()) ?? { message: 'No eval run yet. POST to start one.' });
}
