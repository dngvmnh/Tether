import type { AnalysisReport, Outcome } from '../../../../src/contracts';
import { OUTCOME_LABEL } from '../copy';

const ICON: Record<Outcome, string> = { CONFLICT: '✕', NEEDS_REVIEW: '!', NO_CONFLICT_FOUND: '✓', INSUFFICIENT_EVIDENCE: '?' };

export function OutcomeLozenge({ outcome }: { outcome: Outcome }) {
  return (
    <span className={`lozenge lozenge--${outcome}`}>
      <span aria-hidden>{ICON[outcome]}</span> {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export function CoverageMeter({ report }: { report: AnalysisReport }) {
  const { checkedMaterialClaims: checked, materialClaims: total } = report.coverage;
  const pct = total ? Math.round((checked / total) * 100) : 0;
  return (
    <div className="coverage" title={report.coverage.summary}>
      <div className="coverage__bar" role="progressbar" aria-valuenow={checked} aria-valuemin={0} aria-valuemax={total} aria-valuetext={report.coverage.summary} aria-label="Requirements checked">
        <div className="coverage__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="coverage__text">{report.coverage.summary}</span>
    </div>
  );
}

export function VerdictBanner({ report }: { report: AnalysisReport }) {
  if (report.status === 'FAILED' || !report.overallOutcome) {
    return (
      <div className="banner banner--FAILED" role="alert">
        <strong>Check could not complete.</strong> {report.headline}
        <div className="banner__sub">This is not a "no conflict" result.</div>
      </div>
    );
  }
  return (
    <div className={`banner banner--${report.overallOutcome}`}>
      <div className="banner__row">
        <OutcomeLozenge outcome={report.overallOutcome} />
        <strong className="banner__headline">{report.headline}</strong>
      </div>
      <CoverageMeter report={report} />
    </div>
  );
}
