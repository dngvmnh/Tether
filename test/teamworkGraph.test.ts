import { describe, expect, it } from 'vitest';
import { pageIdsFromGraph, withRetry } from '../src/adapters/teamworkGraph';

describe('withRetry', () => {
  const noSleep = async () => {};

  it('retries a transient failure and returns the later success', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      if (++calls < 3) throw new Error('User is not permitted to query this organization');
      return 'ok';
    }, 3, 0, noSleep);
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws the last error after exhausting attempts', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error('still failing');
      }, 3, 0, noSleep),
    ).rejects.toThrow('still failing');
    expect(calls).toBe(3);
  });
});

describe('pageIdsFromGraph', () => {
  it('reads the page id from a remote-link viewpage URL', () => {
    const data = {
      customQuery: {
        edges: [
          {
            node: {
              columns: [
                {
                  key: 'link',
                  value: {
                    __typename: 'CypherQueryResultNode',
                    id: 'ari:cloud:jira:abc:issue-remote-link/activation/x/66400/10102',
                    data: {
                      __typename: 'JiraWorkItemRemoteLink',
                      webUrl: 'https://site.atlassian.net/wiki/pages/viewpage.action?pageId=2818055',
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };
    expect(pageIdsFromGraph(data)).toEqual(['2818055']);
  });

  it('reads the page id from a /pages/ URL and from a Confluence page ARI, deduplicated', () => {
    const data = [
      { data: { webUrl: 'https://site.atlassian.net/wiki/spaces/ENG/pages/123/ADR-1' } },
      { id: 'ari:cloud:confluence:cloud-id:page/123' },
      { id: 'ari:cloud:confluence:cloud-id:page/456' },
    ];
    expect(pageIdsFromGraph(data).sort()).toEqual(['123', '456']);
  });

  it('ignores non-page web links and empty data', () => {
    expect(pageIdsFromGraph({ data: { webUrl: 'https://example.com/docs' } })).toEqual([]);
    expect(pageIdsFromGraph(undefined)).toEqual([]);
  });
});
