/**
 * The only module the UI uses to talk to the backend. In mock mode (npm run ui:dev) every
 * call is served from generated fixtures, so the UI can be built without Forge.
 *
 * @forge/bridge throws at import time outside an Atlassian iframe, so it is only ever
 * loaded lazily and never in mock mode.
 */
import type { ResolverApi, ResolverName, ResolverResult } from '../../../../src/contracts';

export const MOCK = import.meta.env.VITE_TETHER_MOCK === 'true';
const bridge = () => import('@forge/bridge');

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export async function call<N extends ResolverName>(name: N, input: ResolverApi[N]['input']): Promise<ResolverApi[N]['output']> {
  let res: ResolverResult<ResolverApi[N]['output']>;
  try {
    res = MOCK
      ? await (await import('./mock')).mockInvoke(name, input)
      : ((await (await bridge()).invoke(name, input as Record<string, unknown>)) as ResolverResult<ResolverApi[N]['output']>);
  } catch (e) {
    throw new ApiError('NETWORK', e instanceof Error ? e.message : 'Request failed', true);
  }
  if (!res.ok) throw new ApiError(res.error.code, res.error.message, res.error.retryable);
  return res.data;
}

export interface ModuleContext {
  moduleKey: string;
  issueKey?: string;
  /** Decision id for the Confluence badge (mock: ?decision=ADR-PAY-001). */
  decisionId?: string;
}

export async function getModuleContext(): Promise<ModuleContext> {
  if (MOCK) {
    const params = new URLSearchParams(window.location.search);
    return { moduleKey: params.get('module') ?? 'tether-issue-panel', issueKey: 'PAY-101', decisionId: params.get('decision') ?? 'ADR-PAY-001' };
  }
  const ctx = (await (await bridge()).view.getContext()) as { moduleKey: string; extension?: { issue?: { key?: string } } };
  return { moduleKey: ctx.moduleKey, issueKey: ctx.extension?.issue?.key };
}

export async function enableTheme() {
  if (!MOCK) await (await bridge()).view.theme.enable();
}

export function openUrl(url: string) {
  if (MOCK) window.open(url, '_blank', 'noopener');
  else void bridge().then((b) => b.router.open(url));
}
