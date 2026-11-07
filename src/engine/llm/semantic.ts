import { z } from 'zod';
import type { Claim, DecisionRecord } from '../../contracts';
import type { SemanticComparator, SemanticResult } from '../assess';
import type { LlmPort } from '../ports';
import { callStructured } from './structured';

const Verdict = z.object({
  verdict: z.enum(['CONFLICT', 'CONSISTENT', 'UNCLEAR', 'NOT_RELATED']),
  decisionId: z.string().optional().describe('The decision the verdict is about'),
  decisionQuote: z.string().optional().describe('Exact sentence from that decision statement, verbatim'),
  explanation: z.string().describe('One or two sentences a developer can act on'),
  confidence: z.number().min(0).max(1),
});

const SYSTEM = `You judge whether a Jira requirement contradicts engineering decisions.
- CONFLICT only if no implementation could satisfy both the requirement and the decision.
- Different numbers are not automatically a conflict: "max 5" and "max 3" are compatible.
- If the meaning, scope or definitions differ or are unclear, answer UNCLEAR.
- If none of the decisions is about the same topic, answer NOT_RELATED.
- decisionQuote must be copied verbatim from the decision statement.`;

/** v0 semantic comparator. Owner: engine. Used only when deterministic rules cannot decide. */
export function llmSemanticComparator(llm: LlmPort, counter: { calls: number }): SemanticComparator {
  return {
    async compare(claim: Claim, candidates: DecisionRecord[]): Promise<SemanticResult | null> {
      if (candidates.length === 0) return null;
      const decisions = candidates
        .slice(0, 8)
        .map((d) => `- ${d.decisionId} [${d.status}] service=${d.scope.service}: ${d.statement}`)
        .join('\n');
      const r = await callStructured(llm, {
        system: SYSTEM,
        user: `Requirement (${claim.subject}, ${claim.attributeLabel}): "${claim.source.quote}"\n\nDecisions:\n${decisions}`,
        toolName: 'record_verdict',
        toolDescription: 'Record the consistency verdict.',
        schema: Verdict,
        maxTokens: 800,
      });
      counter.calls += r.calls;
      return r.value;
    },
  };
}
