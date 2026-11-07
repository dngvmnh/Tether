import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM helper without types
import { decisionStorage, decisionTitle, ticketAdf } from '../scripts/seed/render.mjs';
import decisionsJson from '../eval/decisions.json';
import scenariosJson from '../eval/scenarios.json';
import { toRawDecision } from '../src/adapters/confluence';
import { adfToText } from '../src/adapters/adf';

describe('seed content round-trips through the real parsers', () => {
  for (const d of decisionsJson.decisions) {
    it(`${d.decisionId} page properties parse back`, () => {
      const raw = toRawDecision(
        { id: '1', title: decisionTitle(d), version: { number: 1 }, body: { storage: { value: decisionStorage(d) } } },
        'https://example.atlassian.net',
      );
      expect(raw).not.toBeNull();
      expect(raw!.decisionId).toBe(d.decisionId);
      expect(raw!.status).toBe(d.status);
      expect(raw!.scope.service).toBe(d.service);
      expect(raw!.scope.environments).toEqual(d.environments);
      expect(raw!.statement).toBe(d.statement);
      expect(raw!.supersedes).toEqual(d.supersedes);
      expect(raw!.supersededBy).toEqual(d.supersededBy);
      expect(raw!.parse.warnings).toEqual([]);
    });
  }
  it('ticket ADF splits acceptance criteria', () => {
    for (const s of scenariosJson.scenarios) {
      const t = adfToText(ticketAdf(s.ticket));
      expect(t.description).toBe(s.ticket.description);
      expect(t.acceptanceCriteria.replace(/^- /gm, '')).toBe(s.ticket.acceptanceCriteria);
    }
  });
});
