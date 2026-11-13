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
| S02 | Retry bound compatible; per-merchant configuration has no decision | Insufficient evidence (1 of 2 checked) |
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
| 2026-11-08 (UTC+8) | claude-sonnet-5 | 30/30 strict and overall | 0 | 0 | 0 | dev-dat 2.9.0; team-approved labels; 115,942 ms; see eval/team-approved-final-2026-11-08.json |

## Shared-site checks on 13 November 2026

Đạt ran the checks through the Jira issue panel on
`one-atlas-dscw.atlassian.net` and supplied screenshots of all 15 reports.
The reports were generated on 13 November, between the displayed times 12.20 PM
and 12.42 PM. Each screenshot showed 10 decisions retrieved from `ENG`.

Fourteen displayed overall outcomes matched the scenario expectations. PAY-8
returned CONFLICT where S08 expects NEEDS_REVIEW. The table records visible
outcomes and coverage. Collapsed finding cards were not individually inspected,
and this run does not establish strict extraction scores. Model, exact deployed
commit, full report JSON and decision-cache contents were not captured.

| Ticket | Expected overall outcome | Displayed overall outcome | Displayed coverage | Observation |
|---|---|---|---|---|
| PAY-1 | CONFLICT | CONFLICT | 1/2 | Exactly 5 retries conflicts with ADR-PAY-001 max 3. Logging remains uncovered. |
| PAY-2 | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | 1/2 | Merchant configuration is uncovered. Retry bound is compatible if kept within the ADR limit. |
| PAY-3 | NEEDS_REVIEW | NEEDS_REVIEW | 1/1 | Four attempts vs three retries requires counting clarification. |
| PAY-4 | CONFLICT | CONFLICT | 1/1 | Uses current ADR-PAY-001 and shows ADR-PAY-000 as superseded. |
| PAY-5 | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | 0/1 | Retrieved decisions do not apply to Notification Service. |
| PAY-6 | NO_CONFLICT_FOUND | NO_CONFLICT_FOUND | 2/2 | Report lists consistency with ADR-PAY-002 and ADR-PAY-001. |
| PAY-7 | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | 0/1 | No decision covers the latency metrics emission interval. |
| PAY-8 | NEEDS_REVIEW | CONFLICT | 1/1 | Reports 60 days vs ADR-PAY-008's 90 days. Competing ADR-SEC-003 is absent from the displayed finding. Pending investigation. |
| PAY-9 | CONFLICT | CONFLICT | 2/3 | Retry conflict remains visible alongside partial coverage. |
| PAY-10 | CONFLICT | CONFLICT | 1/1 | Required PAN persistence contradicts ADR-PAY-003's prohibition. |
| PAY-11 | NEEDS_REVIEW | NEEDS_REVIEW | 1/1 | ADR-PAY-005 is identified as proposed and non-authoritative. |
| PAY-12 | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | 0/1 | Quotes the staging requirement and identifies ADR-PAY-006 as outside the applicable service or environment. |
| PAY-13 | NO_CONFLICT_FOUND | NO_CONFLICT_FOUND | 1/1 | Report lists consistency with ADR-PAY-001. |
| PAY-14 | CONFLICT | CONFLICT | 1/1 | 15,000 ms conflicts with ADR-PAY-004's maximum of 10 seconds. |
| PAY-15 | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | No technical requirements | Report explicitly states that no technical requirements were found. |

Teamwork Graph reported one linked page for PAY-1, PAY-4 and PAY-8. The other
screenshots reported no linked pages.

### PAY-8 investigation and handoff

The source text Đạt supplied for ADR-SEC-003 matches `eval/decisions.json`.
Its status is ACCEPTED, service is `*`, and its statement limits logs containing
customer data to at most 30 days. Its metadata has empty environments and
conditions, with no supersession relation. The customer-data restriction is
present in the statement and must be considered when reviewing applicability.

A local diagnostic on the unchanged engine returned NEEDS_REVIEW /
COMPETING_DECISIONS for S08 using gold claims and both gold decision constraints.
Adding the customer-data condition to the security constraint also returned
NEEDS_REVIEW. Removing ADR-SEC-003 from that diagnostic returned CONFLICT /
VALUE_CONTRADICTION, matching the displayed overall outcome. This reproduction
does not prove the security decision was missing in the live run.

The Developer Console storage view was checked for Development and
`one-atlas-dscw.atlassian.net`, including a refresh and a search for `report:PAY-8`.
It displayed no stored data. The actual report and cache could not be read there.
The root cause remains unconfirmed. Before changing engine logic or S08 labels,
the integration owner should obtain `report:PAY-8` and the
`dcache:<pageId>:<version>` entries for ADR-PAY-008 and ADR-SEC-003, and compare
attribute keys, extracted constraints, scope, source versions and report errors.

### PAY-8 follow-up (Đăng, 13 Nov, 18:06 SGT)

Storage is now visible without the developer console: every analysis logs a compact
`[tether] diag <issueKey> {...}` line (claims, each decision's status, source version and
extracted constraints, findings, errors). Read it with
`forge logs -e development --since 30m | grep "diag PAY-8"`.

A fresh live run of PAY-8 (deployed `main`, `claude-sonnet-5`, 10:06:39 UTC) returned
**NEEDS_REVIEW / COMPETING_DECISIONS (ADR-SEC-003, ADR-PAY-008)**, which matches S08.

- Ticket claim: `logs.retention EQ 60 days [MUST]`, service `payment-service`, no conditions.
- ADR-SEC-003 (source version 1, cached): `logs.retention LTE 30 days [MUST]`, service `*`, condition `logs containing customer data`.
- ADR-PAY-008 (version 1): `logs.retention EQ 90 days [MUST]`, service `payment-service`.

ADR-SEC-003 was still at version 1, so the cached decision constraint used in this run is
the same one that existed during the 12:42 CONFLICT run. That rules out a bad decision
cache as the cause. Ticket claims are not cached, so the most likely cause of the
earlier CONFLICT is a different ticket extraction (for example an attribute key other
than `logs.retention`, or a condition that made ADR-SEC-003 look inapplicable). Not
proven: the 12:42 claims were not logged.

Suggested next step (Đạt): re-run PAY-8 five times from the panel and compare the
`diag PAY-8` claim lines. If any run disagrees, stabilise the retention attribute key in the
extraction naming hints.

Also seen in the same log: ADR-PAY-001 (re-extracted at version 4 after drift tests)
produced extra constraints `retry.count QUALITATIVE` and
`webhook.retry.backoff_strategy QUALITATIVE` for the payment-service backoff sentence.
The webhook key is wrong for a payment-service decision and is worth a naming hint.

### Answers for Đạt (Đăng, 14 Nov)

**Which build is running where.** The shared site (`one-atlas-dscw`, environment
`development`) runs `main` and contains 2ed6589 (the `diag` log). It was redeployed on
13 Nov at 15:40 UTC (3.6.0) and on 14 Nov at 00:13 SGT (4.1.0, a major version because the
"Load demo data" scopes were added; the shared site's installs are already upgraded).
In the last 30 hours the `development` logs show **one** PAY-8 run (13 Nov 10:06 UTC,
NEEDS_REVIEW) and no CONFLICT run. So the 19:15 CONFLICT run was on another environment,
most likely `dev-dat` on `one-atlas-wnve`, which was last deployed on 9 Nov and has no
`diag` logging. For the five runs, either use the shared site, or first run
`git pull && forge deploy -e dev-dat && forge install --upgrade -e dev-dat` (approve the new
scopes) and read `forge logs -e dev-dat`.

**1. Pulling the logs, report and cache for one panel run.** From 4.1.0 every `diag` line
starts with the run's identity:
`{"via":"panel"|"agent","jobId":...,"reportId":...,"generatedAt":...,"graph":{"pages":N,"error":...},...}`.
`via: "panel"` is the Jira panel; `"agent"` is Rovo or MCP. Use them like this:
- Logs: `forge logs -e development --since 30m | grep "diag PAY-8"`. The `jobId` ties
  the lines; all lines of one run share the invocation id printed after the timestamp.
- Report: the `diag` line already holds the claims, each decision's version and extracted
  constraints, findings and errors. To see the raw `report:PAY-8`, open the developer
  console, then Storage, then Key value store, and pick the **Jira** installation of the
  shared site. Panel runs write to the Jira installation's storage. Rovo/MCP runs appear to
  use the Confluence installation's storage (inferred: the Confluence page trigger finds
  their index but never the panel's), so an empty search in the wrong installation is
  expected. Match `reportId`/`generatedAt` with the `diag` line.
- Cache: `dcache:<pageId>:<version>` lives in the same installation as the run. The `diag`
  line's `decisions[].v` and `constraints` are exactly what the run read from it.

**2. Criteria for the five PAY-8 runs.** Gold S08 is `overall NEEDS_REVIEW`, claim C1
`NEEDS_REVIEW / COMPETING_DECISIONS`, in all five runs. Record per run: `outcome`, the C1
claim line (attribute key, operator, value, unit, scope, conditions) and whether
ADR-SEC-003 is in `findings`. Teamwork Graph does not touch extraction: it only adds
linked pages to retrieval, and the labelled ADRs are found by search either way. If the
graph errors, the `diag` line shows `graph.error` (and a separate
`[tether] graph PAY-8: Teamwork Graph failed` warning); note it and keep comparing the
extraction.

**3. "Create clarification issue" end to end.** Tested on 13 Nov on the shared site from
PAY-1: preview, edit, confirm, then created **PAY-31** "Clarify Payment Service retry
limit in PAY-1 against ADR-PAY-001" (created 01:45 EST) as the user. Checked on 14 Nov
through the Jira API: PAY-31 has an issue link "Relates" to PAY-1 and a remote link to the
ADR-PAY-001 Confluence page. Not covered yet: a follow-up from a NEEDS_REVIEW finding
(only CONFLICT was tried), and creation from the Rovo agent's `create-follow-up-issue`
action.

**Also:** the in-Forge eval on the shared site (Tether settings, Run eval) shows
**30/30 passed**, 0 missed conflicts, 0 false conflicts, 0 false "no conflict"
(13 Nov, 2:44 PM site time).
