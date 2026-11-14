# Demo video plan (Codegeist 2026, Tether)

Status: **plan for approval** (14 Nov 2026). Nothing has been recorded, designed or voiced yet.
Owner: Đăng records; narration and edit after approval. Built with the video-generation
brief: real recordings carry the story, the narration says only what the screen proves.

## 0. Constraints

| Constraint | Value | Source |
|---|---|---|
| Length | **under 5:00**; target **4:45** (15 s margin) | `docs/SUBMISSION.md` checklist ("Demo video < 5 min"), outline "≤ 4:45" |
| Host | public YouTube link | `docs/SUBMISSION.md` (Đăng read the rules, 13 Nov) |
| Category | Apps for Software Teams | `docs/PLAN.md` |
| Bonus prizes shown | Best Agents, Best app with MCP, Best Teamwork Graph integration (Marketplace has no video beat) | `docs/PLAN.md` §2 |
| Narration, music, AI voice, captions | **Not confirmed**: the rules page (codegeist.devpost.com/rules) is behind a bot check. See open questions. | none |
| Judging criteria | **Not confirmed** (same reason). Assumed: idea quality, implementation, impact, use of Atlassian platform. | assumption |
| Language | English (all project docs are English) | assumption |

## 1. Dossier (short)

- **Tether**: a Forge app that checks whether a Jira ticket's technical requirements
  contradict engineering decisions (ADRs) recorded in Confluence, and shows the evidence
  (README).
- **Problem example (from the demo data)**: PAY-1 asks the payment service to "retry
  failed transactions exactly 5 times before giving up"; ADR-PAY-001 says "no more than
  3 times" (`eval/scenarios.json` S01, `eval/decisions.json`).
- **Flow**: issue panel, Check implementation context, queue worker, report with
  verbatim quotes, coverage, decision history, scope chips; Create clarification issue
  after preview and confirm (as the user); drift banner when a decision page changes.
- **Same engine on three more surfaces**: Rovo agent "Tether" plus skill
  `decision-consistency`; MCP tools `check-issue-consistency` and `find-decisions`;
  Teamwork Graph for issue-to-page links.
- **Differentiators** (README): deterministic comparison (intervals, units, attempts vs
  retries, supersession), four honest outcomes with coverage, failures never shown as a
  pass, verbatim quote check, drift detection.
- **Stack** (manifest + code): Forge (Custom UI React/Vite, resolvers, queue consumer
  900 s, triggers, KVS), Forge LLMs (Claude models, no `permissions.external`), Rovo
  `action`/`rovo:agent`/`rovo:skill`/`rovo:mcp`, Teamwork Graph persisted Cypher query.
- **Environments**: clean judge site `tether-judge-test` runs **production 4.0.0**
  (judging app). Dev site `one-atlas-dscw` runs development 6.0.0. All data is fictional
  demo data from `eval/`.
- **Visual identity**: the app uses Atlassian design tokens. Danger `#ae2e24` /
  `#e2483d` / bg `#ffeceb`, success `#216e4e`, warning `#a54800`, link/focus `#0c66e4` /
  `#388bff`, text `#172b4d`, subtle text `#44546f`, neutral bg `#f7f8f9`. Radius 3 px
  (lozenges, buttons), 6 px (cards, banners), banners with a 4 px left border. Font:
  Atlassian body font, fallback Segoe UI/Roboto. Canva match: **Inter** (flag: not the
  exact font).

## 2. Real-versus-not-real audit

| Asset | Class | Use |
|---|---|---|
| Jira/Confluence/panel on tether-judge-test (prod 4.0.0) | live and real | main evidence |
| PAY-1..30, ENG pages | real product, **fictional seeded data** (Load demo data) | caption "Demo data" |
| Rovo agent chat on the clean site | live and real | Best Agents beat |
| Claude Code calling MCP tools | live and real, **dev site** (clean site not reachable from Claude Code) | caption "Recorded on our development site" |
| Eval "30/30 passed" in Tether settings | real run, **fixture data**, team-written set used during development | caption with limits (see ledger C14) |
| `npm run ui:dev` mock UI, `static/report/src/mocks/reports.json`, `api/mock.ts`, DevToolbar | **mock** | never in the video |
| Older screenshots by Đạt (13 Nov) | real, older build | not used; record fresh |

## 3. Claims ledger

| Id | Claim (wording to use) | Evidence | Status |
|---|---|---|---|
| C1 | Tether checks Jira tickets against engineering decisions in Confluence and shows the evidence | README; panel recording | verified |
| C2 | PAY-1: exactly 5 retries contradicts ADR-PAY-001's no more than 3 → Conflict, 1 of 2 requirements checked | SUBMISSION 14 Nov run | verified |
| C3 | Quotes are checked word for word against the source | README; `src/engine` quote verification | documented |
| C4 | "4 attempts including the first" equals "3 retries" → No conflict found (PAY-13) | EVAL table PAY-13 | verified (shared site) |
| C5 | "Exactly 4 attempts" with unclear counting → Needs review (PAY-3) | EVAL PAY-3 | verified (shared site) |
| C6 | A looser upper bound is not a conflict; uncovered requirement → Insufficient evidence (PAY-2) | SUBMISSION Rovo S02; EVAL PAY-2 | verified |
| C7 | A failed check is never shown as "no conflict" | ARCHITECTURE rule 1; skill | documented |
| C8 | When a decision page changes, a checked ticket shows "A decision used in this check has changed" | SUBMISSION drift (clean site) | verified |
| C9 | Clarification issue is created only after preview and confirm, as the user, linked to the issue and the decision page | EVAL "Answers for Đạt" 3 (PAY-31) | verified (dev site) |
| C10 | The Tether Rovo agent answers with the same engine (PAY-2 → Insufficient evidence, 1 of 2) | SUBMISSION clean-site Rovo | verified |
| C11 | MCP clients such as Claude Code call `check-issue-consistency` | SUBMISSION MCP dev site | verified (dev site only) |
| C12 | Teamwork Graph finds the decision page linked to the issue ("1 page(s) linked to PAY-1 in Teamwork Graph") | SUBMISSION TWG clean site; log | verified |
| C13 | LLM calls run on Forge LLMs; no external services | manifest (no `permissions.external`); deploy says Runs on Atlassian eligible | verified |
| C14 | Eval: **30 of 30 team-written scenarios passed** (0 missed conflicts, 0 false conflicts, 0 false "no conflict"). "These numbers show the prototype handles its intended cases; they are not a claim of real-world precision or recall." | EVAL table + clean-site settings screen | verified; **in-sample** (set written and used by the team during development) |
| C15 | Judges can load the demo data from Tether settings in about a minute | SUBMISSION 14 Nov | verified |
| C16 | Supersession: ADR-PAY-000 shown as superseded by ADR-PAY-001 (PAY-4) | EVAL PAY-4 | verified (shared site) |

Dropped (unsupported or overclaiming): "accurate", "real-time", "secure", any precision or
recall figure, "14 of 15 on the shared site" (PAY-8 fix not yet re-verified), any claim that
MCP was shown on the judge site, any customer or team-adoption claim.

## 4. Beat outline (4:45)

| Time | Scene | Must show | Narration focus | Serves |
|---|---|---|---|---|
| 0:00-0:20 | S01 Problem | PAY-1 next to ADR-PAY-001 | the contradiction nobody sees | idea, hook |
| 0:20-0:35 | S02 What Tether is | panel on PAY-1, button | one-line promise | idea |
| 0:35-1:00 | S03 Judge setup | Allow access, Load demo data 9/9 (sped up) | testable in a minute | implementation, judging ease |
| 1:00-1:55 | S04 Aha: the conflict | run, Conflict card, quotes, coverage, history, footer | evidence a human can check | implementation |
| 1:55-2:35 | S05 Not every number is a conflict | PAY-13, PAY-3, PAY-2 outcomes | deterministic maths, honest outcomes | differentiator |
| 2:35-3:00 | S06 Human decides | Create clarification issue, preview, confirm, new issue | people stay in control | impact |
| 3:00-3:25 | S07 Drift | edit ADR in Confluence, banner on PAY-1 | tickets stay tethered over time | differentiator |
| 3:25-3:50 | S08 Rovo agent | Tether agent on PAY-2 | same engine in chat | Best Agents |
| 3:50-4:15 | S09 MCP | Claude Code calling the tool | same engine outside Atlassian | Best MCP |
| 4:15-4:32 | S10 Teamwork Graph + architecture | footer line, Cypher, diagram | how it is built | Best TWG, implementation |
| 4:32-4:45 | S11 Evidence + close | eval screen with limits, links | what was measured | honesty, close |

## 5. Storyboard, narration and sound per scene

Narration budget: 2.5 words/s, at most 80-85 % of the scene. "Lead-in" = narration start
offset in the scene.

### S01 Problem (0:00-0:20, 20 s)
- Asset: `S01-A01-pay1-ticket` (left) and `S01-A02-adr-pay-001` (right), split screen.
- On screen: "Jira: retry exactly 5 times" / "Confluence ADR: no more than 3 times".
  Top-left small: "Demo data".
- Highlights: red box on "exactly 5 times"; red box on "no more than 3 times".
- Transition: push into the right side of PAY-1.
- VO-S01-L01 (lead-in 0.5 s, 33 words, ~13 s): "Here's a ticket asking the payment
  service to retry failed transactions exactly five times. Two clicks away, the team's
  accepted decision says no more than three. Nobody notices until it ships."
  Delivery: calm, slight weight on "five" and "three". Claims C2.
- SFX: none (silence lets the contrast land).

### S02 What Tether is (0:20-0:35, 15 s)
- Asset: `S04-A01-pay1-panel-idle` (first 6 s).
- On screen: "Tether: checks Jira tickets against your Confluence decisions, with evidence".
- Highlight: box on "Check implementation context".
- VO-S02-L01 (lead-in 0.3 s, 28 words, ~11 s): "Tether is a Forge app for Jira and
  Confluence. It checks a ticket's technical requirements against the decisions your
  team already recorded, and shows you the exact evidence."
  Claims C1.
- SFX: SFX-S02-C01 soft pop when the caption appears.

### S03 Judge setup (0:35-1:00, 25 s)
- Asset: `S03-A01-allow-access`, `S03-A02-load-demo-data` (sped up 4x, labelled).
- On screen: "Installed from our install link" · "Load demo data: 1 project, 1 space,
  10 decisions, 30 tickets" · corner tag "sped up 4x".
- Highlights: box on "Allow access"; box on "Loading demo data... 8/9".
- VO-S03-L01 (lead-in 0.4 s, 40 words, ~16 s): "To make this easy to test, an admin
  grants access once, then clicks Load demo data. In about a minute, Tether creates a
  demo project, a decision space and thirty sample tickets. We've sped that part up."
  Claims C15. Delivery: brisk.
- SFX: SFX-S03-C01 click on Load demo data; SFX-S03-C02 swish into S04.

### S04 The conflict (1:00-1:55, 55 s)
- Asset: `S04-A02-pay1-check-run` (stage list, wait trimmed, labelled), `S04-A03-pay1-conflict-report` (scroll).
- On screen sequence: "Wait trimmed (about 60 s on first run)" · "Conflict" ·
  "1 of 2 requirements checked" · "Both quotes verified in their sources" ·
  "Decision history: ADR-PAY-000 superseded".
- Highlights: zoom on the CONFLICT card; boxes on the two quotes; box on the coverage
  bar; box on the scope chips; box on the history list; box on footer "1 page(s) linked to
  PAY-1 in Teamwork Graph".
- VO-S04-L01 (lead-in 0.4 s, 22 words, ~9 s): "On PAY-1, I click Check implementation
  context. The check runs in a background queue, so I've trimmed the wait."
- VO-S04-L02 (at 12 s, 37 words, ~15 s): "Conflict. On the left, the sentence from
  the ticket. On the right, the sentence from the decision, with a link to the page.
  Both quotes are checked word for word against their source."
- VO-S04-L03 (at 30 s, 41 words, ~16 s): "It also tells you what it didn't check:
  one of two requirements had no matching decision. And it shows why this decision
  counts. It's accepted, it applies to the payment service, and it replaced an older
  one."
  Claims C2, C3, C16. Delivery: slow down on "Conflict."; pause 0.4 s after it.
- SFX: SFX-S04-C01 click on the button; SFX-S04-C02 pop on the CONFLICT zoom (only after
  the card is visible; no alarm sound).

### S05 Not every number is a conflict (1:55-2:35, 40 s)
- Asset: `S05-A01-pay13-noconflict`, `S05-A02-pay3-needsreview`, `S05-A03-pay2-insufficient` (each a 10-12 s hold on the verdict, wait trimmed).
- On screen: "PAY-13: 4 attempts including the first = 3 retries → No conflict found" ·
  "PAY-3: is the first try an attempt? → Needs review" · "PAY-2: one requirement has no
  decision → Insufficient evidence".
- VO-S05-L01 (lead-in 0.4 s, 31 words, ~12 s): "Not every different number is a
  conflict. Four attempts, including the first, is the same as three retries. Tether does
  that arithmetic in code, not in a prompt."
- VO-S05-L02 (at 14 s, 24 words, ~10 s): "When the counting is unclear, it says
  Needs review instead of guessing."
- VO-S05-L03 (at 26 s, 26 words, ~10 s): "And when part of a ticket has no decision
  behind it, it says so. Insufficient evidence is never shown as a pass."
  Claims C4, C5, C6, C7.
- SFX: SFX-S05-C01/C02 light swish between the three tickets.

### S06 The human decides (2:35-3:00, 25 s)
- Asset: `S06-A01-follow-up` (PAY-1: Create clarification issue → modal → edit → Create → new issue with links).
- On screen: "Preview, edit, confirm" · "Created as you, linked to PAY-1 and ADR-PAY-001".
- VO-S06-L01 (lead-in 0.4 s, 40 words, ~16 s): "Tether never edits the ticket or the
  decision. If you want to follow up, it drafts a clarification issue. You review it,
  change what you like, and confirm. It's created as you, linked to both."
  Claims C9.
- SFX: SFX-S06-C01 click on Create (only the real click).

### S07 Drift (3:00-3:25, 25 s)
- Asset: `S07-A01-edit-adr` (Confluence edit, publish), `S07-A02-pay1-drift-banner`.
- On screen: "Decision edited in Confluence" · banner text as shown by the app.
- Highlight: box on the banner and on Re-check.
- VO-S07-L01 (lead-in 0.4 s, 37 words, ~15 s): "Decisions change. When someone edits
  the retry decision, the next time anyone opens PAY-1, Tether flags that a decision it
  relied on has changed, and offers a re-check."
  Claims C8. Delivery: steady.
- SFX: SFX-S07-C01 swish on the cut from Confluence to Jira.

### S08 Rovo agent (3:25-3:50, 25 s)
- Asset: `S08-A01-rovo-agent-pay2` (clean site; Agents → Tether; conversation starter or typed question; answer).
- On screen: "Rovo agent: Tether" · "Same engine, same outcome as the panel".
- VO-S08-L01 (lead-in 0.4 s, 37 words, ~15 s): "The same check runs inside Rovo. The
  Tether agent uses our actions and a skill, so you can ask in chat. Here it reaches the
  same result for PAY-2: one requirement checked, one with no decision."
  Claims C10. Pronounce "Rovo" ROH-voh.
- SFX: soft typing only if the question is typed on screen (SFX-S08-C01).

### S09 MCP (3:50-4:15, 25 s)
- Asset: `S09-A01-mcp-claude-code` (dev site; terminal; prompt "Does PAY-1 conflict with any decision?"; tool call `check-issue-consistency`; answer).
- On screen: "MCP: Claude Code → Tether tools" · bottom tag "Recorded on our development site".
- Highlight: box on the tool name in the transcript.
- VO-S09-L01 (lead-in 0.4 s, 38 words, ~15 s): "Tether also exposes its tools over
  MCP. Here, Claude Code calls check issue consistency and gets the same conflict, with the
  quotes and links. This one is recorded on our development site."
  Claims C11.
- SFX: none.

### S10 Teamwork Graph and architecture (4:15-4:32, 17 s)
- Asset: `S10-A01-twg-footer` (zoom on PAY-1 footer), `S10-A02-architecture` (diagram from `docs/ARCHITECTURE.md`, redrawn in Canva), Cypher text from `src/adapters/teamworkGraph.ts`.
- On screen: "Teamwork Graph: decisions linked to the issue" · Cypher (2 lines) · diagram labels.
- VO-S10-L01 (lead-in 0.3 s, 33 words, ~13 s): "To find decisions linked to a ticket,
  Tether asks Teamwork Graph. Everything runs on Forge, and the language model calls use
  Forge LLMs, so nothing leaves Atlassian."
  Claims C12, C13.
- SFX: SFX-S10-C01 swish into the diagram.

### S11 Evidence and close (4:32-4:45, 13 s)
- Asset: `S11-A01-eval-panel` (Tether settings, 30/30 line), end card.
- On screen: "30 of 30 team-written test scenarios passed. Not a measure of real-world
  accuracy." · end card: "Tether · github.com/dngvmnh/Tether · Built for Codegeist 2026".
- VO-S11-L01 (lead-in 0.3 s, 26 words, ~10.5 s): "On our thirty team-written test
  scenarios, all thirty pass. That shows it handles the cases we designed, not real-world
  accuracy. Tether: tickets that stay tethered."
  Claims C14. Delivery: plain, no flourish on the number.
- SFX: none.

## 6. Timing check

| Scene | Start-end | Length | VO words | VO est. | VO share |
|---|---|---|---|---|---|
| S01 | 0:00-0:20 | 20 | 33 | 13.2 | 66 % |
| S02 | 0:20-0:35 | 15 | 28 | 11.2 | 75 % |
| S03 | 0:35-1:00 | 25 | 40 | 16.0 | 64 % |
| S04 | 1:00-1:55 | 55 | 100 | 40.0 | 73 % |
| S05 | 1:55-2:35 | 40 | 81 | 32.4 | 81 % |
| S06 | 2:35-3:00 | 25 | 40 | 16.0 | 64 % |
| S07 | 3:00-3:25 | 25 | 37 | 14.8 | 59 % |
| S08 | 3:25-3:50 | 25 | 37 | 14.8 | 59 % |
| S09 | 3:50-4:15 | 25 | 38 | 15.2 | 61 % |
| S10 | 4:15-4:32 | 17 | 33 | 13.2 | 78 % |
| S11 | 4:32-4:45 | 13 | 26 | 10.4 | 80 % |
| **Total** | | **4:45** | 493 | 3:17 | |

S05 and S11 are the tightest; trim words, never speed up the voice.

## 7. Coverage matrix

| Requirement / criterion | Scenes |
|---|---|
| Under 5 min, public YouTube | whole video (4:45) |
| Problem + product in first 15 s | S01 (narration + captions) |
| Forge | S02, S10 |
| Jira + Confluence | S01, S04, S07 |
| Rovo (Best Agents) | S08 |
| MCP (Best app with MCP) | S09 |
| Teamwork Graph | S04 footer, S10 |
| Human in control | S06 |
| Measured results with limits | S11 |
| Judges can test it | S03 |

## 8. Sound plan

Voice-over is the main audio. No music (unless the rules say otherwise and a licensed
track is chosen). Effects at about a quarter of the voice level, never over a number or
a quote.

| Cue | Scene | Moment | Type | Length | Level | Source / license |
|---|---|---|---|---|---|---|
| SFX-S02-C01 | S02 | caption appears | soft pop | 0.2 s | -15 dB | Canva audio library (check terms) |
| SFX-S03-C01 | S03 | real click on Load demo data | UI click | 0.1 s | -15 dB | Canva |
| SFX-S03-C02 | S03→S04 | transition | light swish | 0.3 s | -18 dB | Canva |
| SFX-S04-C01 | S04 | real click on Check | UI click | 0.1 s | -15 dB | Canva |
| SFX-S04-C02 | S04 | zoom onto CONFLICT card | soft pop | 0.2 s | -15 dB | Canva |
| SFX-S05-C01/02 | S05 | cut between tickets | light swish | 0.3 s | -18 dB | Canva |
| SFX-S06-C01 | S06 | real click on Create | UI click | 0.1 s | -15 dB | Canva |
| SFX-S07-C01 | S07 | Confluence → Jira cut | light swish | 0.3 s | -18 dB | Canva |
| SFX-S08-C01 | S08 | only if the question is typed on screen | soft typing | ≤ 2 s | -20 dB | Canva |
| SFX-S10-C01 | S10 | into diagram | light swish | 0.3 s | -18 dB | Canva |

Never: success chimes, alarms, cash sounds, notification sounds, Atlassian sonic branding.

## 9. Pronunciation guide

| Term | Say | Note |
|---|---|---|
| Tether | TETH-er | |
| Jira | JEE-ruh | |
| Confluence | CON-floo-ence | |
| Rovo | ROH-voh | |
| Forge | forj | |
| Codegeist | CODE-guyst | |
| ADR | A-D-R (or "decision record") | narration avoids it |
| MCP | M-C-P | |
| PAY-1, PAY-13 | "pay one", "pay thirteen" | |
| LLM | L-L-M (narration says "language model") | |
| Cypher | SY-fer | on screen only |

Speech-ready script: same lines as §5 with numbers written as words (done above), "Re-check"
written as "re-check", no symbols, `[pause 0.4s]` after "Conflict." in VO-S04-L02 and after
"three" in VO-S01-L01.

## 10. Shot list (record silently, 1920x1080)

**Setup**: Chrome, new profile, window 1920x1080, page zoom 125 %, bookmarks bar hidden,
extensions hidden, Windows notifications off (Focus), no microphone. Jira light theme
(matches the design colours). Close the cookie banner first ("Only necessary"). Never show
the install link signature, email address, or admin.atlassian.com account pages. Cursor
slow, 1-2 s hold after each action, 2-3 s head and tail per take.

**Before recording on tether-judge-test**: the site already has demo data from 14 Nov.
For S03, record Load demo data a second time (it is idempotent: lines read "already
exists"), or record it on a fresh site if one is available; caption whichever it is.

| File | Site | Path | Must see | Scene |
|---|---|---|---|---|
| S01-A01-pay1-ticket | judge | open PAY-1 | acceptance criteria "exactly 5 times" | S01 |
| S01-A02-adr-pay-001 | judge | ENG → ADR-PAY-001 | "no more than 3 times", status Accepted | S01 |
| S03-A01-allow-access | judge | Jira settings → Apps → Tether settings (only if the consent prompt shows; otherwise skip and drop the line) | Allow access | S03 |
| S03-A02-load-demo-data | judge | Tether settings → Load demo data → wait to the final line | n/9 progress, "Demo data ready" | S03 |
| S04-A01-pay1-panel-idle | judge | PAY-1 → apps button → Tether decision check | button "Check implementation context" | S02 |
| S04-A02-pay1-check-run | judge | click Check (or Re-check) → stages → report | stage list, then report | S04 |
| S04-A03-pay1-conflict-report | judge | scroll the report slowly, expand history | quotes, coverage, chips, history, footer with Teamwork Graph line | S04, S10 |
| S05-A01-pay13-noconflict | judge | PAY-13 → Check | No conflict found | S05 |
| S05-A02-pay3-needsreview | judge | PAY-3 → Check | Needs review, counting reason | S05 |
| S05-A03-pay2-insufficient | judge | PAY-2 → Check | Insufficient evidence, 1 of 2 | S05 |
| S06-A01-follow-up | judge | PAY-1 → Create clarification issue → edit summary → Create → open new issue | preview, confirm, links to PAY-1 and ADR-PAY-001 | S06 |
| S07-A01-edit-adr | judge | ADR-PAY-001 → Edit → change a wording line (keep "no more than 3 times") → Publish | version change | S07 |
| S07-A02-pay1-drift-banner | judge | reopen PAY-1 | "A decision used in this check has changed", Re-check | S07 |
| S08-A01-rovo-agent-pay2 | judge | Rovo → Agents → Tether → "Does PAY-2 conflict with any engineering decision?" | answer: Insufficient evidence, 1 of 2 | S08 |
| S09-A01-mcp-claude-code | dev | terminal, `claude`, ask "Does PAY-1 conflict with any decision?" | tool call `check-issue-consistency`, Conflict answer | S09 |
| S11-A01-eval-panel | judge | Tether settings → Evaluation (scroll to the result line) | "30/30 passed · missed conflicts 0 · false conflicts 0 · false "no conflict" 0" | S11 |

Order: S01 → S04 → S05 → S06 → S07 → S03 → S08 → S11 on the judge site, then S09 on the
dev site. Re-take if any personal data, token or notification appears; never edit a
recording to change what happened.

Pre-flight: production 4.0.0 or later on the judge site; a fresh PAY-1 run done before
recording so the cache is warm (or record the cold wait and trim it with the caption);
MCP: `claude mcp list` shows `tether` connected and the dev site is the one authorised.

## 11. Production notes

- Tools (checked later, at the voice stage): Canva is connected (designs, uploads,
  export). No text-to-speech tool is confirmed in this session; if none can generate
  audio, the fallback is a human read (Đăng) with the script above, or a TTS tool you
  choose. A synthetic voice must be disclosed in the YouTube and Devpost descriptions.
- Captions: burn in the key captions; also upload an SRT to YouTube.
- Draft YouTube title: "Tether: check Jira tickets against your engineering decisions
  (Codegeist 2026)". Chapters follow §4.

## 12. Open questions (blockers for the voice and final edit only)

1. The rules page needs a browser check I can't pass. Please paste the **video**
   section (length, narration, music, AI-generated content) and the **judging criteria**.
2. Voice: your own voice, or a synthetic voice (disclosed)?
3. Eval wording: the 30/30 set was written and used by the team during development, so the
   video says "30 of 30 team-written test scenarios ... not a measure of real-world
   accuracy". OK to keep it, or drop the number entirely?
