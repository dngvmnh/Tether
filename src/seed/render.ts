/**
 * Renders demo content for the in-app "Load demo data" action. Mirrors
 * scripts/seed/render.mjs (used by the CLI seed); test/seed.test.ts checks both give the
 * same output, so the parser is tested against exactly what lands on a judge's site.
 */

export interface SeedDecision {
  decisionId: string;
  title: string;
  status: string;
  service: string;
  environments: string[];
  conditions: string[];
  owner: string;
  statement: string;
  rationale: string;
  supersedes: string[];
  supersededBy: string[];
  effectiveDate: string;
}

export interface SeedTicket {
  summary: string;
  description?: string;
  acceptanceCriteria?: string;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STATUS_COLOUR: Record<string, string> = { ACCEPTED: 'Green', PROPOSED: 'Yellow', SUPERSEDED: 'Grey', DEPRECATED: 'Grey', REJECTED: 'Red' };
const STATUS_TITLE: Record<string, string> = { ACCEPTED: 'Accepted', PROPOSED: 'Proposed', SUPERSEDED: 'Superseded', DEPRECATED: 'Deprecated', REJECTED: 'Rejected' };

export function decisionTitle(d: Pick<SeedDecision, 'decisionId' | 'title'>): string {
  return `${d.decisionId}: ${d.title}`;
}

/** Confluence storage format: Page Properties table + human-readable sections. */
export function decisionStorage(d: SeedDecision): string {
  const row = (k: string, v: string) => `<tr><th><p>${esc(k)}</p></th><td>${v}</td></tr>`;
  const p = (v: unknown) => `<p>${esc(v)}</p>`;
  const status = `<p><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">${STATUS_COLOUR[d.status] ?? 'Grey'}</ac:parameter><ac:parameter ac:name="title">${STATUS_TITLE[d.status] ?? d.status}</ac:parameter></ac:structured-macro></p>`;
  return [
    '<ac:structured-macro ac:name="details"><ac:rich-text-body><table><tbody>',
    row('Decision ID', p(d.decisionId)),
    row('Status', status),
    row('Service', p(d.service)),
    row('Environments', p(d.environments.join(', '))),
    row('Conditions', p(d.conditions.join(', '))),
    row('Owner', p(d.owner)),
    row('Decision', p(d.statement)),
    row('Rationale', p(d.rationale)),
    row('Supersedes', p(d.supersedes.join(', '))),
    row('Superseded by', p(d.supersededBy.join(', '))),
    row('Effective date', p(d.effectiveDate)),
    '</tbody></table></ac:rich-text-body></ac:structured-macro>',
    '<h2>Context</h2>',
    p(d.rationale),
    '<h2>Consequences</h2>',
    p('Tickets that contradict this decision should be clarified with the decision owner before implementation.'),
  ].join('');
}

/** Jira ADF description with an "Acceptance criteria" heading. */
export function ticketAdf(t: SeedTicket) {
  const para = (text?: string) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
  const content: unknown[] = [para(t.description)];
  const ac = (t.acceptanceCriteria ?? '').split('\n').filter(Boolean);
  if (ac.length) {
    content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Acceptance criteria' }] });
    content.push({ type: 'bulletList', content: ac.map((line) => ({ type: 'listItem', content: [para(line)] })) });
  }
  return { type: 'doc', version: 1, content };
}
