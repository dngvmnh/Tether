# Submission checklist (Devpost, due 23 Dec 2026 04:00 SGT)

## Open questions (someone read the official rules page in a browser)
- [ ] Can one project win a placing prize and bonus prizes? Several bonus prizes?
- [ ] Repo visibility requirement (public / shared with judges)?
- [ ] Anything on Preview features (rovo:mcp, rovo:skill, Teamwork Graph)?

## Two registered apps (needed for the Marketplace bonus)
Forge docs: apps submitted for Marketplace listing **cannot be shared by installation
link**. So:
1. **Tether** (judging app, id in `manifest.yml`): deploy to production, Distribution → Sharing → installation link for Jira **and** Confluence. This link goes on Devpost.
2. **Tether for Marketplace**: owner runs `forge register "Tether for Marketplace"` on a copy, records both ids in `scripts/apps.json`, then `node scripts/use-app.mjs marketplace && forge deploy -e production`, submits the listing, and switches back with `node scripts/use-app.mjs judging`. Only the app owner can submit to Marketplace. Needs a Marketplace partner profile, privacy policy, EULA/terms, logo and screenshots. Drafts: `docs/marketplace/` (PRIVACY, TERMS, LISTING with security-questionnaire answers).

## Required
- [ ] Installation link tested on a **clean** site (not the dev site) for both Jira and Confluence
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
