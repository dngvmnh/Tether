/**
 * Teamwork Graph adapter (owner: integration). Preview API, user-context only, so it
 * runs in the resolver / Rovo action (which have a user) and its result is passed to
 * the async worker inside the job payload.
 *
 * VERIFY FIRST (week 1): open https://<site>/gateway/api/graphql/twg (GraphiQL) on your
 * dev site and confirm the query shape and relationship names below. The docs list
 * "Content entity links entity" between JiraWorkItem and ConfluencePage but do not show
 * its Cypher name, so the query matches any relationship and filters by label.
 */
import api, { route } from '@forge/api';
import type { TicketSnapshot } from '../contracts';
import type { GraphContext, GraphPort } from '../engine/ports';

const LINKED_PAGES = `
MATCH (issue:JiraWorkItem {ari: $issueAri})-[]-(page:ConfluencePage)
RETURN page`;

const OWNER_TEAMS = `
MATCH (user:AtlassianUser {ari: $userAri})-[:atlassian_user_is_in_atlassian_team]->(team:AtlassianTeam)
RETURN team`;

// TODO(integration): confirm field names in GraphiQL; the parsers below are shape-agnostic.
const GQL = `query TetherCypher($cypherQuery: String!, $params: JSON) {
  cypherQuery(query: $cypherQuery, params: $params) {
    edges { node { columns { key value { ... on CypherQueryResultListNode { nodes { id } } } } } }
  }
}`;

async function cypher(query: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await api.asUser().requestTeamworkGraph(GQL, { cypherQuery: query, params });
  const body = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  // Missing scopes return EMPTY results, not errors: an empty answer is "unknown", not "none".
  if (body.errors?.length) throw new Error(`Teamwork Graph: ${body.errors.map((e) => e.message).join('; ')}`);
  return body.data;
}

/** Shape-agnostic: pulls every Confluence page ARI out of a GraphQL response. */
export function pageIdsFromGraph(data: unknown): string[] {
  const ids = new Set<string>();
  for (const m of JSON.stringify(data ?? null).matchAll(/ari:cloud:confluence:[^:"]+:page\/(\d+)/g)) ids.add(m[1]!);
  return [...ids];
}

export class TeamworkGraphAdapter implements GraphPort {
  constructor(private readonly cloudId: string) {}

  async contextFor(ticket: TicketSnapshot): Promise<GraphContext> {
    const issueAri = `ari:cloud:jira:${this.cloudId}:issue/${ticket.issueId}`;
    const data = await cypher(LINKED_PAGES, { issueAri });
    const linkedPageIds = pageIdsFromGraph(data);
    return {
      linkedPageIds,
      ownerTeams: {}, // TODO(integration): resolve decision owners' teams with OWNER_TEAMS once owners carry accountIds
      note: linkedPageIds.length ? `${linkedPageIds.length} page(s) linked to ${ticket.issueKey} in Teamwork Graph` : 'No pages linked in Teamwork Graph',
    };
  }
}

/** Fallback when Teamwork Graph is unavailable: Confluence pages in Jira remote links. */
export async function linkedPagesFromRemoteLinks(issueKey: string): Promise<string[]> {
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}/remotelink`);
  if (!res.ok) return [];
  const links = (await res.json()) as Array<{ object?: { url?: string } }>;
  const ids = new Set<string>();
  for (const l of links) {
    const m = /pageId=(\d+)|\/pages\/(\d+)/.exec(l.object?.url ?? '');
    if (m) ids.add((m[1] ?? m[2])!);
  }
  return [...ids];
}

export { OWNER_TEAMS };
