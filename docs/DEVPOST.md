# Devpost submission text (draft, 14 Nov 2026)

Category: **Apps for Software Teams**.
Bonus prizes claimed: **Best Agents**, **Best app with MCP**, **Best Teamwork Graph
integration**, **Best Marketplace published app** (pending listing, see the end).

Links to fill in on Devpost: install link (`docs/SUBMISSION.md`), public repo
https://github.com/dngvmnh/Tether, YouTube video (not recorded yet).

---

## Tagline

Keeps tickets tethered to the engineering decisions your team already made.

## Inspiration

Teams write architecture decision records (ADRs) in Confluence and tickets in Jira, and
the two drift apart. A ticket asks for "retry exactly 5 times" while the accepted decision
says "no more than 3 times". Nobody connects the two until code review, or production. We
wanted a check that sits on the ticket, finds the decisions that apply, and shows the exact
evidence, without pretending to be more certain than it is.

## What it does

Open a Jira issue, open the **Tether decision check** panel and click **Check
implementation context**. Tether:

- extracts the ticket's technical requirements;
- finds the decision pages that apply: labelled pages in the configured Confluence spaces,
  plus pages linked to the issue through **Teamwork Graph**;
- checks each decision's status, supersession history and scope (service, environment);
- compares each requirement with each applicable decision and returns one of four
  outcomes: **Conflict**, **Needs review**, **No conflict found** or **Insufficient
  evidence**, with a coverage line such as "1 of 2 requirements checked";
- shows the ticket sentence next to the decision sentence, both checked word for word
  against their sources, with a link to the page.

From a finding you can **Create clarification issue**: Tether drafts it, you edit and
confirm, and it is created as you, linked to the ticket and the decision page. Tether never
edits the ticket or the decision.

When a decision page changes, a ticket checked against it shows **"A decision used in this
check has changed"** with a Re-check button.

The same engine is available in **Rovo** (the Tether agent, with three actions and the
`decision-consistency` skill) and to **MCP clients** such as Claude Code
(`check-issue-consistency`, `find-decisions`).

What makes it different from asking a chatbot to review a ticket:

- **Deterministic where it matters.** "Up to 5" against "at most 3" is compatible if the
  implementation stays within 3 retries; "at most 4 attempts including the first" equals
  "at most 3 retries"; "15000 ms" against "at most 10 s" is a conflict. Interval maths,
  units, attempts-versus-retries and supersession are code, not prompts. The language model
  extracts requirements and constraints, with a semantic fallback when the deterministic
  rules cannot decide.
- **Honest uncertainty.** Needs review instead of guessing; Insufficient evidence instead
  of a silent pass. A failed retrieval or model call is never shown as "no conflict".
- **Verified evidence.** A quote that cannot be found in its source downgrades the finding
  to Needs review.

## How we built it

Everything runs on **Forge**, with no external services (no `permissions.external`). The
production build is eligible for Runs on Atlassian.

| Product | How Tether uses it |
|---|---|
| **Forge** | Custom UI issue panel and admin page (React + Vite), resolvers (25 s) that only enqueue work, a queue consumer (900 s) that runs the analysis, Forge KVS for jobs, reports, the per-page-version constraint cache and settings, triggers for Jira issue updates and Confluence page updates, and **Forge LLMs** (Claude models, ordered fallback list) for extraction. |
| **Jira** | Issue panel and admin page; reads the issue as the user (permission check); creates the clarification issue as the user, with an issue link and a remote link to the decision page; the in-app "Load demo data" creates the demo project and issues. |
| **Confluence** | Decision records are ordinary pages with a label (`tether-decision`) and a Page Properties table (status, service, environments, supersedes). Pages are found with CQL; pages the requesting user cannot read are dropped. Drift: a report compares each decision page's version with the current one when it is read. |
| **Rovo** | Three `action`s (GET check, GET find, CREATE follow-up), a `rovo:agent` named Tether with conversation starters, and a `rovo:skill` (`skills/decision-consistency/SKILL.md`) that tells agents how to report outcomes without upgrading them. |
| **MCP** | `rovo:mcp` exposes `check-issue-consistency` and `find-decisions` to external MCP clients at `https://mcp.atlassian.com/forge/07520459-db83-4ab5-b000-09c3c8095691`. A stored report is returned at once; a stale one comes back with a note and starts a background re-check, because MCP clients give up quickly. |
| **Teamwork Graph** | A persisted Cypher query (`customQuery`) follows the issue's remote links to the Confluence pages they point to, so a decision linked to the ticket is found even without the label. Failures are reported in the panel and Tether falls back to Jira remote links. |

```
MATCH (item:JiraWorkItem {ari: $workItemId})
      -[:jira_work_item_links_jira_work_item_remote_link]->(link:JiraWorkItemRemoteLink)
RETURN link
```

The engine (`src/engine/`) is pure TypeScript with no Forge imports, enforced by a test,
so it is unit-tested offline against the same golden scenarios that feed the UI fixtures,
the demo data and the in-Forge evaluation.

## Evaluation

30 team-written scenarios (`eval/scenarios.json`) cover conflicts, compatible bounds,
unit conversion, attempts versus retries, superseded and proposed decisions, competing
decisions, scope mismatches and non-technical tickets. In Tether settings → Run eval, the
analysis pipeline using real Forge LLM extraction on fixture tickets and decision statements
passed **30 of 30** (0 missed conflicts, 0 false
conflicts, 0 false "no conflict"), on the shared development site and on a clean judge
site. The scenarios were written and used by the team during development. These numbers
show the prototype handles its intended cases; they are not a claim of real-world
precision or recall.

## Challenges we ran into

- **Two installations, two stores.** Without multi-product compatibility, the Jira and
  Confluence parts of a Forge app are separate installations with separate storage, so a
  Confluence page trigger could not see the index written by the Jira panel. We switched to
  pull-based drift: when a report is read, Tether compares the stored decision versions
  with the current ones in one CQL search.
- **Confluence v1 through Forge.** Several v1 content endpoints answer 410 Gone; we moved
  page reads to CQL and page creation to the v2 API.
- **Long analyses, short limits.** Resolvers have 25 s and Rovo actions 55 s, so the work
  runs in a queue consumer and the UI polls.
- **Scopes.** Creating a Jira project needs `manage:jira-configuration`, not
  `manage:jira-project`; the wrong scope showed up as an endless consent prompt on a clean
  site.
- **Extraction drift.** The same retention limit came back under different attribute
  names in different runs; we canonicalise equivalent keys before comparing.

## Accomplishments that we're proud of

- A judge can install the app, click **Load demo data**, and see a real Conflict with
  evidence on PAY-1 within a few minutes, with no API token or terminal.
- One engine, four surfaces: issue panel, Rovo agent, Rovo skill and MCP.
- Outcomes that say when they don't know.

## What we learned

Forge's platform pieces (queues, KVS, LLMs, Rovo actions, MCP) fit together well when the
core logic is a pure function; most of our debugging time went into product boundaries
(installations, scopes, API versions), so testing on a clean site early mattered.

## What's next for Tether

- Multi-product compatibility, so the panel and Rovo/MCP share one store and settings.
- Owner and team context from Teamwork Graph ("who decided this").
- A decision badge in Confluence listing the tickets that rely on a page.
- A Marketplace listing (submitted separately, see below).

## Built with

forge, jira, confluence, rovo, mcp, teamwork-graph, forge-llm, typescript, react, vite,
zod, vitest

---

## Bonus-prize evidence

| Prize | Evidence |
|---|---|
| Best Agents | Video S08 (Tether agent in Rovo on the judge site: PAY-2 → Insufficient evidence, 1 of 2, matching the panel). `manifest.yml` `rovo:agent` with 3 actions and the `decision-consistency` skill; `src/handlers/rovo.ts`; `prompts/tether-agent.md`. |
| Best app with MCP | Video S09 (Claude Code calling `check-issue-consistency`, recorded on our development site). `manifest.yml` `rovo:mcp`; endpoint `https://mcp.atlassian.com/forge/07520459-db83-4ab5-b000-09c3c8095691`; open skill file `skills/decision-consistency/SKILL.md`. Site admins enable it at admin.atlassian.com → (site) → Connected apps → Tether → Details → Tools → "Expose tools to MCP-compatible apps". |
| Best Teamwork Graph integration | Video S04/S10 (panel footer "1 page(s) linked to PAY-1 in Teamwork Graph"); Cypher above; `src/adapters/teamworkGraph.ts`; verified on the judge site and the dev site. |
| Best Marketplace published app | Listing or review ticket link: **to add** after submission of "Tether for Marketplace" (a separate registered app, because listed apps cannot be shared by installation link). |

## Notes for the description field

- All data in the video and the demo is fictional demo data created by Load demo data.
- Narration uses a synthetic (AI-generated) voice.
