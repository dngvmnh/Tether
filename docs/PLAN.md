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
| Teamwork Graph | Consumes TWG (`requestTeamworkGraph`, Cypher) for issue→page links and owner→team; reports "graph unavailable" honestly | `src/adapters/teamworkGraph.ts` |
| Marketplace | Separate registered app submitted for listing (installation links are disabled for listed apps, so judges get the other app) | `docs/SUBMISSION.md` |

Rules check needed: the Devpost rules page blocks automated reading. **Someone must read
the official rules** and confirm (a) whether one project can win a placing prize *and*
bonus prizes, and (b) any requirement on repo visibility. Paste the answers into
`docs/SUBMISSION.md`.

## 3. Workstreams (no one waits on anyone)

The contract (`src/contracts/`) and golden data (`eval/`) are already in the repo, so each
stream can start today against fakes, fixtures or mocks.

### Đạt: engine and evaluation (`src/engine/`, `eval/`)
- Extraction prompts v1 (`src/engine/llm/extract.ts`): canonical attributes, counting semantics, verbatim quotes.
- Semantic comparator for qualitative claims (`src/engine/llm/semantic.ts`).
- Grow the golden set to ~30 (adversarial: units, "should" vs "must", environment lists, negations, multi-claim tickets).
- In-Forge eval on `dev-dat`; report per-scenario and error-category results (missed conflicts, false conflicts, false "no conflict").
- Fast loop needs no Forge: `npm run test:watch`.

### Đăng: Forge integration (`src/adapters/`, `src/handlers/`, `manifest.yml`)
- Register app, contributors, shared demo site, seed data.
- Real Jira/Confluence adapters end to end on the site (acceptance-criteria field, page permissions).
- Teamwork Graph: enable scopes, verify the Cypher in GraphiQL (`/gateway/api/graphql/twg`), owner teams.
- Rovo agent/skill/MCP working in Rovo Chat and from an external MCP client (Claude Code / Claude Desktop).
- Drift triggers end to end; production deploy; distribution link; Marketplace app.

### Bảo: product experience (`static/report/`)
- Issue panel states: idle, running (stages), report, stale, failed, partial errors.
- Finding cards: side-by-side quotes, scope chips, decision history, actions.
- Follow-up issue preview/confirm flow; admin settings page.
- Light/dark themes (tokens only), accessibility, empty states, copy.
- Stretch: Confluence decision badge ("referenced by 4 tickets, 1 conflict").
- Fast loop needs no Forge: `npm run ui:dev` with the scenario picker.

## 4. Timeline

| Week | Dates | Milestone (demoable on the shared site) | Đạt | Đăng | Bảo |
|---|---|---|---|---|---|
| 0 | Sun 8 Nov | Repo scaffold (done), app registered, everyone deployed to own env | Run tests, read engine | Register, contributors, seed shared site | Run mock UI, pick component approach |
| 1 | 9-15 Nov | **S01 shows CONFLICT on a real issue** (panel → worker → Forge LLM → report) | Extraction v1 + in-Forge eval baseline | Adapters live, permission filter, TWG scopes verified | Panel polish, all states from fixtures |
| 2 | 16-22 Nov (Build Session Tue 17 Nov 12:00 ET = Wed 01:00 SGT, watch the recording) | **All 15 scenarios correct end to end; Tether agent answers in Rovo Chat** | Extraction ≥ 13/15, semantic comparator | Rovo agent/skill/MCP live, follow-up creation | Follow-up modal, settings page, stale banner |
| 3 | 23-29 Nov | **Drift demo: edit ADR → ticket flagged**; MCP from Claude Code | Golden set → 30, error analysis | Triggers end to end, TWG owner/team, Marketplace partner account | Decision history polish, dark mode, a11y |
| 4 | 30 Nov-6 Dec (exam crunch, COR3301 final 1 Dec) | Feature freeze for new modules. **Marketplace app submitted** (target 6 Dec) | Bug bash | Production deploy, distribution link, security review | Confluence badge (stretch) |
| 5 | 7-13 Dec | Final eval numbers; demo script; recording dry run | Eval write-up | Install-link test on a clean site | Video assets, screenshots |
| 6 | 14-19 Dec | **Code freeze Wed 16 Dec; Devpost submitted Sat 19 Dec** | Devpost text (engine) | Devpost text (tech) | Video edit (< 5 min) |
| buffer | 20-22 Dec | Fixes only | | | |

## 5. Definition of done (MVP, end of week 2)

- Opening any seeded issue and clicking **Check implementation context** shows the expected outcome for all 15 scenarios.
- Failures (permission, LLM, retrieval) never show as "No conflict found".
- Coverage line is always present; a conflict is shown even with partial coverage.
- Follow-up issue is created only after preview + confirm, linked to the issue and decision pages.
- The Tether agent answers "Does PAY-101 conflict with any decision?" with quotes and links.

## 6. Risks

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
