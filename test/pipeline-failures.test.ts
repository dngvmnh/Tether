import { describe, expect, it } from 'vitest';
import type { Claim } from '../src/contracts';
import { analyzeIssue, PortError, type EngineDeps } from '../src/engine';
import { goldDecisions, goldRawDecisions, goldScenarios } from '../eval/gold';

function extracted(c: Claim) {
  return { subject: c.subject, service: c.scope.service, attribute: c.attribute, attributeLabel: c.attributeLabel,
    operator: c.operator, value: c.value, valueMax: c.valueMax, textValue: c.textValue, unit: c.unit,
    countingSemantics: c.countingSemantics, modality: c.modality, environments: c.scope.environments,
    conditions: c.scope.conditions, quote: c.source.quote, location: c.source.location,
    material: c.material, confidence: c.confidence };
}

function setup(id: string, failDecision?: string): EngineDeps {
  const s = goldScenarios().find((s) => s.id === id)!;
  const gold = goldDecisions();
  return {
    tickets: { getTicket: async () => s.ticket },
    decisions: { search: async () => ({ decisions: goldRawDecisions(), spacesSearched: ['ENG'], decisionLabel: 'tether-decision' }) },
    llm: { async callTool(req) {
      if (req.toolName === 'record_constraints') {
        const decisionId = /Decision (\S+)/.exec(req.user)![1]!;
        if (decisionId === failDecision) throw new PortError('Model unavailable for this decision', 'LLM_UNAVAILABLE', true);
        return { model: 'fake', args: { constraints: gold.find((d) => d.decisionId === decisionId)!.constraints.map(extracted) } };
      }
      if (req.toolName === 'record_requirements') return { model: 'fake', args: { constraints: s.claims.map(extracted) } };
      return { model: 'fake', args: { verdict: 'NOT_RELATED', explanation: 'No relevant restriction.', confidence: 0.8 } };
    } },
  };
}

describe('partial pipeline failures never become an unsupported pass', () => {
  it('marks coverage incomplete if one decision could not be extracted', async () => {
    const r = await analyzeIssue('PAY-106', setup('S06', 'ADR-PAY-009'));
    expect(r.status).toBe('PARTIAL');
    expect(r.overallOutcome).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.coverage.checkedMaterialClaims).toBe(0);
    expect(r.errors[0]).toMatchObject({ stage: 'EXTRACT_DECISION_CONSTRAINTS', code: 'LLM_UNAVAILABLE' });
  });

  it('preserves a supported conflict when another decision extraction fails', async () => {
    const r = await analyzeIssue('PAY-101', setup('S01', 'ADR-PAY-009'));
    expect(r.status).toBe('PARTIAL');
    expect(r.overallOutcome).toBe('CONFLICT');
    expect(r.findings.some((f) => f.outcome === 'CONFLICT')).toBe(true);
  });

  it('keeps retrieval failure separate from analysis outcomes', async () => {
    const deps = setup('S06');
    deps.decisions.search = async () => { throw new PortError('Search failed', 'HTTP_503', true); };
    const r = await analyzeIssue('PAY-106', deps);
    expect(r.status).toBe('PARTIAL');
    expect(r.overallOutcome).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.errors[0]).toMatchObject({ stage: 'RETRIEVE_DECISIONS', code: 'HTTP_503' });
    expect(r.findings.every((f) => f.reason === 'RETRIEVAL_FAILED')).toBe(true);
  });

  it('does not trust fabricated evidence from an old cache entry', async () => {
    const deps = setup('S01');
    deps.cache = {
      async get(key) {
        const d = goldDecisions().find((d) => key === `${d.source.id}:${d.source.version}`)!;
        return d.constraints.map((c) => ({ ...c, source: { ...c.source, quote: 'This is invented cached evidence.' } }));
      },
      async set() {},
    };
    const r = await analyzeIssue('PAY-101', deps);
    expect(r.overallOutcome).toBe('NEEDS_REVIEW');
    expect(r.findings.find((f) => f.claimId.endsWith('C1'))!.reason).toBe('UNVERIFIED_EVIDENCE');
  });

  it('fails when ticket evidence is fabricated on both extraction attempts', async () => {
    const deps = setup('S01');
    const original = deps.llm.callTool;
    deps.llm.callTool = async (req) => req.toolName === 'record_requirements'
      ? { model: 'fake', args: { constraints: [{ ...extracted(goldScenarios()[0]!.claims[0]!), quote: 'Invented ticket requirement.' }] } }
      : original(req);
    const r = await analyzeIssue('PAY-101', deps);
    expect(r.status).toBe('FAILED');
    expect(r.overallOutcome).toBeNull();
    expect(r.errors[0]!.stage).toBe('EXTRACT_CLAIMS');
  });

  it('keeps an earlier conflict when semantic comparison of a later claim fails', async () => {
    const deps = setup('S09');
    const original = deps.llm.callTool;
    deps.llm.callTool = async (req) => {
      if (req.toolName === 'record_verdict') throw new PortError('Semantic model unavailable', 'LLM_UNAVAILABLE', true);
      return original(req);
    };
    const r = await analyzeIssue('PAY-109', deps);
    expect(r.status).toBe('PARTIAL');
    expect(r.overallOutcome).toBe('CONFLICT');
    expect(r.coverage.checkedMaterialClaims).toBe(2);
    expect(r.coverage.materialClaims).toBe(3);
    expect(r.errors[0]).toMatchObject({ stage: 'COMPARE', code: 'LLM_UNAVAILABLE', claimIds: ['PAY-109-C3'] });
    expect(r.findings).toHaveLength(3);
  });
});
