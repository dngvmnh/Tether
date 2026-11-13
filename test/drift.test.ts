import { describe, expect, it } from 'vitest';
import { changedDecisions, decisionPages } from '../src/engine/drift';

type D = Parameters<typeof decisionPages>[0]['decisions'][number];
const dec = (decisionId: string, id: string, version: number | undefined, kind: D['source']['kind'] = 'CONFLUENCE_PAGE') =>
  ({ decisionId, source: { kind, id, title: decisionId, url: '', quote: '', version } }) as unknown as D;

describe('pull-based decision drift', () => {
  const report = {
    decisions: [
      dec('ADR-PAY-001', '294921', 1),
      dec('ADR-SEC-003', '196811', 3),
      dec('ADR-PAY-001', '294921', 1), // duplicate page: counted once
      dec('ADR-X', '1', undefined), // no version: cannot drift-check
      dec('TWG', '2', 1, 'TEAMWORK_GRAPH'),
    ],
  };

  it('lists versioned Confluence pages once', () => {
    expect(decisionPages(report)).toEqual([
      { pageId: '294921', decisionId: 'ADR-PAY-001', version: 1 },
      { pageId: '196811', decisionId: 'ADR-SEC-003', version: 3 },
    ]);
  });

  it('flags only pages that are now newer', () => {
    const pages = decisionPages(report);
    expect(changedDecisions(pages, new Map([['294921', 2], ['196811', 3]]))).toEqual(['ADR-PAY-001']);
    expect(changedDecisions(pages, new Map([['294921', 1], ['196811', 3]]))).toEqual([]);
  });

  it('does not flag pages it could not read', () => {
    expect(changedDecisions(decisionPages(report), new Map())).toEqual([]);
  });
});
