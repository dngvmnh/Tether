import { describe, expect, it } from 'vitest';
import { AnalysisReport, DecisionRecord } from '../src/contracts';
import { assembleReport, assessClaims, verifyQuote } from '../src/engine';
import { ticketText } from '../src/engine/llm/extract';
import { goldDecisions, goldScenarios } from '../eval/gold';

const decisions = goldDecisions();
const scenarios = goldScenarios();

describe('gold data integrity', () => {
  it('decision constraints quote their statements verbatim', () => {
    for (const d of decisions) {
      expect(() => DecisionRecord.parse(d)).not.toThrow();
      for (const c of d.constraints) expect(verifyQuote(c.source.quote, d.statement), `${c.id}`).toBe(true);
    }
  });
  it('scenario claims quote their tickets verbatim', () => {
    for (const s of scenarios) {
      for (const c of s.claims) expect(verifyQuote(c.source.quote, ticketText(s.ticket)), `${s.id} ${c.id}`).toBe(true);
    }
  });
});

describe('deterministic engine on gold claims', () => {
  for (const s of scenarios) {
    it(`${s.id} ${s.title} -> ${s.expected.overall}`, async () => {
      const findings = await assessClaims({ claims: s.claims, decisions });
      const report = assembleReport({
        reportId: `R-${s.id}`,
        issueKey: s.ticket.issueKey,
        ticket: s.ticket,
        claims: s.claims,
        decisions,
        findings,
        errors: [],
        spacesSearched: ['ENG'],
        decisionLabel: 'tether-decision',
        graph: { used: false, linkedPages: 0 },
        generatedAt: '2026-11-08T09:00:00.000Z',
        durationMs: 0,
        llmCalls: 0,
        models: [],
      });
      expect(() => AnalysisReport.parse(report)).not.toThrow();
      expect(report.overallOutcome).toBe(s.expected.overall);
      for (const [cid, [outcome, reason]] of Object.entries(s.expected.claims)) {
        const f = report.findings.find((x) => x.claimId === `${s.ticket.issueKey}-${cid}`);
        expect(f, `${s.id} ${cid}`).toBeDefined();
        expect([f!.outcome, f!.reason], `${s.id} ${cid}: ${f!.explanation}`).toEqual([outcome, reason]);
      }
      if (s.expected.coverage) {
        expect(`${report.coverage.checkedMaterialClaims}/${report.coverage.materialClaims}`).toBe(s.expected.coverage);
      }
    });
  }
});
