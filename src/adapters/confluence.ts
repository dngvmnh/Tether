/**
 * Confluence decision retrieval (owner: integration).
 *
 * A decision record is a page with label `tether-decision` (configurable) whose
 * Page Properties macro holds the fields below. See docs/DECISION-RECORD-FORMAT.md.
 */
import { route } from '@forge/api';
import type { DecisionStatus, RawDecision } from '../contracts';
import { PortError, type DecisionPort, type DecisionQuery, type DecisionSearchResult } from '../engine/ports';
import { actor, ensureOk, type Actor } from './http';

interface ContentResult {
  id: string;
  title: string;
  version?: { number: number };
  body?: { storage?: { value: string } };
  metadata?: { labels?: { results: Array<{ name: string }> } };
  _links?: { webui?: string };
}

/**
 * Current version number of each page, for pull-based drift checks, in one CQL search.
 * (v1 GET /content/{id} answers 410 Gone; v2 /pages would need a new granular scope.)
 * Pages the actor cannot see, and any lookup failure, are simply missing from the result.
 */
export async function currentPageVersions(pageIds: string[], as: Actor): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = pageIds.filter((id) => /^\d+$/.test(id));
  if (ids.length === 0) return out;
  const cql = `id in (${ids.join(',')})`;
  try {
    const res = await actor(as).requestConfluence(
      route`/wiki/rest/api/content/search?cql=${cql}&limit=${ids.length}&expand=version`,
    );
    if (!res.ok) {
      console.warn(`[tether] page version lookup as ${as}: HTTP ${res.status}`);
      return out;
    }
    for (const r of ((await res.json()) as { results?: ContentResult[] }).results ?? []) {
      if (typeof r.version?.number === 'number') out.set(String(r.id), r.version.number);
    }
  } catch (e) {
    // A failed lookup must not break reading the report.
    console.warn(`[tether] page version lookup as ${as} threw: ${(e as Error).message}`);
  }
  return out;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

function text(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? e)
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function statusMacroTitle(html: string): string | null {
  const m = /ac:name="status"[\s\S]*?<ac:parameter ac:name="title">([^<]*)<\/ac:parameter>/i.exec(html);
  return m ? m[1]!.trim() : null;
}

function accountId(html: string): string | undefined {
  return /ri:account-id="([^"]+)"/.exec(html)?.[1];
}

/** Parses the first Page Properties ("details") table into a field map. */
export function parsePageProperties(storage: string): Record<string, { text: string; html: string }> {
  // End at the table, not at </ac:structured-macro>: cells contain nested macros (status, mentions).
  const macro = /<ac:structured-macro[^>]*ac:name="details"[\s\S]*?<\/table>/i.exec(storage)?.[0] ?? storage;
  const fields: Record<string, { text: string; html: string }> = {};
  for (const row of macro.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => c[1]!);
    if (cells.length < 2) continue;
    const key = text(cells[0]!).toLowerCase().replace(/[^a-z]/g, '');
    fields[key] = { text: text(cells[1]!), html: cells[1]! };
  }
  return fields;
}

const STATUS: Record<string, DecisionStatus> = {
  accepted: 'ACCEPTED',
  approved: 'ACCEPTED',
  decided: 'ACCEPTED',
  proposed: 'PROPOSED',
  draft: 'PROPOSED',
  superseded: 'SUPERSEDED',
  deprecated: 'DEPRECATED',
  rejected: 'REJECTED',
};

const list = (s: string | undefined) => (s ?? '').split(/[,;\n]/).map((x) => x.trim()).filter((x) => x && x !== '-' && x.toLowerCase() !== 'none');

export function toRawDecision(page: ContentResult, siteUrl: string): RawDecision | null {
  const storage = page.body?.storage?.value ?? '';
  const f = parsePageProperties(storage);
  const statement = f['decision']?.text ?? f['decisionstatement']?.text;
  if (!statement) return null; // not a decision record
  const warnings: string[] = [];
  const rawStatus = (f['status'] ? statusMacroTitle(f['status'].html) ?? f['status'].text : '').toLowerCase();
  const status = STATUS[rawStatus] ?? 'UNKNOWN';
  if (status === 'UNKNOWN') warnings.push(`Unrecognised status "${rawStatus}"`);
  const service = f['service']?.text.toLowerCase().replace(/\s+/g, '-') || '*';
  if (!f['service']) warnings.push('No Service field; treated as applying to all services');
  const decisionId = f['decisionid']?.text || page.title.split(/[:\s]/)[0] || page.id;
  const ownerHtml = f['owner']?.html ?? '';
  return {
    decisionId,
    title: page.title.replace(/^[A-Z]+-[A-Z]+-\d+:\s*/, ''),
    status,
    scope: { service, environments: list(f['environments']?.text ?? f['environment']?.text), conditions: list(f['conditions']?.text) },
    owner: f['owner'] ? { accountId: accountId(ownerHtml), displayName: f['owner'].text || 'Unknown' } : undefined,
    statement,
    rationale: f['rationale']?.text,
    supersedes: list(f['supersedes']?.text),
    supersededBy: list(f['supersededby']?.text),
    effectiveDate: f['effectivedate']?.text || undefined,
    source: {
      kind: 'CONFLUENCE_PAGE',
      id: page.id,
      title: page.title,
      url: `${siteUrl}/wiki${page._links?.webui ?? `/pages/viewpage.action?pageId=${page.id}`}`,
      version: page.version?.number,
      location: 'Decision',
      quote: statement,
    },
    parse: { method: 'PAGE_PROPERTIES', warnings },
  };
}

export class ConfluenceDecisionAdapter implements DecisionPort {
  constructor(
    private readonly siteUrl: string,
    private readonly spaceKeys: string[],
    private readonly label: string,
    private readonly as: Actor,
    /** When running as the app, only return pages this user may read. */
    private readonly forAccountId?: string,
  ) {}

  async search(q: DecisionQuery): Promise<DecisionSearchResult> {
    const spaces = this.spaceKeys.map((k) => `"${k.replace(/"/g, '')}"`).join(',');
    const cql = `type=page AND label="${this.label}" AND space in (${spaces})`;
    const res = await actor(this.as).requestConfluence(
      route`/wiki/rest/api/content/search?cql=${cql}&limit=50&expand=body.storage,version,metadata.labels`,
      { headers: { Accept: 'application/json' } },
    );
    await ensureOk(res, 'Searching decision records');
    const pages = ((await res.json()) as { results: ContentResult[] }).results;

    // Pages linked to the ticket (Teamwork Graph / remote links) count even without the label.
    const have = new Set(pages.map((p) => p.id));
    // One CQL lookup: v1 GET /content/{id} answers 410 Gone.
    const extra = q.linkedPageIds.filter((x) => !have.has(x) && /^\d+$/.test(x)).slice(0, 10);
    if (extra.length > 0) {
      const idCql = `type=page AND id in (${extra.join(',')})`;
      const r = await actor(this.as).requestConfluence(
        route`/wiki/rest/api/content/search?cql=${idCql}&limit=10&expand=body.storage,version,metadata.labels`,
        { headers: { Accept: 'application/json' } },
      );
      if (r.ok) pages.push(...(((await r.json()) as { results?: ContentResult[] }).results ?? []));
      else console.warn(`[tether] linked page lookup failed: HTTP ${r.status}`);
    }

    const readable = await this.filterReadable(pages);
    return {
      decisions: readable.map((p) => toRawDecision(p, this.siteUrl)).filter((d): d is RawDecision => d !== null),
      spacesSearched: this.spaceKeys,
      decisionLabel: this.label,
    };
  }

  /** asApp can see restricted pages; never leak them to a user who cannot. */
  private async filterReadable(pages: ContentResult[]): Promise<ContentResult[]> {
    if (this.as === 'user') return pages;
    if (!this.forAccountId) throw new PortError('App-scoped retrieval needs the requesting accountId', 'NO_ACCOUNT_ID');
    const out: ContentResult[] = [];
    for (const p of pages) {
      const r = await actor('app').requestConfluence(route`/wiki/rest/api/content/${p.id}/permission/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: { type: 'user', identifier: this.forAccountId }, operation: 'read' }),
      });
      if (r.ok && ((await r.json()) as { hasPermission?: boolean }).hasPermission) out.push(p);
    }
    return out;
  }
}
