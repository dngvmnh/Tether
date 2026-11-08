/**
 * Teamwork Graph adapter (owner: integration). Preview API, user-context only, so it
 * runs in the resolver / Rovo action (which have a user) and its result is passed to
 * the async worker inside the job payload.
 *
 * Raw `cypherQuery` is closed to new apps ("restricted and not available to this client").
 * Apps run PERSISTED queries via `customQuery(queryKey, queryParams)`. Register the Cypher
 * below once in TWG Labs (https://teamwork-graph.atlassian.com/query-builder, Saved queries;
 * you must be a contributor on the app), then paste the returned queryKey into Tether
 * settings (config.twgLinkedPagesQueryKey). Docs:
 * https://developer.atlassian.com/platform/teamwork-graph/persisted-cypher-queries/
 *
 * Relationship: `content_entity_links_entity` (Confluence content -> entity it references).
 * Direction is inferred from the docs, not confirmed; check in TWG Labs before registering.
 */
import api, { route } from '@forge/api';
import type { TicketSnapshot } from '../contracts';
import type { GraphContext, GraphPort } from '../engine/ports';

/** Register this text in TWG Labs. paramsSchema: [{ name: "workItemId", type: "ARI", required: true }] */
// Verified in TWG Labs on a real site: `content_entity_links_entity` between a work item and a
// ConfluencePage errors in both directions, but the work item's web links ARE indexed as
// JiraWorkItemRemoteLink objects carrying the page URL (webUrl ...viewpage.action?pageId=N).
// Registered as "tether-linked-remote-links" (queryKey in docs/TEAM-SETUP.md).
export const LINKED_PAGES_CYPHER = `MATCH (item:JiraWorkItem {ari: $workItemId})-[:jira_work_item_links_jira_work_item_remote_link]->(link:JiraWorkItemRemoteLink)
RETURN link`;

const OWNER_TEAMS = `
MATCH (user:AtlassianUser {ari: $userAri})-[:atlassian_user_is_in_atlassian_team]->(team:AtlassianTeam)
RETURN team`;

// TWG requires operation names shaped `[company]_[operation]` (company >= 3 chars, operation >= 4).
const GQL = `query tether_linkedPages($queryKey: String!, $queryParams: CypherRequestParams) {
  customQuery(queryKey: $queryKey, queryParams: $queryParams, first: 25) {
    edges { node { columns { key value { __typename ... on CypherQueryResultListNode { nodes { id } } ... on CypherQueryResultNode { id data { __typename ... on JiraWorkItemRemoteLink { webUrl } } } } } } }
  }
}`;

async function persisted(queryKey: string, queryParams: Record<string, unknown>): Promise<unknown> {
  const res = await api.asUser().requestTeamworkGraph(GQL, { queryKey, queryParams });
  const body = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  // Missing scopes return EMPTY results, not errors: an empty answer is "unknown", not "none".
  if (body.errors?.length) throw new Error(`Teamwork Graph: ${body.errors.map((e) => e.message).join('; ')}`);
  return body.data;
}

/** Shape-agnostic: pulls every Confluence page ARI out of a GraphQL response. */
export function pageIdsFromGraph(data: unknown): string[] {
  const ids = new Set<string>();
  const text = JSON.stringify(data ?? null);
  for (const m of text.matchAll(/ari:cloud:confluence:[^:"]+:page\/(\d+)/g)) ids.add(m[1]!);
  // Remote links carry the page URL: ...viewpage.action?pageId=N or .../pages/N/Title
  for (const m of text.matchAll(/"webUrl":"[^"]*?(?:[?&]pageId=|\/pages\/)(\d+)/g)) ids.add(m[1]!);
  return [...ids];
}

export class TeamworkGraphAdapter implements GraphPort {
  constructor(
    private readonly cloudId: string,
    private readonly linkedPagesQueryKey: string,
  ) {}

  async contextFor(ticket: TicketSnapshot): Promise<GraphContext> {
    const workItemId = `ari:cloud:jira:${this.cloudId}:issue/${ticket.issueId}`;
    const data = await persisted(this.linkedPagesQueryKey, { workItemId });
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
