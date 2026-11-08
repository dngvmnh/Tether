# Evaluation

One golden dataset, four uses:

| Use | Command | Needs Forge? |
|---|---|---|
| Unit tests: deterministic engine on gold claims | `npm test` | No |
| Offline eval table | `npm run eval:offline` | No |
| UI fixtures | `npm run fixtures` | No |
| Demo data on a site | `npm run seed` | Your site + token |
| End-to-end eval with real LLM extraction | Tether settings → Run eval | Your dev env |

Files: `eval/decisions.json` (decision library + gold constraints),
`eval/scenarios.json` (tickets + gold claims + expected outcomes), `eval/gold.ts` (loader).

## Scenarios

| Id | Scenario | Expected |
|---|---|---|
| S01 | Exactly 5 retries vs current ADR max 3 | Conflict |
| S02 | Up to 5 retries vs max 3 | No conflict found (compatible if tighter) |
| S03 | "Exactly 4 attempts", counting unspecified | Needs review |
| S04 | Cites superseded ADR-PAY-000 | Conflict with current ADR-PAY-001 |
| S05 | Notification service; only payment ADRs exist | Insufficient evidence (not applicable) |
| S06 | Idempotency + max 2 retries | No conflict found |
| S07 | Metrics interval, no decision | Insufficient evidence |
| S08 | Two current decisions disagree on log retention | Needs review |
| S09 | Conflict + covered + uncovered requirement | Conflict, coverage 2/3 |
| S10 | Store full card number vs prohibition | Conflict |
| S11 | Only a proposed decision disagrees | Needs review |
| S12 | Staging ticket vs production-only decision | Insufficient evidence |
| S13 | 4 attempts including initial = 3 retries | No conflict found |
| S14 | 15000 ms vs ≤ 10 s | Conflict |
| S15 | Non-technical ticket | Insufficient evidence |

Adding a scenario: add the ticket, gold claims (quotes must be verbatim) and expected
outcome; run `npm test` and `npm run fixtures`; if it needs a new decision, add it to
`decisions.json` and re-run `npm run seed` on your site.

## End-to-end eval in Forge

Deploy to your environment, then in Jira go to **Apps → Tether settings → Evaluation → Run eval**
(Jira admins only), wait 1-3 minutes and press **Refresh**. It uses fixture data only, never
site data. There is deliberately no web trigger: a web trigger counts as egress and makes the
app ineligible for Runs on Atlassian.

Report per run: passed/total, missed conflicts, false conflicts, false "no conflict",
extraction count vs gold, LLM calls, duration, model. Record each run in the table below.
These numbers show the prototype handles its intended cases; they are not a claim of
real-world precision or recall.

| Date | Model | Passed | Missed conflicts | False conflicts | False "no conflict" | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |
