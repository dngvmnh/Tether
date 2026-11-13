import { describe, expect, it } from 'vitest';
// @ts-expect-error untyped .mjs shared with the CLI seed
import * as cli from '../scripts/seed/render.mjs';
import decisionsJson from '../eval/decisions.json';
import scenariosJson from '../eval/scenarios.json';
import { DEFAULT_TWG_LINKED_PAGES_QUERY_KEY, TetherConfig } from '../src/contracts';
import { DEMO, scenarioLabel, seedPlan } from '../src/seed/plan';
import * as app from '../src/seed/render';

const decisions = (decisionsJson as unknown as { decisions: app.SeedDecision[] }).decisions;
const scenarios = (scenariosJson as unknown as { scenarios: Array<{ id: string; ticket: app.SeedTicket }> }).scenarios;

describe('in-app demo data', () => {
  it('renders exactly what the CLI seed renders', () => {
    for (const d of decisions) {
      expect(app.decisionTitle(d)).toBe(cli.decisionTitle(d));
      expect(app.decisionStorage(d)).toBe(cli.decisionStorage(d));
    }
    for (const s of scenarios) expect(app.ticketAdf(s.ticket)).toEqual(cli.ticketAdf(s.ticket));
  });

  it('covers every decision and scenario once, in short steps', () => {
    const plan = seedPlan(decisions.length, scenarios.length);
    expect(plan.slice(0, 2).map((t) => t.kind)).toEqual(['project', 'space']);
    const covered = (kind: 'decisions' | 'issues') =>
      plan.flatMap((t) => (t.kind === kind ? Array.from({ length: t.to - t.from }, (_, i) => t.from + i) : []));
    expect(covered('decisions')).toEqual(decisions.map((_, i) => i));
    expect(covered('issues')).toEqual(scenarios.map((_, i) => i));
    for (const t of plan) if (t.kind === 'issues') expect(t.to - t.from).toBeLessThanOrEqual(DEMO.issuesPerStep);
  });

  it('links demo issues only to decisions that exist', () => {
    const ids = new Set(decisions.map((d) => d.decisionId));
    for (const [scenario, decision] of Object.entries(DEMO.links)) {
      expect(scenarios.some((s) => s.id === scenario)).toBe(true);
      expect(ids.has(decision)).toBe(true);
    }
    expect(scenarioLabel('S01')).toBe('tether-s01');
  });

  it('defaults the Teamwork Graph query key so judges need no settings step', () => {
    expect(TetherConfig.parse({}).twgLinkedPagesQueryKey).toBe(DEFAULT_TWG_LINKED_PAGES_QUERY_KEY);
  });
});
