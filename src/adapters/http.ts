import api from '@forge/api';
import { PortError } from '../engine/ports';

export type Actor = 'user' | 'app';

export function actor(as: Actor) {
  return as === 'user' ? api.asUser() : api.asApp();
}

/** Turns a non-2xx product API response into a PortError with a precise code. */
export async function ensureOk(res: { ok: boolean; status: number; text(): Promise<string> }, what: string): Promise<void> {
  if (res.ok) return;
  const body = (await res.text().catch(() => '')).slice(0, 300);
  const permission = res.status === 401 || res.status === 403;
  const retryable = res.status === 429 || res.status >= 500;
  throw new PortError(`${what} failed (HTTP ${res.status})${body ? `: ${body}` : ''}`, `HTTP_${res.status}`, retryable, permission);
}
