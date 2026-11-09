#!/usr/bin/env node
// Seeds YOUR dev site with the golden decision records and demo tickets.
// Idempotent: existing pages (same title) and issues (same scenario label) are skipped.
//
//   cp .env.example .env    # fill in your own site/email/token
//   npm run seed -- --dry-run
//   npm run seed
//
// Needs: a Jira project with key TETHER_JIRA_PROJECT_KEY (create it in the UI first),
// Confluence on the same site. Uses YOUR API token from .env (never commit it).
import { readFileSync, existsSync } from 'node:fs';
import { decisionStorage, decisionTitle, ticketAdf } from './render.mjs';

const DRY = process.argv.includes('--dry-run');

function loadEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();

const env = (k, fallback) => {
  const v = process.env[k] || fallback;
  if (!v && !DRY) throw new Error(`Missing ${k} in .env`);
  return v;
};
const SITE = `https://${env('ATLASSIAN_SITE', 'example.atlassian.net').replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
const AUTH = 'Basic ' + Buffer.from(`${env('ATLASSIAN_EMAIL', 'x')}:${env('ATLASSIAN_API_TOKEN', 'x')}`).toString('base64');
const PROJECT = env('TETHER_JIRA_PROJECT_KEY', 'PAY');
const SPACE = env('TETHER_CONFLUENCE_SPACE_KEY', 'ENG');
const SPACE_NAME = env('TETHER_CONFLUENCE_SPACE_NAME', 'Engineering Decisions');
const ISSUE_TYPE = process.env.TETHER_ISSUE_TYPE || 'Task';

const { decisions } = JSON.parse(readFileSync('eval/decisions.json', 'utf8'));
const { scenarios } = JSON.parse(readFileSync('eval/scenarios.json', 'utf8'));

async function api(method, path, body) {
  if (DRY && method !== 'GET') {
    console.log(`[dry-run] ${method} ${path}`);
    return { id: 'dry', key: `${PROJECT}-0` };
  }
  if (DRY) return null;
  const res = await fetch(`${SITE}${path}`, {
    method,
    headers: { Authorization: AUTH, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.status === 204 ? {} : res.json();
}

async function ensureSpace() {
  const s = await api('GET', `/wiki/rest/api/space/${SPACE}`);
  if (s) return console.log(`space ${SPACE} exists`);
  await api('POST', '/wiki/rest/api/space', { key: SPACE, name: SPACE_NAME, description: { plain: { value: 'Engineering decision records (ADRs) checked by Tether.', representation: 'plain' } } });
  console.log(`created space ${SPACE}`);
}

async function ensureProject() {
  const p = await api('GET', `/rest/api/3/project/${PROJECT}`);
  if (p) return console.log(`project ${PROJECT} exists`);
  const me = await api('GET', '/rest/api/3/myself');
  await api('POST', '/rest/api/3/project', {
    key: PROJECT,
    name: 'Payments',
    projectTypeKey: 'software',
    projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
    leadAccountId: me?.accountId,
    assigneeType: 'UNASSIGNED',
  });
  console.log(`created project ${PROJECT}`);
}

async function ensureDecision(d) {
  const title = decisionTitle(d);
  const found = await api('GET', `/wiki/rest/api/content?spaceKey=${SPACE}&title=${encodeURIComponent(title)}&type=page`);
  if (found?.results?.length) {
    console.log(`page exists: ${title}`);
    return found.results[0].id;
  }
  const page = await api('POST', '/wiki/rest/api/content', {
    type: 'page',
    title,
    space: { key: SPACE },
    body: { storage: { value: decisionStorage(d), representation: 'storage' } },
  });
  await api('POST', `/wiki/rest/api/content/${page.id}/label`, [{ prefix: 'global', name: 'tether-decision' }]);
  console.log(`created page: ${title} (${page.id})`);
  return page.id;
}

async function ensureIssue(s, pageIds) {
  const label = `tether-${s.id.toLowerCase()}`;
  const jql = encodeURIComponent(`project = ${PROJECT} AND labels = "${label}"`);
  const found = await api('GET', `/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=1`);
  if (found?.issues?.length) {
    console.log(`issue exists: ${s.id} -> ${found.issues[0].key}`);
    return found.issues[0].key;
  }
  const issue = await api('POST', '/rest/api/3/issue', {
    fields: {
      project: { key: PROJECT },
      issuetype: { name: ISSUE_TYPE },
      summary: s.ticket.summary,
      description: ticketAdf(s.ticket),
      labels: ['tether-demo', label],
    },
  });
  // Link a few issues to decision pages so Teamwork Graph / remote links have something to find.
  const links = { S01: 'ADR-PAY-001', S04: 'ADR-PAY-000', S08: 'ADR-SEC-003' };
  if (links[s.id] && pageIds[links[s.id]]) {
    await api('POST', `/rest/api/3/issue/${issue.key}/remotelink`, {
      object: { url: `${SITE}/wiki/pages/viewpage.action?pageId=${pageIds[links[s.id]]}`, title: links[s.id] },
    });
  }
  console.log(`created issue: ${s.id} -> ${issue.key} (${s.title})`);
  return issue.key;
}

async function main() {
  console.log(`${DRY ? '[dry-run] ' : ''}seeding ${SITE}: space ${SPACE}, project ${PROJECT}`);
  await ensureProject();
  await ensureSpace();
  const pageIds = {};
  for (const d of decisions) pageIds[d.decisionId] = await ensureDecision(d);
  const map = {};
  for (const s of scenarios) map[s.id] = await ensureIssue(s, pageIds);
  console.log('\nscenario -> issue', map);
  console.log(`\nNext: set Tether settings (Jira > Apps > Tether settings) to space ${SPACE}, then open an issue.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
