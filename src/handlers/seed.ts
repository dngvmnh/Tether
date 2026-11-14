/**
 * In-app demo data for judges: creates project PAY, space ENG, the decision pages and the
 * demo issues AS THE ADMIN who clicks "Load demo data" (so it needs no API token and no
 * terminal). Idempotent: existing project, space, pages (same title) and issues (same
 * scenario label) are reused. Same content as scripts/seed/seed.mjs.
 */
import { NeedsAuthenticationError, route } from '@forge/api';
import decisionsJson from '../../eval/decisions.json';
import scenariosJson from '../../eval/scenarios.json';
import { actor } from '../adapters/http';
import { store } from '../adapters/storage';
import { PortError } from '../engine/ports';
import { DEMO, scenarioLabel, seedPlan, type SeedTask } from '../seed/plan';
import { decisionStorage, decisionTitle, ticketAdf, type SeedDecision, type SeedTicket } from '../seed/render';

const decisions = (decisionsJson as unknown as { decisions: SeedDecision[] }).decisions;
const scenarios = (scenariosJson as unknown as { scenarios: Array<{ id: string; title: string; ticket: SeedTicket }> }).scenarios;
const PLAN = seedPlan(decisions.length, scenarios.length);

const user = () => actor('user');
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

async function ok(res: { ok: boolean; status: number; text(): Promise<string> }, what: string) {
  if (res.ok) return;
  const body = (await res.text().catch(() => '')).slice(0, 300);
  throw new PortError(`${what} failed (HTTP ${res.status})${body ? `: ${body}` : ''}`, `HTTP_${res.status}`, res.status >= 500, res.status === 401 || res.status === 403);
}

async function ensureProject(accountId: string): Promise<string> {
  const got = await user().requestJira(route`/rest/api/3/project/${DEMO.projectKey}`);
  if (got.ok) return `Project ${DEMO.projectKey} already exists.`;
  console.log(`[tether] demo data: project lookup HTTP ${got.status}`);
  const init = {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      key: DEMO.projectKey,
      name: DEMO.projectName,
      projectTypeKey: 'software',
      projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
      leadAccountId: accountId,
      assigneeType: 'UNASSIGNED',
    }),
  };
  let res;
  try {
    res = await user().requestJira(route`/rest/api/3/project`, init);
  } catch (e) {
    // Seen on a fresh site: the user's token lacks manage:jira-project even after the
    // "Allow access" consent, so the prompt loops. The caller is a verified Jira admin
    // (seedDemo checks), so create the project as the app, with that admin as lead.
    if (!(e instanceof NeedsAuthenticationError)) throw e;
    console.warn('[tether] demo data: project create as user needs consent; creating as app');
    res = await actor('app').requestJira(route`/rest/api/3/project`, init);
  }
  await ok(res, `Creating Jira project ${DEMO.projectKey}`);
  return `Created Jira project ${DEMO.projectKey} (${DEMO.projectName}).`;
}

async function ensureSpace(): Promise<string> {
  // Through Forge, Confluence v1 GETs (and v1 page create) answer 410 Gone; v2 is used for
  // lookups and pages. v1 space create still works and says "already exists" when it does.
  const exists = (await spaceId()) !== null;
  let line = `Confluence space ${DEMO.spaceKey} already exists.`;
  if (!exists) {
    const res = await user().requestConfluence(route`/wiki/rest/api/space`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        key: DEMO.spaceKey,
        name: DEMO.spaceName,
        description: { plain: { value: 'Engineering decision records (ADRs) checked by Tether.', representation: 'plain' } },
      }),
    });
    if (res.ok) line = `Created Confluence space ${DEMO.spaceKey} (${DEMO.spaceName}).`;
    else {
      const text = await res.text().catch(() => '');
      // The lookup can miss a space the user cannot list; "already exists" is still success.
      if (!(res.status === 400 && /already exists/i.test(text))) await ok({ ok: false, status: res.status, text: async () => text }, `Creating Confluence space ${DEMO.spaceKey}`);
    }
  }
  // Point Tether at the demo space and label, keeping any spaces the admin already set.
  const config = await store.getConfig();
  if (!config.spaceKeys.includes(DEMO.spaceKey) || config.decisionLabel !== DEMO.label) {
    await store.setConfig({ ...config, spaceKeys: [...new Set([...config.spaceKeys, DEMO.spaceKey])], decisionLabel: DEMO.label });
    line += ` Tether settings now search ${DEMO.spaceKey} for label ${DEMO.label}.`;
  }
  return line;
}

async function spaceId(): Promise<string | null> {
  const res = await user().requestConfluence(route`/wiki/api/v2/spaces?keys=${DEMO.spaceKey}&limit=1`);
  if (!res.ok) {
    console.warn(`[tether] demo data: space lookup HTTP ${res.status}`);
    return null;
  }
  return ((await res.json()) as { results?: Array<{ id: string }> }).results?.[0]?.id ?? null;
}

async function findPage(space: string, title: string): Promise<string | null> {
  const res = await user().requestConfluence(route`/wiki/api/v2/spaces/${space}/pages?title=${title}&limit=1`);
  if (!res.ok) {
    console.warn(`[tether] demo data: page lookup "${title}" HTTP ${res.status}`);
    return null;
  }
  return ((await res.json()) as { results?: Array<{ id: string }> }).results?.[0]?.id ?? null;
}

async function requireSpaceId(): Promise<string> {
  const id = await spaceId();
  if (!id) throw new PortError(`Confluence space ${DEMO.spaceKey} not found; run the space step again`, 'SPACE_MISSING', true);
  return id;
}

async function ensureDecision(d: SeedDecision, space: string): Promise<string> {
  const title = decisionTitle(d);
  if (await findPage(space, title)) return `Page exists: ${title}`;
  const res = await user().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ spaceId: space, status: 'current', title, body: { representation: 'storage', value: decisionStorage(d) } }),
  });
  await ok(res, `Creating page ${title}`);
  const page = (await res.json()) as { id: string };
  const label = await user().requestConfluence(route`/wiki/rest/api/content/${page.id}/label`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify([{ prefix: 'global', name: DEMO.label }]),
  });
  await ok(label, `Labelling page ${title}`);
  return `Created page: ${title}`;
}

async function ensureIssue(s: (typeof scenarios)[number], siteUrl: string, space: string): Promise<string> {
  const label = scenarioLabel(s.id);
  const jql = `project = ${DEMO.projectKey} AND labels = "${label}"`;
  const found = await user().requestJira(route`/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=1`);
  if (found.ok) {
    const key = ((await found.json()) as { issues?: Array<{ key: string }> }).issues?.[0]?.key;
    if (key) return `Issue exists: ${key} (${s.id})`;
  }
  const res = await user().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      fields: {
        project: { key: DEMO.projectKey },
        issuetype: { name: DEMO.issueType },
        summary: s.ticket.summary,
        description: ticketAdf(s.ticket),
        labels: ['tether-demo', label],
      },
    }),
  });
  await ok(res, `Creating issue for ${s.id}`);
  const issue = (await res.json()) as { key: string };
  const linkTo = DEMO.links[s.id];
  if (linkTo) {
    const d = decisions.find((x) => x.decisionId === linkTo);
    const pageId = d ? await findPage(space, decisionTitle(d)) : null;
    if (pageId) {
      const link = await user().requestJira(route`/rest/api/3/issue/${issue.key}/remotelink`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ object: { url: `${siteUrl}/wiki/pages/viewpage.action?pageId=${pageId}`, title: linkTo } }),
      });
      await ok(link, `Linking ${issue.key} to ${linkTo}`);
    }
  }
  return `Created issue: ${issue.key} (${s.id}: ${s.title})`;
}

function describe(t: SeedTask): string {
  switch (t.kind) {
    case 'project':
      return `Jira project ${DEMO.projectKey}`;
    case 'space':
      return `Confluence space ${DEMO.spaceKey}`;
    case 'decisions':
      return `Decision pages ${t.from + 1}-${t.to} of ${decisions.length}`;
    case 'issues':
      return `Demo issues ${t.from + 1}-${t.to} of ${scenarios.length}`;
  }
}

export interface SeedStepResult {
  step: number;
  total: number;
  title: string;
  lines: string[];
  next: number | null;
}

export async function runSeedStep(step: number, accountId: string, siteUrl: string): Promise<SeedStepResult> {
  const task = PLAN[step];
  if (!task) throw new PortError(`Unknown demo-data step ${step}`, 'BAD_STEP');
  const lines: string[] = [];
  switch (task.kind) {
    case 'project':
      lines.push(await ensureProject(accountId));
      break;
    case 'space':
      lines.push(await ensureSpace());
      break;
    case 'decisions': {
      const space = await requireSpaceId();
      for (const d of decisions.slice(task.from, task.to)) lines.push(await ensureDecision(d, space));
      break;
    }
    case 'issues': {
      const space = await requireSpaceId();
      for (const s of scenarios.slice(task.from, task.to)) lines.push(await ensureIssue(s, siteUrl, space));
      break;
    }
  }
  const next = step + 1 < PLAN.length ? step + 1 : null;
  return { step, total: PLAN.length, title: describe(task), lines, next };
}
