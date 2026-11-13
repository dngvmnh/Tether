/**
 * Strict, label-based scoring for extracted reports. Unlike an overall verdict check,
 * this catches missed requirements even when the ticket still has the right verdict.
 * No model or network access. Free-text condition paraphrases require human review.
 */
import type { AnalysisReport, Claim, DecisionRecord } from '../src/contracts';
import { normalizeForQuote, verifyQuote } from '../src/engine/evidence';
import { normalizeEnv } from '../src/engine/scope';
import { normalizeValue, unitInfo } from '../src/engine/units';
import { goldDecisions, type GoldScenario } from './gold';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeCondition = (s: string) => normalize(s).replace(/\brequests\b/g, 'request');
const sameSet = (a: string[], b: string[], norm = normalize) => JSON.stringify([...new Set(a.map(norm))].sort()) === JSON.stringify([...new Set(b.map(norm))].sort());

function overlappingQuotes(a: Claim, b: Claim): boolean {
  return verifyQuote(a.source.quote, b.source.quote) || verifyQuote(b.source.quote, a.source.quote);
}

function numericFields(c: Claim) {
  const value = c.value === undefined ? undefined : normalizeValue(c.value, c.unit, c.countingSemantics);
  const max = c.valueMax === undefined ? undefined : normalizeValue(c.valueMax, c.unit, c.countingSemantics);
  return { value: value?.value ?? c.value, max: max?.value ?? c.valueMax,
    dimension: value?.dimension ?? unitInfo(c.unit)?.dimension ?? normalize(c.unit ?? ''),
    ambiguous: value?.ambiguousCounting ?? false, alternative: value?.alternative };
}

function differingFields(expected: Claim, actual: Claim): string[] {
  const fields: string[] = [];
  if (actual.attribute !== expected.attribute) fields.push('attribute');
  if (actual.operator !== expected.operator) fields.push('operator');
  if (actual.modality !== expected.modality) fields.push('modality');
  if (actual.material !== expected.material) fields.push('material');
  if (normalize(actual.scope.service) !== normalize(expected.scope.service)) fields.push('service');
  if (!sameSet(actual.scope.environments, expected.scope.environments, normalizeEnv)) fields.push('environments');
  if (!sameSet(actual.scope.conditions, expected.scope.conditions, normalizeCondition)) fields.push('conditions');
  const e = numericFields(expected), a = numericFields(actual);
  if (a.value !== e.value) fields.push('value');
  if (a.max !== e.max) fields.push('valueMax');
  if (a.dimension !== e.dimension) fields.push('unit');
  if (a.ambiguous !== e.ambiguous || a.alternative !== e.alternative) fields.push('countingSemantics');
  if ((expected.operator === 'QUALITATIVE' || expected.textValue !== undefined)
    && normalize(expected.textValue ?? '') !== normalize(actual.textValue ?? '')) fields.push('textValue');
  return fields;
}

export function scoreScenario(scenario: GoldScenario, report: AnalysisReport, referenceDecisions: readonly DecisionRecord[] = goldDecisions()) {
  const missingClaims: string[] = [];
  const claimErrors: Array<{ expectedClaimId: string; actualClaimId: string; fields: string[] }> = [];
  const evidenceErrors: string[] = [];
  const structuralErrors: string[] = [];
  const matches = new Map<string, Claim>();
  const remaining = new Set(report.claims);

  // Match by source meaning, not generated C1/C2 ids: the model may reorder claims.
  // Prefer attribute+quote before quote-only, then attribute-only to diagnose bad quotes.
  for (const pass of [0, 1, 2]) {
    for (const expected of scenario.claims) {
      if (matches.has(expected.id)) continue;
      const actual = [...remaining].find((candidate) => {
        const quoteMatch = overlappingQuotes(expected, candidate);
        const attrMatch = expected.attribute === candidate.attribute;
        return pass === 0 ? quoteMatch && attrMatch : pass === 1 ? quoteMatch : attrMatch;
      });
      if (actual) { matches.set(expected.id, actual); remaining.delete(actual); }
    }
  }

  for (const expected of scenario.claims) {
    const actual = matches.get(expected.id);
    if (!actual) { if (expected.material) missingClaims.push(expected.id); continue; }
    const fields = differingFields(expected, actual);
    const suffix = expected.id.slice(scenario.ticket.issueKey.length + 1);
    if (scenario.expected.acceptedOperators?.[suffix]?.includes(actual.operator)) {
      const index = fields.indexOf('operator');
      if (index !== -1) fields.splice(index, 1);
    }
    const expectedFinding = scenario.expected.claims[suffix];
    const findings = report.findings.filter((f) => f.claimId === actual.id);
    if (expectedFinding) {
      if (findings.length !== 1) fields.push('findingCount');
      else {
        if (findings[0]!.outcome !== expectedFinding[0]) fields.push('outcome');
        if (findings[0]!.reason !== expectedFinding[1]) fields.push('reason');
      }
    }
    if (fields.length) claimErrors.push({ expectedClaimId: expected.id, actualClaimId: actual.id, fields });
  }

  const unexpectedClaims = [...remaining].filter((c) => c.material).map((c) => c.id);
  const ids = report.claims.map((c) => c.id);
  if (new Set(ids).size !== ids.length) structuralErrors.push('Duplicate claim ids');
  if (report.issueKey !== scenario.ticket.issueKey) structuralErrors.push('Wrong issue key');
  const fieldText: Record<string, string> = { summary: scenario.ticket.summary, description: scenario.ticket.description,
    'acceptance criteria': scenario.ticket.acceptanceCriteria };

  for (const claim of report.claims) {
    const field = fieldText[normalize(claim.source.location ?? '')];
    if (claim.source.id !== scenario.ticket.issueKey || claim.source.kind !== 'JIRA_ISSUE'
      || field === undefined || !verifyQuote(claim.source.quote, field)) evidenceErrors.push(`${claim.id}: invalid ticket evidence`);
  }
  for (const finding of report.findings) {
    const claim = report.claims.find((c) => c.id === finding.claimId);
    if (!claim) { structuralErrors.push(`${finding.id}: unknown claim id`); continue; }
    if (normalizeForQuote(finding.ticketEvidence.quote) !== normalizeForQuote(claim.source.quote)
      || finding.ticketEvidence.id !== claim.source.id || finding.ticketEvidence.kind !== 'JIRA_ISSUE') evidenceErrors.push(`${finding.id}: finding cites a different ticket statement`);
    for (const evidence of finding.decisionEvidence) {
      const decision = report.decisions.find((d) => d.source.id === evidence.id);
      const reference = decision && referenceDecisions.find((d) => d.decisionId === decision.decisionId);
      if (!decision || !reference || !verifyQuote(evidence.quote, reference.statement)
        || !verifyQuote(evidence.quote, decision.statement)) evidenceErrors.push(`${finding.id}: invalid decision evidence ${evidence.id}`);
    }
    if (finding.decisionIds.some((id) => !report.decisions.some((d) => d.decisionId === id))) structuralErrors.push(`${finding.id}: unknown decision id`);
  }

  const material = report.claims.filter((c) => c.material);
  const checked = material.filter((c) => report.findings.some((f) => f.claimId === c.id && f.outcome !== 'INSUFFICIENT_EVIDENCE')).length;
  const coverage = `${report.coverage.checkedMaterialClaims}/${report.coverage.materialClaims}`;
  const coverageError = report.coverage.totalClaims !== report.claims.length || report.coverage.materialClaims !== material.length
    || report.coverage.checkedMaterialClaims !== checked || (!!scenario.expected.coverage && coverage !== scenario.expected.coverage);
  const outcomeMatch = report.overallOutcome === scenario.expected.overall;
  return {
    id: scenario.id, title: scenario.title, expected: scenario.expected.overall, actual: report.overallOutcome,
    pass: outcomeMatch && report.status === 'COMPLETE' && report.errors.length === 0 && !coverageError
      && missingClaims.length === 0 && unexpectedClaims.length === 0 && claimErrors.length === 0 && evidenceErrors.length === 0 && structuralErrors.length === 0,
    outcomeMatch,
    missedConflict: scenario.expected.overall === 'CONFLICT' && report.overallOutcome !== 'CONFLICT',
    falseConflict: scenario.expected.overall !== 'CONFLICT' && report.overallOutcome === 'CONFLICT',
    falseNoConflict: scenario.expected.overall !== 'NO_CONFLICT_FOUND' && report.overallOutcome === 'NO_CONFLICT_FOUND',
    coverage, coverageError, missingClaims, unexpectedClaims, claimErrors, evidenceErrors, structuralErrors,
    operationalErrors: report.errors.map((e) => `${e.stage}:${e.code}`),
  };
}
