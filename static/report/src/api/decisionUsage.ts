/**
 * Week 4 stretch: data for the Confluence decision badge ("referenced by 4 tickets, 1 conflict").
 *
 * NOT part of src/contracts/ and NOT served by any resolver yet. Until the team agrees a
 * resolver (e.g. `getDecisionUsage`) and a Confluence module in manifest.yml, only the mock
 * answers; outside mock mode the call fails honestly with NOT_AVAILABLE instead of inventing numbers.
 */
import type { Outcome } from '../../../../src/contracts';
import { ApiError, MOCK } from './client';

export interface DecisionUsage {
  decisionId: string;
  /** Tickets whose latest report cites this decision. */
  referencedBy: number;
  /** Of those, tickets with a CONFLICT finding against this decision. */
  conflicts: number;
  tickets: Array<{ issueKey: string; outcome: Outcome }>;
}

export async function getDecisionUsage(decisionId: string): Promise<DecisionUsage> {
  if (!MOCK) {
    throw new ApiError('NOT_AVAILABLE', 'Decision usage needs a backend resolver that has not been added yet.', false);
  }
  return (await import('./mockDecisionUsage')).mockDecisionUsage(decisionId);
}
