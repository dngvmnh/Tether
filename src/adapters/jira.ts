/** Jira adapter (owner: integration). */
import { route } from '@forge/api';
import type { FollowUpDraft, TicketSnapshot } from '../contracts';
import type { TicketPort } from '../engine/ports';
import { adfToText, textToAdf } from './adf';
import { actor, ensureOk, type Actor } from './http';

interface JiraIssueResponse {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: unknown;
    labels?: string[];
    components?: Array<{ name: string }>;
    updated: string;
    project: { key: string };
    issuetype: { name: string };
  };
}

export class JiraTicketAdapter implements TicketPort {
  constructor(
    private readonly siteUrl: string,
    private readonly as: Actor = 'user',
  ) {}

  async getTicket(issueKey: string): Promise<TicketSnapshot> {
    const res = await actor(this.as).requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=summary,description,labels,components,updated,project,issuetype`,
      { headers: { Accept: 'application/json' } },
    );
    await ensureOk(res, `Fetching ${issueKey}`);
    const issue = (await res.json()) as JiraIssueResponse;
    const { description, acceptanceCriteria } = adfToText(issue.fields.description);
    // TODO(integration): if the site uses a dedicated "Acceptance criteria" custom field,
    // read it here (configurable field id) and prefer it over the heading split.
    return {
      issueKey: issue.key,
      issueId: issue.id,
      projectKey: issue.fields.project.key,
      issueType: issue.fields.issuetype.name,
      url: `${this.siteUrl}/browse/${issue.key}`,
      summary: issue.fields.summary,
      description,
      acceptanceCriteria,
      labels: issue.fields.labels ?? [],
      components: (issue.fields.components ?? []).map((c) => c.name),
      updatedAt: issue.fields.updated,
    };
  }

  /** Cheap staleness probe: the issue's current `updated` timestamp. */
  async getUpdatedAt(issueKey: string): Promise<string | null> {
    const res = await actor(this.as).requestJira(route`/rest/api/3/issue/${issueKey}?fields=updated`);
    if (!res.ok) return null;
    return ((await res.json()) as JiraIssueResponse).fields.updated;
  }
}

/** Creates the user-confirmed follow-up issue AS THE USER, links it and the decisions. */
export async function createFollowUpIssue(draft: FollowUpDraft, siteUrl: string): Promise<{ issueKey: string; url: string }> {
  const jira = actor('user');
  const created = await jira.requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: draft.projectKey },
        issuetype: { name: draft.issueTypeName },
        summary: draft.summary,
        description: textToAdf(draft.descriptionText),
        labels: ['tether-follow-up'],
      },
    }),
  });
  await ensureOk(created, 'Creating follow-up issue');
  const { key } = (await created.json()) as { key: string };

  const link = await jira.requestJira(route`/rest/api/3/issueLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: { name: 'Relates' }, inwardIssue: { key }, outwardIssue: { key: draft.linkedIssueKey } }),
  });
  await ensureOk(link, 'Linking follow-up issue');

  for (const d of draft.decisionLinks) {
    const rl = await jira.requestJira(route`/rest/api/3/issue/${key}/remotelink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: { url: d.url, title: d.title } }),
    });
    await ensureOk(rl, 'Linking decision page');
  }
  return { issueKey: key, url: `${siteUrl}/browse/${key}` };
}

/** Jira admins only (used to guard setConfig). */
export async function isJiraAdmin(): Promise<boolean> {
  const res = await actor('user').requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
  if (!res.ok) return false;
  const body = (await res.json()) as { permissions?: { ADMINISTER?: { havePermission?: boolean } } };
  return body.permissions?.ADMINISTER?.havePermission === true;
}
