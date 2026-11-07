import type { CountingSemantics } from '../contracts';

export type Dimension = 'duration' | 'size' | 'count' | 'money' | 'percent' | 'unitless';
export type CountKind = 'retries' | 'attempts';

interface UnitInfo {
  dimension: Dimension;
  /** Multiplier to the dimension's base unit (ms, bytes, 1). */
  factor: number;
  countKind?: CountKind;
}

const UNIT_TABLE: Record<string, UnitInfo> = {};
function def(names: string[], info: UnitInfo) {
  for (const n of names) UNIT_TABLE[n] = info;
}

def(['ms', 'msec', 'millisecond', 'milliseconds'], { dimension: 'duration', factor: 1 });
def(['s', 'sec', 'secs', 'second', 'seconds'], { dimension: 'duration', factor: 1_000 });
def(['m', 'min', 'mins', 'minute', 'minutes'], { dimension: 'duration', factor: 60_000 });
def(['h', 'hr', 'hrs', 'hour', 'hours'], { dimension: 'duration', factor: 3_600_000 });
def(['d', 'day', 'days'], { dimension: 'duration', factor: 86_400_000 });
def(['b', 'byte', 'bytes'], { dimension: 'size', factor: 1 });
def(['kb', 'kib', 'kilobyte', 'kilobytes'], { dimension: 'size', factor: 1024 });
def(['mb', 'mib', 'megabyte', 'megabytes'], { dimension: 'size', factor: 1024 ** 2 });
def(['gb', 'gib', 'gigabyte', 'gigabytes'], { dimension: 'size', factor: 1024 ** 3 });
def(['retry', 'retries', 'times', 'retry attempts'], { dimension: 'count', factor: 1, countKind: 'retries' });
def(['attempt', 'attempts', 'tries', 'total attempts'], { dimension: 'count', factor: 1, countKind: 'attempts' });
def(['usd', '$', 'dollars'], { dimension: 'money', factor: 1 });
def(['%', 'percent', 'pct'], { dimension: 'percent', factor: 1 });
def(['', 'count', 'items', 'requests', 'calls'], { dimension: 'unitless', factor: 1 });

export function unitInfo(unit: string | undefined): UnitInfo | null {
  const key = (unit ?? '').trim().toLowerCase();
  return UNIT_TABLE[key] ?? null;
}

export interface NormalizedValue {
  dimension: Dimension;
  /** Value in base units. For counts: number of retries (initial request excluded). */
  value: number;
  /** True when the retries/attempts interpretation could not be established. */
  ambiguousCounting: boolean;
  /** Alternative value under the other counting interpretation, when ambiguous. */
  alternative?: number;
}

/**
 * Normalises a value to base units. Counts are normalised to *retries excluding the
 * initial request*:
 *  - "N retries"                          -> N   (standard meaning, unless stated otherwise)
 *  - "N attempts including the initial"   -> N-1
 *  - "N attempts excluding the initial"   -> N
 *  - "N attempts" (unspecified)           -> ambiguous: N-1 or N
 */
export function normalizeValue(
  value: number,
  unit: string | undefined,
  counting: CountingSemantics,
): NormalizedValue | null {
  const info = unitInfo(unit);
  if (!info) return null;
  if (info.dimension !== 'count') {
    return { dimension: info.dimension, value: value * info.factor, ambiguousCounting: false };
  }
  if (info.countKind === 'retries') {
    const v = counting === 'INCLUDES_INITIAL' ? value - 1 : value;
    return { dimension: 'count', value: v, ambiguousCounting: false };
  }
  // attempts
  if (counting === 'INCLUDES_INITIAL') return { dimension: 'count', value: value - 1, ambiguousCounting: false };
  if (counting === 'EXCLUDES_INITIAL') return { dimension: 'count', value, ambiguousCounting: false };
  return { dimension: 'count', value: value - 1, ambiguousCounting: true, alternative: value };
}
