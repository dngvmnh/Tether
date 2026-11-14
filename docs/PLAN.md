# Tether: plan

Deadline: **Wed 23 Dec 2026 04:00 SGT** (Devpost). Internal submit target: **Sat 19 Dec**.
Category: **Apps for Software Teams**. Bonus prizes targeted: **Best Agents**, **Best app
with MCP**, **Best Teamwork Graph integration**, **Best Marketplace published app**.

## 1. What changed from the original idea, and why

The core idea stays: evidence-backed, scope-aware, version-aware checking of Jira
requirements against engineering decisions. These changes make it stronger and eligible
for every bonus prize.

| Original | Changed to | Why |
|---|---|---|
| Rovo agent and MCP **excluded** from MVP | One engine, exposed as 3 Rovo `action`s, reused by a `rovo:agent`, a `rovo:skill` and `rovo:mcp` | Costs ~2 days once the engine is a pure function; worth two bonus prizes and Technical Implementation points. Already in `manifest.yml`. |
| Retrieval by label only | Label search **plus** pages linked to the issue via **Teamwork Graph** (fallback: Jira remote links) | TWG bonus; real teams link ADRs to tickets; "context" is the Codegeist theme. |
| One-shot check when a developer clicks | **Drift detection**: when a decision page changes, every issue checked against it is flagged "decision changed, re-check" | "Keeps tickets tethered" over time, not just once. Strongest demo moment and the clearest differentiator from AI ticket reviewers. |
| LLM decides conflicts | **Deterministic core** (interval maths, units, attempts-vs-retries, supersession, scope) with the LLM only for extraction and qualitative cases | Reproducible, testable, explainable. Already implemented: 15/15 golden scenarios pass. |
| Quotes from the LLM shown as evidence | Every quote is **verified verbatim** against the source; unverified evidence is downgraded to Needs Review | Kills hallucinated citations, the #1 risk of judges' trust. |
| 10-15 test cases | 15 golden scenarios now (shared by unit tests, UI fixtures, seed data and the in-Forge eval), growing to ~30 with adversarial cases | One dataset, four uses. Credible numbers for the video. |
| Label `contextguard-decision` | `tether-decision`, configurable | Leftover name. |
| Rigid custom template | Confluence **Page Properties** table (native, already used for ADRs) | Lower adoption cost; parser tested against seeded pages. |

Things deliberately still **out of scope**: Bitbucket code analysis, rewriting tickets or
decisions, risk scoring, autonomous agents.

Things I would **not** add: Forge Realtime (it is EAP, and EAP features block a production
/ Marketplace release; polling is fine), `rovo:agentConnector` (that is for agents hosted
outside Atlassian).

## 2. Bonus-prize map

| Prize | What qualifies us | Where |
|---|---|---|
| Best Agents | `rovo:agent` Tether + `rovo:skill` decision-consistency + reusable `action`s (GET check, GET find, CREATE follow-up) | `manifest.yml`, `src/handlers/rovo.ts`, `skills/` |
| Best app with MCP | `rovo:mcp` exposes check + find to Claude/Cursor/etc.; `skills/decision-consistency/SKILL.md` is an open skill file for third-party agents | `manifest.yml`, `skills/` |
| Teamwork Graph | Consumes TWG (`requestTeamworkGraph`, persisted Cypher via `customQuery`) for issue→page links and owner→team; reports "graph unavailable" honestly | `src/adapters/teamworkGraph.ts` |
| Marketplace | Separate registered app submitted for listing (installation links are disabled for listed apps, so judges get the other app) | `docs/SUBMISSION.md` |

Rules check needed: the Devpost rules page blocks automated reading. **Someone must read
the official rules** and confirm (a) whether one project can win a placing prize *and*
bonus prizes, and (b) any requirement on repo visibility. Paste the answers into
`docs/SUBMISSION.md`.

## 3. Status

### Sat 14 Nov

Builds: **production 4.0.0** (judging app, clean site `tether-judge-test`), **development
6.0.0** (shared site `one-atlas-dscw`). Both are majors with new scopes: teammates run
`forge install --upgrade` (Jira and Confluence) on their own dev sites.

| Done since 10 Nov | Evidence |
|---|---|
| Install link created and tested on a clean site (Jira + Confluence) | `docs/SUBMISSION.md` |
| In-app **Load demo data** (no token, no terminal): 9/9 on the clean site, PAY-1 Conflict | `src/handlers/seed.ts`, SUBMISSION |
| Pull-based drift (separate Jira/Confluence stores) verified on the clean site | `src/handlers/drift.ts` |
| Rovo agent on the clean site matches S02; MCP from Claude Code on the dev site; Teamwork Graph on both sites (query key now the default) | SUBMISSION |
| Follow-up issue end to end (PAY-31, links checked) | `docs/EVAL.md` |
| In-Forge eval 30/30 on the shared and clean sites | `docs/EVAL.md` |
| Đạt's PAY-8 fix (canonical retention key) merged and deployed to development | `docs/EVAL.md` |
| Judge instructions final, Devpost text drafted, README architecture, video plan | `docs/SUBMISSION.md`, `docs/DEVPOST.md`, `README.md`, `docs/VIDEO.md` |
| Debug-only logs removed (kept: `diag`, Teamwork Graph, demo-data steps, failures) | `src/handlers/` |

Open:
- Đạt: 5 PAY-8 re-runs on the shared site (development 6.0.0).
- Video: approve `docs/VIDEO.md`, record, voice, edit, upload (public YouTube).
- Marketplace: partner profile (Đăng), deploy "Tether for Marketplace", submit listing.
- Paste `docs/DEVPOST.md` into Devpost, add video and Marketplace links, submit by Sat 19 Dec.

### Tue 10 Nov

Week 1 milestone is already met: on the shared site, PAY-1 (S01) shows **CONFLICT vs
ADR-PAY-001** end to end (panel → queue worker → Forge LLM → report), with verified quotes,
scope chips and decision history.

| Done | Where |
|---|---|
| App registered, deployed to `development` (2.4.0, Runs on Atlassian eligible), installed on `one-atlas-dscw` (Jira + Confluence) | `manifest.yml` |
| Shared site seeded: project `PAY` (PAY-1..15 = S01..S15), space `ENG` (9 ADRs labelled `tether-decision`) | `npm run seed` |
| Tether Rovo agent answers PAY-1 in Rovo Chat (check action) | `src/handlers/rovo.ts` |
| Đạt's engine merged (`2adfdc3`): 30 scenarios, 129 tests, 30/30 offline, 30/30 live on dev-dat; deployed to `development` 3.1.0; shared site seeded PAY-1..30 | `eval/`, `src/engine/` |
| Bảo's UI + Teamwork Graph persisted query; graph scopes approved; **verified 13 Nov on shared site: PAY-1 footer "1 page(s) linked to PAY-1 in Teamwork Graph"** | `static/report/`, `src/adapters/teamworkGraph.ts` |
| In-Forge eval runs from Tether settings → Run eval (no web trigger, keeps Runs on Atlassian) | `src/handlers/evalSuite.ts` |
| Teamwork Graph moved to persisted queries (`customQuery`); falls back to Jira remote links until a query key is set | `src/adapters/teamworkGraph.ts` |

Known gaps found in the live run:
- PAY-1's second requirement ("each retry is logged") comes back Insufficient Evidence; extraction marks it material. Engine task (Đạt).
- First check on a site takes ~40 s (extracts all 9 decisions); later checks hit the per-version cache.

## 4. Workstreams: everyone is self-unblocking

Each task below lists what you need. **Nothing needs another teammate.** You need only:
your own Atlassian account, your own dev site + `dev-<you>` env, and **Developer** role on the
app. The only one-time dependency: Đăng adds Đạt and Bảo as contributors with the
**Deployer** role (developer console → Tether → Contributors) and as site admins on the
shared site. After that nobody waits for anyone.

Rules that remove waiting:
- **Reviews are not blocking.** Ask for a review; if nobody reviews within 24 h and CI is green, merge it yourself. Contract changes (`src/contracts/`) get a 24 h heads-up in chat instead of three approvals; additive optional fields can merge immediately.
- **Anyone may deploy `main` to `development`** (the shared site) after merging: `npm run deploy:dev`. Never deploy a branch there. Your own `dev-<you>` takes anything.
- **Test on your own site first.** The shared site is for integration and recording only.
- **Manifest changes** (scopes/modules): merge, deploy, post one line in chat. Others run `forge deploy -e dev-<you>` + `forge install --upgrade` when they next pull.

### Đạt: engine and evaluation (`src/engine/`, `eval/`)
1. Fix extraction materiality: PAY-1 "each retry is logged" should be non-material or covered (`src/engine/llm/extract.ts`). Verify on your site: open PAY-1 → Re-run check.
2. Baseline in-Forge eval: your site → Jira settings → Apps → Tether settings → **Run eval**. Paste the numbers in `docs/EVAL.md`.
3. Semantic comparator for qualitative claims (`src/engine/llm/semantic.ts`).
4. Golden set 15 → 30 (units, "should" vs "must", environment lists, negations, multi-claim). Then `npm run fixtures` and `npm run seed` on your site.
- Needs nothing from others: `npm run test:watch`, `npm run eval:offline`, your own `dev-dat`.

### Đăng: Forge integration (`src/adapters/`, `src/handlers/`, `manifest.yml`)
1. ~~Rovo: Tether agent answers "Does PAY-1 conflict with any decision?" in Rovo Chat~~ **Done 8 Nov**: CONFLICT vs ADR-PAY-001 with both quotes and the decision link (Rovo → View all agents → Tether). Remaining: try "find decisions about retries" (find action).
2. MCP: **admin toggle done 10 Nov**; client entry added (`claude mcp add --transport http tether https://mcp.atlassian.com/forge/07520459-db83-4ab5-b000-09c3c8095691`). Remaining: `/mcp` OAuth in Claude Code, then call check + find and record it.
3. Follow-up issue: preview → confirm → created as the user, linked to the issue and decision page.
4. Drift: edit ADR-PAY-001 → PAY-1 shows the stale banner (trigger end to end).
5. Read the Devpost official rules (multi-prize, repo visibility) and paste answers into `docs/SUBMISSION.md`.
6. Production: **deployed 10 Nov** (2.0.0, Runs on Atlassian eligible). Remaining: installation link (dev console → Distribution), clean-site install test, Marketplace partner profile + listing (drafts in `docs/marketplace/`). **Second app registered 13 Nov**: Tether for Marketplace `9cca0b82-9b9f-42f8-9049-5db82c3a263e` (developer space Tether), production deployed; ids in `scripts/apps.json`.

### Bảo: product experience (`static/report/`) **and Teamwork Graph**
1. **Teamwork Graph query** (moved here from Đăng; self-contained, see `docs/TEAM-SETUP.md` → Teamwork Graph):
   1. On a branch, uncomment `read:graph:issue:jira` and `read:graph:page:confluence` in `manifest.yml`, `forge deploy -e dev-bao`, `forge install -e dev-bao --upgrade`.
   2. In TWG Labs (signed in with your own account, which is an app contributor), run `LINKED_PAGES_CYPHER` against one of your seeded issues that has a web link to an ADR (e.g. PAY-1). If it returns nothing, flip the arrow direction and try again.
   3. Save it as a query for the app id, copy the `queryKey`, paste it in **your** Tether settings, Re-run check on PAY-1. Done when the footer says "N page(s) linked to PAY-1 in Teamwork Graph".
   4. Put the working Cypher back into `src/adapters/teamworkGraph.ts` and the key into `docs/TEAM-SETUP.md`, merge, `npm run deploy:dev`, paste the same key into the shared site's Tether settings.
2. Panel states: idle, running (stages), report, stale, failed, partial errors.
3. Finding cards, follow-up modal, settings page (now has the query-key field), light/dark, a11y, copy.
4. Stretch: Confluence decision badge.
- Needs nothing from others: `npm run ui:dev` (mock backend, scenario picker), your own `dev-bao` on `one-atlas-zthc`.

## 5. Timeline

| Week | Dates | Milestone (demoable on the shared site) | Đạt | Đăng | Bảo |
|---|---|---|---|---|---|
| 0 | Sun 8 Nov | Scaffold, registration, deploy, seed, S01 live CONFLICT (all done); everyone deployed to own env | Run tests, read engine | Register, contributors, seed shared site | Run mock UI, pick component approach |
| 1 | 9-15 Nov | **S01 fully covered (2 of 2), Teamwork Graph links pages, follow-up issue created from PAY-1** | Extraction v1 + in-Forge eval baseline | Rovo agent in Rovo Chat, follow-up creation, rules check | TWG query registered + scopes, panel polish |
| 2 | 16-22 Nov (Build Session Tue 17 Nov 12:00 ET = Wed 01:00 SGT, watch the recording) | **All 15 scenarios correct end to end; Tether agent answers in Rovo Chat** | Extraction ≥ 13/15, semantic comparator | Rovo agent/skill/MCP live, follow-up creation | Follow-up modal, settings page, stale banner |
| 3 | 23-29 Nov | **Drift demo: edit ADR → ticket flagged**; MCP from Claude Code | Golden set → 30, error analysis | Triggers end to end, TWG owner/team, Marketplace partner account | Decision history polish, dark mode, a11y |
| 4 | 30 Nov-6 Dec (exam crunch, COR3301 final 1 Dec) | Feature freeze for new modules. **Marketplace app submitted** (target 6 Dec) | Bug bash | Production deploy, distribution link, security review | Confluence badge (stretch) |
| 5 | 7-13 Dec | Final eval numbers; demo script; recording dry run | Eval write-up | Install-link test on a clean site | Video assets, screenshots |
| 6 | 14-19 Dec | **Code freeze Wed 16 Dec; Devpost submitted Sat 19 Dec** | Devpost text (engine) | Devpost text (tech) | Video edit (< 5 min) |
| buffer | 20-22 Dec | Fixes only | | | |

## 6. Definition of done (MVP, end of week 2)

- Opening any seeded issue and clicking **Check implementation context** shows the expected outcome for all 15 scenarios.
- Failures (permission, LLM, retrieval) never show as "No conflict found".
- Coverage line is always present; a conflict is shown even with partial coverage.
- Follow-up issue is created only after preview + confirm, linked to the issue and decision pages.
- The Tether agent answers "Does PAY-101 conflict with any decision?" with quotes and links.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Teamwork Graph Preview needs allowlisting / scopes break deploy | Scopes start commented out; integration owner verifies on own env first; fallback to Jira remote links is already coded; if TWG is unavailable by 29 Nov, drop that bonus, not the product |
| Forge LLM model availability (some models return "not allowed") | Ordered model list in settings with automatic fallthrough |
| 25 s resolver / 55 s action limits | Analysis runs in a queue consumer (900 s); actions return a cached report or wait ≤ 40 s |
| LLM extraction errors | Deterministic core, verbatim-quote check, Needs Review instead of guessing, eval numbers tracked weekly |
| Data leak via app-scoped reads of restricted pages | Worker filters pages with the Confluence permission-check API for the requesting user |
| Marketplace review slower than deadline | Submit by 6 Dec; "submitted for listing" with the review ticket link is enough |
| Exams late Nov / early Dec | Week 4 is light by design; scope freezes before it |
| Demo site expires (2027-02-05) | Fine for judging; don't rely on it after |
