/**
 * LLM extraction stages (owner: engine). v0 prompts: iterate on them with the eval
 * suite (docs/EVAL.md), never by eyeballing one ticket.
 */
import { z } from 'zod';
import { CountingSemantics, Modality, Operator, type Claim, type RawDecision, type SourceRef, type TicketSnapshot } from '../../contracts';
import type { LlmPort } from '../ports';
import { callStructured } from './structured';

/** What the model returns per constraint. Ids and source metadata are added by code. */
const ExtractedConstraint = z.object({
  subject: z.string().describe('Human name of the system/component, e.g. "Payment Service"'),
  service: z.string().describe('Canonical service slug. Use one of the known services if it matches; "*" if it applies to all services'),
  attribute: z.string().describe('Canonical attribute key, e.g. "retry.count". Reuse a known attribute key whenever the meaning matches'),
  attributeLabel: z.string().describe('Short human label, e.g. "retry limit"'),
  operator: Operator,
  value: z.number().optional(),
  valueMax: z.number().optional(),
  textValue: z.string().optional().describe('For QUALITATIVE constraints: the required behaviour in a few words'),
  unit: z.string().optional().describe('retries | attempts | ms | s | min | h | days | MB | USD | % ...'),
  countingSemantics: CountingSemantics.describe(
    'For retry/attempt counts: does the number include the initial request? UNSPECIFIED if the text does not say. NOT_APPLICABLE for non-counts',
  ),
  modality: Modality.describe('MUST for must/shall/required/exactly; SHOULD for should/recommended; MAY for may/can/optional'),
  environments: z.array(z.string()).describe('Environments named in the text, e.g. ["production"]. Empty if none named'),
  conditions: z.array(z.string()).describe('Operating conditions, e.g. ["failed transactions"]. Empty if none'),
  quote: z.string().describe('The exact sentence or phrase from the text, copied verbatim'),
  location: z.string().describe('Where the quote is: "summary", "description", "acceptance criteria" or "decision"'),
  material: z.boolean().describe('true if this is a technical requirement an implementation must satisfy'),
  confidence: z.number().min(0).max(1),
});
type ExtractedConstraint = z.infer<typeof ExtractedConstraint>;

const Extraction = z.object({ constraints: z.array(ExtractedConstraint) });

export interface Vocabulary {
  services: string[];
  attributes: Array<{ key: string; label: string }>;
}

const SYSTEM = `You extract atomic technical constraints from software engineering text for a consistency checker.
Rules:
- One constraint per atomic requirement. Split "retry 3 times and log each failure" into two.
- Preserve meaning exactly. "exactly 5" is EQ, "up to 5"/"no more than 5"/"maximum 5" is LTE, "at least" is GTE.
- "must not"/"never"/"prohibited" is PROHIBITED; "must use X"/"must include X" is REQUIRED (no value).
- Retries vs attempts matter. "retry 3 times" -> unit "retries". "3 attempts" -> unit "attempts". Only set INCLUDES_INITIAL / EXCLUDES_INITIAL when the text says so.
- Never invent values, units, environments or conditions that are not in the text.
- quote must be copied verbatim from the text.
- Ignore process chatter (meetings, assignees, estimates): those are not constraints.`;

function vocabText(v: Vocabulary): string {
  const services = v.services.length ? v.services.join(', ') : '(none yet)';
  const attrs = v.attributes.length ? v.attributes.map((a) => `${a.key} (${a.label})`).join('; ') : '(none yet)';
  return `Known services: ${services}\nKnown attribute keys: ${attrs}`;
}

function toClaim(e: ExtractedConstraint, id: string, source: Omit<SourceRef, 'quote' | 'location'>): Claim {
  return {
    id,
    subject: e.subject,
    attribute: e.attribute,
    attributeLabel: e.attributeLabel,
    operator: e.operator,
    value: e.value,
    valueMax: e.valueMax,
    textValue: e.textValue,
    unit: e.unit,
    countingSemantics: e.countingSemantics,
    modality: e.modality,
    scope: { service: e.service, environments: e.environments, conditions: e.conditions },
    material: e.material,
    source: { ...source, quote: e.quote, location: e.location },
    confidence: e.confidence,
  };
}

export function ticketText(t: TicketSnapshot): string {
  return [`Summary: ${t.summary}`, `Description:\n${t.description}`, t.acceptanceCriteria ? `Acceptance criteria:\n${t.acceptanceCriteria}` : '']
    .filter(Boolean)
    .join('\n\n');
}

export async function extractTicketClaims(llm: LlmPort, ticket: TicketSnapshot, vocab: Vocabulary) {
  const r = await callStructured(llm, {
    system: SYSTEM,
    user: `${vocabText(vocab)}\n\nJira issue ${ticket.issueKey}:\n${ticketText(ticket)}`,
    toolName: 'record_requirements',
    toolDescription: 'Record every atomic technical requirement found in the Jira issue.',
    schema: Extraction,
    maxTokens: 4000,
  });
  const source = { kind: 'JIRA_ISSUE' as const, id: ticket.issueKey, title: ticket.summary, url: ticket.url };
  return { claims: r.value.constraints.map((e, i) => toClaim(e, `${ticket.issueKey}-C${i + 1}`, source)), model: r.model, calls: r.calls };
}

export async function extractDecisionConstraints(llm: LlmPort, d: RawDecision, vocab: Vocabulary) {
  const r = await callStructured(llm, {
    system: SYSTEM,
    user: `${vocabText(vocab)}\n\nDecision ${d.decisionId} (${d.status}), service ${d.scope.service}, environments ${d.scope.environments.join(', ') || 'all'}.\nDecision statement:\n${d.statement}`,
    toolName: 'record_constraints',
    toolDescription: 'Record every atomic technical constraint the decision imposes.',
    schema: Extraction,
    maxTokens: 2000,
  });
  const source = { kind: 'CONFLUENCE_PAGE' as const, id: d.source.id, title: d.title, url: d.source.url, version: d.source.version };
  return {
    constraints: r.value.constraints.map((e, i) => {
      const c = toClaim(e, `${d.decisionId}-K${i + 1}`, source);
      // The page's declared scope wins over anything the model inferred.
      c.scope = {
        service: d.scope.service,
        environments: d.scope.environments.length ? d.scope.environments : c.scope.environments,
        conditions: c.scope.conditions.length ? c.scope.conditions : d.scope.conditions,
      };
      return c;
    }),
    model: r.model,
    calls: r.calls,
  };
}
