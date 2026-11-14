/**
 * Ports: the only way the engine touches the outside world. The engine never imports
 * @forge/* (enforced by test/architecture.test.ts), so it runs and is tested in plain
 * Node. Adapters in src/adapters implement these for Forge; tests use fakes.
 */
import type { Claim, JobProgressStage, RawDecision, TicketSnapshot } from '../contracts';

export interface LlmToolRequest {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the tool arguments (generated from a zod schema). */
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
}

export interface LlmPort {
  /** Forces exactly one tool call and returns its raw (unvalidated) arguments. */
  callTool(req: LlmToolRequest): Promise<{ args: unknown; model: string }>;
}

export interface TicketPort {
  getTicket(issueKey: string): Promise<TicketSnapshot>;
}

export interface DecisionQuery {
  /** Confluence page ids linked to the ticket (remote links / Teamwork Graph). */
  linkedPageIds: string[];
  keywords: string[];
}

export interface DecisionSearchResult {
  decisions: RawDecision[];
  spacesSearched: string[];
  decisionLabel: string;
}

export interface DecisionPort {
  search(q: DecisionQuery): Promise<DecisionSearchResult>;
}

export interface GraphContext {
  linkedPageIds: string[];
  /** decisionId -> team name of the decision owner. */
  ownerTeams: Record<string, string>;
  note?: string;
  /** Set when Teamwork Graph failed and linkedPageIds came from a fallback (Jira remote links). */
  error?: string;
}

export interface GraphPort {
  contextFor(ticket: TicketSnapshot): Promise<GraphContext>;
}

/** Cache for extracted decision constraints, keyed by `${pageId}:${version}`. */
export interface ConstraintCache {
  get(key: string): Promise<Claim[] | undefined>;
  set(key: string, value: Claim[]): Promise<void>;
}

/** Error carrying a stage and code so adapters can report failures precisely. */
export class PortError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
    readonly permission = false,
  ) {
    super(message);
    this.name = 'PortError';
  }
}

export interface EngineDeps {
  tickets: TicketPort;
  decisions: DecisionPort;
  llm: LlmPort;
  graph?: GraphPort;
  cache?: ConstraintCache;
  now?: () => Date;
  newId?: () => string;
  onProgress?: (stage: JobProgressStage) => Promise<void> | void;
}
