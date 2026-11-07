import type { Claim, ReasonCode, ScopeCheckValue } from '../contracts';
import { intersect, isEmpty, isSubset, scale, shift, toInterval, type Interval } from './interval';
import { normalizeValue, unitInfo, type Dimension } from './units';

export type PairVerdictKind =
  | 'CONFLICT'
  | 'COMPATIBLE'
  | 'COMPATIBLE_IF_TIGHTER'
  | 'AMBIGUOUS'
  | 'INCOMPARABLE';

export interface PairVerdict {
  verdict: PairVerdictKind;
  reason: ReasonCode;
  /** Whether counting semantics (attempts vs retries) lined up. */
  counting: ScopeCheckValue;
  detail: string;
}

const NUMERIC_OPS = new Set(['EQ', 'LTE', 'LT', 'GTE', 'GT', 'RANGE']);

/** "exactly 5 retries", "at most 3 retries", "required", ... */
export function describeConstraint(c: Claim): string {
  const unit = c.unit ? ` ${c.unit}` : '';
  switch (c.operator) {
    case 'EQ':
      return `exactly ${c.value}${unit}`;
    case 'LTE':
      return `at most ${c.value}${unit}`;
    case 'LT':
      return `fewer than ${c.value}${unit}`;
    case 'GTE':
      return `at least ${c.value}${unit}`;
    case 'GT':
      return `more than ${c.value}${unit}`;
    case 'RANGE':
      return `between ${c.value} and ${c.valueMax}${unit}`;
    case 'REQUIRED':
      return 'required';
    case 'PROHIBITED':
      return 'prohibited';
    default:
      return c.textValue ?? 'a qualitative requirement';
  }
}

interface NumericForm {
  dimension: Dimension;
  intervals: Interval[]; // 2 entries when counting is ambiguous
}

function numericForm(c: Claim, compareRaw: boolean): NumericForm | null {
  const raw = toInterval(c.operator, c.value, c.valueMax);
  const info = unitInfo(c.unit);
  if (!raw || !info) return null;
  if (info.dimension !== 'count') return { dimension: info.dimension, intervals: [scale(raw, info.factor)] };
  if (compareRaw) return { dimension: 'count', intervals: [raw] };
  const probe = normalizeValue(0, c.unit, c.countingSemantics)!;
  const intervals = [shift(raw, probe.value)];
  if (probe.ambiguousCounting && probe.alternative !== undefined) intervals.push(shift(raw, probe.alternative));
  return { dimension: 'count', intervals };
}

function intervalVerdict(t: Interval, d: Interval): 'CONFLICT' | 'COMPATIBLE' | 'COMPATIBLE_IF_TIGHTER' {
  if (isEmpty(intersect(t, d))) return 'CONFLICT';
  if (isSubset(t, d)) return 'COMPATIBLE';
  return 'COMPATIBLE_IF_TIGHTER';
}

/**
 * Deterministically compares a ticket requirement with one decision constraint on the
 * same attribute. Scope is checked separately (see scope.ts).
 *
 * Semantics: a CONFLICT means no implementation can satisfy both. "Max 5" vs "max 3"
 * is COMPATIBLE_IF_TIGHTER, not a conflict.
 */
export function compareConstraint(ticket: Claim, decision: Claim): PairVerdict {
  const t = describeConstraint(ticket);
  const d = describeConstraint(decision);

  if (ticket.operator === 'QUALITATIVE' || decision.operator === 'QUALITATIVE') {
    return { verdict: 'INCOMPARABLE', reason: 'INCOMPARABLE', counting: 'UNKNOWN', detail: 'Needs semantic comparison.' };
  }

  const tBool = ticket.operator === 'REQUIRED' || ticket.operator === 'PROHIBITED';
  const dBool = decision.operator === 'REQUIRED' || decision.operator === 'PROHIBITED';
  if (tBool || dBool) {
    if (!(tBool && dBool)) {
      return { verdict: 'INCOMPARABLE', reason: 'INCOMPARABLE', counting: 'UNKNOWN', detail: `Ticket is ${t}; decision is ${d}.` };
    }
    if (ticket.operator !== decision.operator) {
      return {
        verdict: 'CONFLICT',
        reason: 'PROHIBITION_VIOLATED',
        counting: 'MATCH',
        detail: `Ticket makes ${ticket.attributeLabel} ${t}; the decision makes it ${d}.`,
      };
    }
    return { verdict: 'COMPATIBLE', reason: 'CONSISTENT', counting: 'MATCH', detail: `Both make ${ticket.attributeLabel} ${t}.` };
  }

  if (!NUMERIC_OPS.has(ticket.operator) || !NUMERIC_OPS.has(decision.operator)) {
    return { verdict: 'INCOMPARABLE', reason: 'INCOMPARABLE', counting: 'UNKNOWN', detail: 'Unsupported operator pair.' };
  }

  const tInfo = unitInfo(ticket.unit);
  const dInfo = unitInfo(decision.unit);
  // Same counting term and same declared semantics: compare the raw numbers.
  const sameCounting =
    tInfo?.dimension === 'count' &&
    dInfo?.dimension === 'count' &&
    tInfo.countKind === dInfo.countKind &&
    ticket.countingSemantics === decision.countingSemantics;

  const tf = numericForm(ticket, sameCounting);
  const df = numericForm(decision, sameCounting);
  if (!tf || !df || tf.dimension !== df.dimension) {
    return {
      verdict: 'INCOMPARABLE',
      reason: 'INCOMPARABLE',
      counting: 'UNKNOWN',
      detail: `Units are not comparable (${ticket.unit ?? 'none'} vs ${decision.unit ?? 'none'}).`,
    };
  }

  const verdicts = new Set<string>();
  for (const ti of tf.intervals) for (const di of df.intervals) verdicts.add(intervalVerdict(ti, di));
  const ambiguous = tf.intervals.length > 1 || df.intervals.length > 1;
  const counting: ScopeCheckValue = tf.dimension !== 'count' ? 'MATCH' : ambiguous ? 'UNKNOWN' : 'MATCH';

  if (verdicts.has('CONFLICT') && verdicts.size > 1) {
    return {
      verdict: 'AMBIGUOUS',
      reason: 'AMBIGUOUS_COUNTING',
      counting: 'UNKNOWN',
      detail: `Ticket requires ${t}; decision allows ${d}. Whether this conflicts depends on whether the initial request counts as an attempt.`,
    };
  }
  if (verdicts.has('CONFLICT')) {
    return { verdict: 'CONFLICT', reason: 'VALUE_CONTRADICTION', counting, detail: `Ticket requires ${t}; decision allows ${d}.` };
  }
  if (verdicts.has('COMPATIBLE_IF_TIGHTER')) {
    return {
      verdict: 'COMPATIBLE_IF_TIGHTER',
      reason: 'CONSISTENT_IF_TIGHTER',
      counting,
      detail: `Ticket allows ${t}; decision allows ${d}. Compatible if the implementation stays within the decision.`,
    };
  }
  return { verdict: 'COMPATIBLE', reason: 'CONSISTENT', counting, detail: `Ticket requires ${t}; decision allows ${d}.` };
}
