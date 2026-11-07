import type { DecisionHistoryEntry, DecisionRecord } from '../contracts';

export interface DecisionValidity {
  decisionId: string;
  /** Accepted and not superseded by another accepted decision. */
  current: boolean;
  /** Current and not part of a supersession cycle: may produce a CONFLICT. */
  authoritative: boolean;
  /** Proposed / unknown status: can only raise NEEDS_REVIEW. */
  advisory: boolean;
  supersededBy: string[];
  inCycle: boolean;
}

/**
 * "Accepted" is not the same as "current". A decision is current only if it is accepted
 * and no other *accepted* decision supersedes it (directly, via its `supersedes` field,
 * or via its own `supersededBy` field).
 */
export function computeValidity(decisions: DecisionRecord[]): Map<string, DecisionValidity> {
  const byId = new Map(decisions.map((d) => [d.decisionId, d]));
  const supersededBy = new Map<string, Set<string>>();
  const add = (oldId: string, newId: string) => {
    if (!supersededBy.has(oldId)) supersededBy.set(oldId, new Set());
    supersededBy.get(oldId)!.add(newId);
  };

  for (const d of decisions) {
    if (d.status === 'ACCEPTED') for (const old of d.supersedes) add(old, d.decisionId);
    for (const successor of d.supersededBy) {
      const s = byId.get(successor);
      // Trust the explicit field unless the successor is in the corpus and not accepted.
      if (!s || s.status === 'ACCEPTED') add(d.decisionId, successor);
    }
  }

  // Cycle detection over accepted supersession edges (A supersedes B supersedes A).
  const inCycle = new Set<string>();
  const edges = (id: string) => (byId.get(id)?.status === 'ACCEPTED' ? byId.get(id)!.supersedes : []);
  for (const start of byId.keys()) {
    const stack: Array<{ id: string; path: string[] }> = [{ id: start, path: [start] }];
    while (stack.length) {
      const { id, path } = stack.pop()!;
      for (const next of edges(id)) {
        if (next === start) path.forEach((p) => inCycle.add(p));
        else if (!path.includes(next) && path.length < 20) stack.push({ id: next, path: [...path, next] });
      }
    }
  }

  const result = new Map<string, DecisionValidity>();
  for (const d of decisions) {
    const by = [...(supersededBy.get(d.decisionId) ?? [])];
    const cycle = inCycle.has(d.decisionId);
    const current = d.status === 'ACCEPTED' && by.length === 0;
    result.set(d.decisionId, {
      decisionId: d.decisionId,
      current: current && !cycle,
      authoritative: current && !cycle,
      advisory: d.status === 'PROPOSED' || d.status === 'UNKNOWN',
      supersededBy: by,
      inCycle: cycle,
    });
  }
  return result;
}

export function historyEntry(d: DecisionRecord, v: DecisionValidity | undefined): DecisionHistoryEntry {
  return {
    decisionId: d.decisionId,
    title: d.title,
    status: d.status,
    current: v?.current ?? false,
    supersededBy: v?.supersededBy ?? [],
    url: d.source.url,
  };
}
