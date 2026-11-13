/**
 * Loads the golden scenario set (eval/*.json) as contract objects.
 * Used by unit tests, offline eval, UI fixture generation and the in-Forge eval runner.
 */
import decisionsJson from './decisions.json';
import scenariosJson from './scenarios.json';
import type {
  Claim,
  CountingSemantics,
  DecisionRecord,
  DecisionStatus,
  Modality,
  Operator,
  Outcome,
  RawDecision,
  ReasonCode,
  TicketSnapshot,
} from '../src/contracts';

interface GoldConstraint {
  subject?: string;
  service?: string;
  environments?: string[];
  conditions?: string[];
  attr: string;
  label: string;
  op: string;
  value?: number;
  valueMax?: number;
  textValue?: string;
  unit?: string;
  counting?: string;
  modality: string;
  quote: string;
  location?: string;
  material?: boolean;
}

interface GoldDecision {
  decisionId: string;
  title: string;
  status: string;
  service: string;
  environments: string[];
  conditions: string[];
  owner: string;
  effectiveDate: string;
  supersedes: string[];
  supersededBy: string[];
  statement: string;
  rationale: string;
  constraints: GoldConstraint[];
}

export interface GoldScenario {
  id: string;
  title: string;
  ticket: TicketSnapshot;
  claims: Claim[];
  expected: { overall: Outcome; coverage?: string; claims: Record<string, [Outcome, ReasonCode]>; acceptedOperators?: Record<string, Operator[]> };
}

export const DEMO_SITE = 'https://example.atlassian.net';
export const GOLD_SPACE = decisionsJson.space;

function pageId(decisionId: string): string {
  // Stable fake page ids for offline use; real ids come from Confluence.
  let h = 0;
  for (const ch of decisionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return String(100000 + (h % 900000));
}

function toClaim(g: GoldConstraint, id: string, source: Claim['source'], fallbackService: string): Claim {
  return {
    id,
    subject: g.subject ?? 'Payment Service',
    attribute: g.attr,
    attributeLabel: g.label,
    operator: g.op as Operator,
    value: g.value,
    valueMax: g.valueMax,
    textValue: g.textValue,
    unit: g.unit,
    countingSemantics: (g.counting ?? 'NOT_APPLICABLE') as CountingSemantics,
    modality: g.modality as Modality,
    scope: { service: g.service ?? fallbackService, environments: g.environments ?? [], conditions: g.conditions ?? [] },
    material: g.material ?? true,
    source: { ...source, quote: g.quote, location: g.location ?? source.location },
    confidence: 1,
  };
}

export function goldRawDecisions(site = DEMO_SITE): RawDecision[] {
  return (decisionsJson.decisions as GoldDecision[]).map((d) => ({
    decisionId: d.decisionId,
    title: d.title,
    status: d.status as DecisionStatus,
    scope: { service: d.service, environments: d.environments, conditions: d.conditions },
    owner: { displayName: d.owner },
    statement: d.statement,
    rationale: d.rationale,
    supersedes: d.supersedes,
    supersededBy: d.supersededBy,
    effectiveDate: d.effectiveDate || undefined,
    source: {
      kind: 'CONFLUENCE_PAGE',
      id: pageId(d.decisionId),
      title: `${d.decisionId}: ${d.title}`,
      url: `${site}/wiki/spaces/${GOLD_SPACE.key}/pages/${pageId(d.decisionId)}`,
      version: 1,
      location: 'Decision',
      quote: d.statement,
    },
    parse: { method: 'FIXTURE', warnings: [] },
  }));
}

export function goldDecisions(site = DEMO_SITE): DecisionRecord[] {
  const raws = goldRawDecisions(site);
  return (decisionsJson.decisions as GoldDecision[]).map((d, i) => {
    const raw = raws[i]!;
    return {
      ...raw,
      constraints: d.constraints.map((c, k) =>
        toClaim(
          { ...c, environments: c.environments ?? d.environments, conditions: c.conditions ?? d.conditions, service: d.service },
          `${d.decisionId}-K${k + 1}`,
          { ...raw.source, location: 'Decision' },
          d.service,
        ),
      ),
    };
  });
}

export function goldScenarios(site = DEMO_SITE, projectKey = 'PAY'): GoldScenario[] {
  return scenariosJson.scenarios.map((s, idx) => {
    const issueKey = `${projectKey}-${101 + idx}`;
    const ticket: TicketSnapshot = {
      issueKey,
      issueId: String(10100 + idx),
      projectKey,
      issueType: 'Story',
      url: `${site}/browse/${issueKey}`,
      summary: s.ticket.summary,
      description: s.ticket.description,
      acceptanceCriteria: s.ticket.acceptanceCriteria,
      labels: ['tether-demo', `tether-${s.id.toLowerCase()}`],
      components: [],
      updatedAt: '2026-11-08T09:00:00.000Z',
    };
    const source = { kind: 'JIRA_ISSUE' as const, id: issueKey, title: s.ticket.summary, url: ticket.url, quote: '' };
    const claims = (s.claims as GoldConstraint[]).map((c, i) => toClaim(c, `${issueKey}-C${i + 1}`, source, 'payment-service'));
    return {
      id: s.id,
      title: s.title,
      ticket,
      claims,
      expected: s.expected as GoldScenario['expected'],
    };
  });
}
