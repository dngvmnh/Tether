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
Not tested on the clean site yet: Rovo agent, MCP, drift, Teamwork Graph.

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
