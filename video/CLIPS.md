# Recorded clips (14 Nov 2026)

Raw screen recordings for the demo video, recorded silently. They live in `video/clips/`
(gitignored, about 13 MB in total) and are shared with the editor outside git.

- Browser clips: tether-judge-test, production build, recorded from the browser pane with
  no extension overlays or cursor. 1920x884, 30 fps, H.264 in MKV. Jira dark theme,
  Confluence light. Scale or crop to 1920x1080 in the editor.
- Terminal clip (S09): full screen 1920x1200, Windows Terminal, Claude Code on the
  development site (one-atlas-dscw). Caption: "Recorded on our development site".
- Clicks are real; waits are recorded in full and should be trimmed with a caption
  ("wait trimmed"). Nothing was staged.

| File | Scene | Length | Content |
|---|---|---|---|
| S01-A01-pay1-ticket.mkv | S01 | 10 s | PAY-1, "exactly 5 times" in the acceptance criteria |
| S01-A02-adr-pay-001.mkv | S01 | 10 s | ADR-PAY-001, Accepted, "no more than 3 times" |
| S04-A01-pay1-panel-idle.mkv | S02 | 9 s | Tether panel on PAY-1 with its earlier report and Re-check |
| S04-A02-pay1-check-run.mkv | S04 | 53 s | Re-check, stage list, Conflict report |
| S04-A03-pay1-conflict-report.mkv | S04, S10 | 20 s | Scroll through quotes, scope chips, decision history, footer "1 page(s) linked to PAY-1 in Teamwork Graph" |
| S05-A01-pay13-noconflict.mkv | S02, S05 | 63 s | Apps button, Tether decision check, "Check implementation context" (good for S02), run, No conflict found |
| S05-A02-pay3-needsreview.mkv | S05 | 43 s | Re-check, Needs review, "depends on whether the first request counts" |
| S05-A03-pay2-insufficient.mkv | S05 | 55 s | Re-check, Insufficient evidence, 1 of 2 requirements checked |
| S06-A01-follow-up.mkv | S06 | 51 s | Create clarification issue, edit the summary, Create, then PAY-33 with the link to PAY-1 and the ADR web link |
| S07-A01-edit-adr.mkv | S07 | 41 s | Edit ADR-PAY-001 (Rationale gets "Reviewed in November 2026."), Update |
| S07-A02-pay1-drift-banner.mkv | S07 | 25 s | PAY-1: "A decision used in this check has changed", Re-check |
| S08-A01-rovo-agent-pay2.mkv | S08 | 76 s | Rovo, switch to the Tether agent, starter "Does this issue conflict...", answer on PAY-2: Insufficient evidence, 1 of 2 |
| S03-A02-load-demo-data.mkv | S03 | 44 s | Tether settings, Load demo data (rerun, items already exist), "Demo data ready" |
| S11-A01-eval-panel.mkv | S11 | 9 s | "30/30 passed · missed conflicts 0 · false conflicts 0 · false "no conflict" 0" |
| S09-A01-mcp-claude-code.mkv | S09 | 131 s | Question typed, tool call "tether - Check issue against decisions (development) (MCP)", Conflict answer, Ctrl+O shows the full tool result |

Not recorded: S03-A01 "Allow access" (no consent prompt on this site; drop the line or
caption it). The S07 wording edit was reverted afterwards (page version 3) and PAY-1 was
re-checked.
