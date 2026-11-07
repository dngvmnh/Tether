import type { AnalysisError, Claim, Coverage, Finding, Outcome } from '../contracts';

/** Errors at these stages leave nothing trustworthy to report. */
const FATAL_STAGES = new Set(['FETCH_TICKET', 'EXTRACT_CLAIMS', 'PERMISSION', 'INTERNAL']);

export interface Aggregate {
  status: 'COMPLETE' | 'PARTIAL' | 'FAILED';
  overallOutcome: Outcome | null;
  headline: string;
  coverage: Coverage;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Ticket-level verdict. Precedence:
 *   FAILED run            -> null (never "no conflict")
 *   any CONFLICT          -> CONFLICT       (shown even when coverage is partial)
 *   any NEEDS_REVIEW      -> NEEDS_REVIEW
 *   any material claim unchecked or no technical claims -> INSUFFICIENT_EVIDENCE
 *   otherwise             -> NO_CONFLICT_FOUND
 */
export function aggregate(claims: Claim[], findings: Finding[], errors: AnalysisError[]): Aggregate {
  const material = claims.filter((c) => c.material);
  const byClaim = new Map(findings.map((f) => [f.claimId, f]));
  const fatal = errors.some((e) => e.claimIds.length === 0 && FATAL_STAGES.has(e.stage));

  const unchecked: Coverage['unchecked'] = [];
  let checked = 0;
  for (const c of material) {
    const f = byClaim.get(c.id);
    if (!f) unchecked.push({ claimId: c.id, reason: 'RETRIEVAL_FAILED' });
    else if (f.outcome === 'INSUFFICIENT_EVIDENCE') unchecked.push({ claimId: c.id, reason: f.reason });
    else checked++;
  }

  const summaryParts = [`${checked} of ${plural(material.length, 'requirement')} checked.`];
  if (unchecked.length) summaryParts.push(`${unchecked.length} ${unchecked.length === 1 ? 'has' : 'have'} insufficient evidence.`);
  const coverage: Coverage = {
    totalClaims: claims.length,
    materialClaims: material.length,
    checkedMaterialClaims: checked,
    unchecked,
    summary: material.length === 0 ? 'No technical requirements were found in this ticket.' : summaryParts.join(' '),
  };

  if (fatal) {
    const e = errors.find((x) => FATAL_STAGES.has(x.stage))!;
    return { status: 'FAILED', overallOutcome: null, headline: `Check failed: ${e.message}`, coverage };
  }

  const materialFindings = material.map((c) => byClaim.get(c.id)).filter((f): f is Finding => !!f);
  const count = (o: Outcome) => materialFindings.filter((f) => f.outcome === o).length;
  const status = errors.length ? 'PARTIAL' : 'COMPLETE';

  if (count('CONFLICT')) {
    const ids = [...new Set(materialFindings.filter((f) => f.outcome === 'CONFLICT').flatMap((f) => f.decisionIds))];
    return { status, overallOutcome: 'CONFLICT', headline: `${plural(count('CONFLICT'), 'requirement')} contradict${count('CONFLICT') === 1 ? 's' : ''} ${ids.join(', ')}`, coverage };
  }
  if (count('NEEDS_REVIEW')) {
    return { status, overallOutcome: 'NEEDS_REVIEW', headline: `${plural(count('NEEDS_REVIEW'), 'requirement')} need${count('NEEDS_REVIEW') === 1 ? 's' : ''} human review`, coverage };
  }
  if (material.length === 0) {
    return { status, overallOutcome: 'INSUFFICIENT_EVIDENCE', headline: 'No technical requirements to check', coverage };
  }
  if (unchecked.length) {
    return { status, overallOutcome: 'INSUFFICIENT_EVIDENCE', headline: `${unchecked.length} of ${plural(material.length, 'requirement')} could not be checked`, coverage };
  }
  return { status, overallOutcome: 'NO_CONFLICT_FOUND', headline: `No conflict found across ${plural(material.length, 'requirement')}`, coverage };
}
