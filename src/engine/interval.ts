import type { Operator } from '../contracts';

/** A (possibly unbounded) interval on the real line. */
export interface Interval {
  lo: number;
  loInc: boolean;
  hi: number;
  hiInc: boolean;
}

export function toInterval(op: Operator, value?: number, valueMax?: number): Interval | null {
  if (value === undefined && op !== 'RANGE') return null;
  switch (op) {
    case 'EQ':
      return { lo: value!, loInc: true, hi: value!, hiInc: true };
    case 'LTE':
      return { lo: -Infinity, loInc: false, hi: value!, hiInc: true };
    case 'LT':
      return { lo: -Infinity, loInc: false, hi: value!, hiInc: false };
    case 'GTE':
      return { lo: value!, loInc: true, hi: Infinity, hiInc: false };
    case 'GT':
      return { lo: value!, loInc: false, hi: Infinity, hiInc: false };
    case 'RANGE':
      if (value === undefined || valueMax === undefined) return null;
      return { lo: value, loInc: true, hi: valueMax, hiInc: true };
    default:
      return null;
  }
}

export function isEmpty(i: Interval): boolean {
  if (i.lo > i.hi) return true;
  if (i.lo === i.hi) return !(i.loInc && i.hiInc);
  return false;
}

export function intersect(a: Interval, b: Interval): Interval {
  let lo: number, loInc: boolean, hi: number, hiInc: boolean;
  if (a.lo > b.lo) [lo, loInc] = [a.lo, a.loInc];
  else if (b.lo > a.lo) [lo, loInc] = [b.lo, b.loInc];
  else [lo, loInc] = [a.lo, a.loInc && b.loInc];
  if (a.hi < b.hi) [hi, hiInc] = [a.hi, a.hiInc];
  else if (b.hi < a.hi) [hi, hiInc] = [b.hi, b.hiInc];
  else [hi, hiInc] = [a.hi, a.hiInc && b.hiInc];
  return { lo, loInc, hi, hiInc };
}

/** True when every value allowed by `a` is also allowed by `b`. */
export function isSubset(a: Interval, b: Interval): boolean {
  if (isEmpty(a)) return true;
  const loOk = a.lo > b.lo || (a.lo === b.lo && (!a.loInc || b.loInc));
  const hiOk = a.hi < b.hi || (a.hi === b.hi && (!a.hiInc || b.hiInc));
  return loOk && hiOk;
}

export function shift(i: Interval, delta: number): Interval {
  return { ...i, lo: i.lo + delta, hi: i.hi + delta };
}

export function scale(i: Interval, factor: number): Interval {
  return { ...i, lo: i.lo * factor, hi: i.hi * factor };
}
