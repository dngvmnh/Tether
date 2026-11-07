import type { Scope, ScopeCheckValue } from '../contracts';

const ENV_ALIASES: Record<string, string> = {
  prod: 'production',
  production: 'production',
  live: 'production',
  stg: 'staging',
  stage: 'staging',
  staging: 'staging',
  uat: 'staging',
  dev: 'development',
  development: 'development',
  local: 'development',
  test: 'test',
  qa: 'test',
};

export function normalizeEnv(env: string): string {
  const k = env.trim().toLowerCase();
  return ENV_ALIASES[k] ?? k;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ScopeResult {
  service: ScopeCheckValue;
  environment: ScopeCheckValue;
  conditions: ScopeCheckValue;
  /** False when service or environment explicitly do not overlap. */
  applicable: boolean;
}

/**
 * Does a decision's scope cover a ticket requirement's scope?
 * Unspecified (empty) environments/conditions are treated as "applies broadly".
 */
export function checkScope(ticket: Scope, decision: Scope): ScopeResult {
  let service: ScopeCheckValue;
  if (decision.service === '*') service = 'MATCH';
  else if (ticket.service === '*') service = 'UNKNOWN';
  else service = norm(ticket.service) === norm(decision.service) ? 'MATCH' : 'MISMATCH';

  let environment: ScopeCheckValue = 'MATCH';
  if (ticket.environments.length > 0 && decision.environments.length > 0) {
    const d = new Set(decision.environments.map(normalizeEnv));
    environment = ticket.environments.map(normalizeEnv).some((e) => d.has(e)) ? 'MATCH' : 'MISMATCH';
  }

  let conditions: ScopeCheckValue = 'MATCH';
  if (ticket.conditions.length > 0 && decision.conditions.length > 0) {
    const tc = ticket.conditions.map(norm);
    const dc = decision.conditions.map(norm);
    const overlap = tc.some((a) => dc.some((b) => a.includes(b) || b.includes(a)));
    conditions = overlap ? 'MATCH' : 'UNKNOWN';
  }

  return { service, environment, conditions, applicable: service !== 'MISMATCH' && environment !== 'MISMATCH' };
}
