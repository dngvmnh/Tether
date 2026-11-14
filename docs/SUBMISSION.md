# Submission checklist (Devpost, due 23 Dec 2026 04:00 SGT)

## Open questions (someone read the official rules page in a browser)
- [x] Can one project win a placing prize and bonus prizes? **Yes** (Đăng read the rules, 13 Nov).
- [x] Repo visibility: **public repo required**, plus a public YouTube video link.
- [ ] Anything on Preview features (rovo:mcp, rovo:skill, Teamwork Graph)?

## Judging app installation link (created 13 Nov 2026)

Production build of the judging app (2.1.0, deployed 13 Nov 10:20 UTC), Sharing with anyone,
Jira + Confluence. Regenerating the link in the developer console invalidates this one.

https://developer.atlassian.com/console/install/07520459-db83-4ab5-b000-09c3c8095691?signature=AYABeErpGojCngGAq6cJ4g%2FXv3IAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBlx5ejTkNbBe95tlFfOe3pgAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDD1jXdhdP2eLtW0OgAIBEIA7ANwgnVc%2FTPB%2Bap1nqLLr30nZnAi2HB1SnZ3fpRxa%2FcwGLDtXRcRSrwb49CMWCuJNjpTH7rcsvn6TnXYAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgHegWr%2BchkFFstK3R6bBE6mAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM3jpVZRxub7nQFdY5AgEQgDtxW0Kmrfdnl7Eecxa3wn6TB11iD5lPmFqWBbT9MKED3YxdTcR3%2FtUse1zWOjpMtYAhFxVzYHyJgftsoQAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAWXa%2BPYYtb6OpTddjxgBXcMAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAywWezSLKYixJlx8F4CARCAO2Ij6c%2FGVbaylHgdNWmgXMJXdR0XkQVkKOTNNF3Dr90seKCkBZFNZ02qaTh5ShvZOE8z%2B934weF%2FBdrXAgAAAAAMAAAQAAAAAAAAAAAAAAAAAKgoqySX5f31ottWQxNQY83%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJZH9UbMLXqOSANS0ZpqiUcdQSiA2PAdVfFBVagEGYmsESqB0RQsXga%2FJEK%2BrpD%2Bamilxv7ZEeEN0n%2FCaQq0kiRsNE%3D&product=jira&product=confluence

Distribution details set: company "Tether team (Codegeist 2026)", support
https://github.com/dngvmnh/Tether/issues, privacy policy and terms from `docs/marketplace/`,
"Stores personal data: Yes" (reports keep decision owners' account IDs for more than 24 h).
Redeploy production (`forge deploy -e production`) before recording and before submitting so
judges get the final code; the link stays valid across deploys.

### Clean-site test (13 Nov 2026, tether-judge-test.atlassian.net, fresh free site)
What a judge goes through, and what happened:
1. Open the link, **Get app**, choose the site, keep Jira + Confluence ticked, **Install**.
   Confluence installed first time. **Jira failed once** ("Installation failed. Try again or
   contact app owner") and installed on the second click of Install. Tell judges to press
   Install again if one product fails.
2. The fresh site only has a `KAN` project, so create a Jira project with key `PAY`
   (company-managed Kanban works), then run the seed against the site:
   `ATLASSIAN_SITE=<site> ATLASSIAN_EMAIL=<email> ATLASSIAN_API_TOKEN=<own token> node scripts/seed/seed.mjs`.
   It created space `ENG`, the decision pages, and PAY-1..PAY-30. Default settings
   (space `ENG`, label `tether-decision`) already match, so no settings step was needed.
3. PAY-1, issue apps button, **Tether decision check**, **Check implementation context**.
   About 60 s on a cold cache. Result: **CONFLICT, contradicts ADR-PAY-001** (5 retries vs no
   more than 3), "1 of 2 requirements checked, 1 has insufficient evidence", same as on the
   dev site.
4. Drift: edited ADR-PAY-001 (v1 to v2). The Confluence page trigger marked **0** issues stale.
   Cause: without `app.compatibility` in the manifest, Jira and Confluence are separate
   installations with separate storage, so the Confluence trigger cannot see the index the
   Jira panel's check wrote. Fixed with pull-based staleness (prod 2.5.0): reading a report
   compares each decision page's stored version with the current one (one CQL search). Log
   after the fix: `drift PAY-1 as=user read 10/10 pages; changed: ADR-PAY-001`.

Same-day findings that matter for judging:
- Panel checks (Jira installation) and Rovo/MCP checks (where the page trigger *does* find
  their index, so likely the Confluence installation) keep **separate** reports and settings.
  Settings saved in the Jira admin page, including the Teamwork Graph query key, are not seen
  by Rovo/MCP checks, which fall back to Jira remote links. Pull-based staleness covers drift
  for both. One shared store would need the multi-product migration (after submission).
- Confluence v1 `GET /wiki/rest/api/content/{id}` answers **410 Gone**. Linked pages without
  the decision label (Teamwork Graph / remote links) were silently dropped; now fetched with
  one CQL `id in (...)` search.
- MCP on the dev site (development 3.6.0): after an ADR edit, `check-issue-consistency`
  returned the stored CONFLICT with the "may be out of date" note and started a re-check;
  asking again ~20 s later returned the fresh CONFLICT.

- Rovo agent on the clean site (prod 2.5.0): PAY-2, Agents, Tether. The agent session answered
  INSUFFICIENT_EVIDENCE, 1 of 2 checked, C1 NO_CONFLICT_FOUND vs ADR-PAY-001 (5 is looser than
  the limit of 3, compatible if kept within it), C2 NO_DECISION_FOUND. Exactly gold S02.
- Teamwork Graph from the panel on the dev site (development 3.6.0, Bảo's query key in
  settings, Đăng's account): no permission error this time (Bảo's retry is deployed).
  PAY-1 `Teamwork Graph returned 1 linked page(s)` (its ADR-PAY-001 web link); PAY-3 returned 0
  (no link). The panel showed the pull-based "A decision used in this check has changed"
  banner on both before the re-check.

- Teamwork Graph on the clean site: Bảo's query key `66b8902d-a241-4a00-86ad-5c5f8a461be4`
  saved in Jira settings > Apps > Tether settings. PAY-1 re-check: `Teamwork Graph returned 1
  linked page(s)`. The persisted query key works across sites. **Judge instructions must tell
  judges to paste this key** (settings default is empty, which falls back to remote links).
  Update 14 Nov: the key is now the settings default, so judges do not paste anything.
- MCP on the clean site: enabled at admin.atlassian.com > (site) > Connected apps > Tether
  (Jira) > Details > Tools > "Expose tools to MCP-compatible apps" > Enable tools. Calling it
  from Claude Code was not verified: after clearing the `tether` sign-in and re-authenticating
  with tether-judge-test picked, a brand-new session still got only the `_development` tools
  and dev-site (one-atlas-dscw) URLs. Record the MCP prize video on the dev site, where MCP is
  verified end to end.

### In-app "Load demo data" on the clean site (14 Nov 2026, production 4.0.0)
PAY and ENG were deleted first (and PAY purged from the Jira trash: a trashed project keeps
its key and name, so creation answers HTTP 400 "already exists"). Then, as a judge would:
1. Jira settings > Apps > Tether settings. After an upgrade that adds scopes, the page shows
   "For Tether settings to display, you need to grant it access": click **Allow access**, then
   **Accept** on the Atlassian consent page.
2. **Load demo data**: 9/9 steps in about a minute. Created project PAY (Payments), space ENG
   (Engineering Decisions), 10 labelled decision pages, issues PAY-1..PAY-30, and the web links
   PAY-1 to ADR-PAY-001, PAY-4 to ADR-PAY-000, PAY-8 to ADR-SEC-003 (checked over REST).
   Tether settings were pointed at ENG / `tether-decision` automatically.
3. PAY-1 > apps button > Tether decision check > Check: **CONFLICT, 1 requirement contradicts
   ADR-PAY-001** ("exactly 5 times" vs "no more than 3 times"), 1 of 2 checked. Log: Teamwork
   Graph returned 1 linked page, 10 decisions retrieved.

Bugs found and fixed on the way:
- Project creation needs `manage:jira-configuration` (the API docs' scope for
  POST /rest/api/3/project), not `manage:jira-project`. With the wrong scope, asUser kept
  re-showing the consent prompt after Accept, and asApp answered 401 "scope does not match".
  The dev site never hit this because PAY already existed there. Fixed in production 4.0.0 /
  development 6.0.0; project creation also falls back to the app identity if the user has not
  granted the scope.
- Major version: teammates must `forge install --upgrade` their dev environments (Jira and
  Confluence) and approve the new scope.
- KVS outlives the project: the panel on the new PAY-1 first showed the old PAY-1 report with
  a "ticket changed" banner. Judges start on a clean site, so they will not see this.

**Judge instructions (draft):** open the install link and install for Jira and Confluence (press
Install again if the first try says "Installation failed"); Jira settings > Apps > Tether
settings > Allow access + Accept; Load demo data; open PAY-1 and run the check (expect
CONFLICT vs ADR-PAY-001). The Teamwork Graph query key is now pre-filled by default.

## Two registered apps (needed for the Marketplace bonus)
Forge docs: apps submitted for Marketplace listing **cannot be shared by installation
link**. So:
1. **Tether** (judging app, id in `manifest.yml`): deploy to production, Distribution → Sharing → installation link for Jira **and** Confluence. This link goes on Devpost.
2. **Tether for Marketplace**: owner runs `forge register "Tether for Marketplace"` on a copy, records both ids in `scripts/apps.json`, then `node scripts/use-app.mjs marketplace && forge deploy -e production`, submits the listing, and switches back with `node scripts/use-app.mjs judging`. Only the app owner can submit to Marketplace. Needs a Marketplace partner profile, privacy policy, EULA/terms, logo and screenshots. Drafts: `docs/marketplace/` (PRIVACY, TERMS, LISTING with security-questionnaire answers).

## Required
- [x] Installation link (created, see above) tested on a **clean** site (not the dev site) for both Jira and Confluence (13 Nov, panel check; see "Clean-site test")
- [ ] Judge instructions: install link, create project + space or run our seed, sample issue keys, expected outcomes
- [ ] Demo video < 5 min, public on YouTube
- [ ] Category: Apps for Software Teams
- [ ] Bonus prizes claimed, each with evidence (below)
- [ ] Explanation of how Forge + Jira + Confluence + Rovo + Teamwork Graph are used
- [ ] Repo link, README with architecture

## Bonus evidence
- Best Agents: screenshot/video of the Tether agent in Rovo Chat; list of actions + skill.
- MCP: video of an external MCP client (Claude Code / Claude Desktop) calling `check-issue-consistency` via `https://mcp.atlassian.com/forge/07520459-db83-4ab5-b000-09c3c8095691` (not the general `mcp.atlassian.com/v2/mcp` server); admin must enable "Expose tools via external MCP endpoint" for the app (admin.atlassian.com → Apps → Sites → Connected apps). Link `skills/decision-consistency/SKILL.md`.
- Teamwork Graph: show a decision found only through the issue→page link, and the Cypher used.
- Marketplace: listing link or Marketplace review ticket link.

## Video outline (≤ 4:45)
1. 0:00 Problem: Jira says 5 retries, the ADR says 3, the developer never knew (20 s).
2. 0:20 Click Check: Conflict with side-by-side quotes, decision history, coverage (60 s).
3. 1:20 Subtlety: "up to 5" is not a conflict; "4 attempts" needs review; failures never pass (45 s).
4. 2:05 Drift: edit the ADR in Confluence, the ticket is flagged (30 s).
5. 2:35 Rovo agent in chat; same tool from Claude via MCP (45 s).
6. 3:20 Teamwork Graph + architecture + eval numbers (45 s).
7. 4:05 Follow-up issue created with links; close (30 s).
