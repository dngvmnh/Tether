# Marketplace listing copy (Tether for Marketplace)

**Name:** Tether: Decision Consistency for Jira

**Tagline (≤ 80 chars):** Catch Jira tickets that contradict your team's engineering decisions.

**Category:** Project management / IT & helpdesk → Software development. Hosting: Cloud. Price: Free.

**Summary (≤ 250 chars):**
Tether checks a Jira work item against the engineering decisions (ADRs) your team recorded
in Confluence and shows the exact sentences that conflict, whether the decision is still
current, and whether it applies to this service.

## Highlights (3 × title + ≤ 200 chars)

1. **Evidence, not opinions.** Side-by-side quotes from the ticket and the decision, each verified word for word. Deterministic checks for numbers, units, retry counting and supersession.
2. **Honest about uncertainty.** Four outcomes (Conflict, Needs review, No conflict found, Insufficient evidence) with coverage. API failures are never shown as a pass.
3. **Stays tethered.** When a decision page changes, every ticket checked against it is flagged. Ask the Tether Rovo agent, or call the same tools from your AI client via MCP.

## Description

Teams record engineering decisions in Confluence, but tickets keep asking for things the
team already ruled out. Tether reads the acceptance criteria of a work item, finds the
decisions that apply (by label, Jira links and Teamwork Graph), and checks each requirement.

- Conflicts show the ticket sentence and the decision sentence side by side, with the decision's status and history (superseded decisions are never used).
- Scope-aware: a production-only decision does not block a staging ticket.
- One click creates a clarification issue, linked to the ticket and the decision.
- Works where you work: Jira issue panel, Rovo agent and skill, MCP tools for external AI clients.
- Runs on Atlassian: no data leaves Atlassian; language-model calls use Forge LLMs.

**Setup:** add the label `tether-decision` to decision pages that use a Page Properties
table, then set the space and label in Jira settings → Apps → Tether settings.

## Links to fill in
- Privacy policy URL: publish `docs/marketplace/PRIVACY.md`
- EULA: Atlassian standard EULA, or publish `docs/marketplace/TERMS.md`
- Documentation: https://github.com/dngvmnh/Tether#readme
- Support: https://github.com/dngvmnh/Tether/issues

## Assets to produce
- Logo 144×144 PNG (from `static/report/public/tether.svg`), high-res 1024×1024.
- Banner 1120×548.
- 3–5 screenshots 1840×900: Conflict finding, Needs review (attempts vs retries), stale banner, Rovo chat answer, settings.

## Data security questionnaire (answers)
- Stores end-user data outside Atlassian? **No.** Egress: **none**. Runs on Atlassian: **yes**.
- Stores personal data? Atlassian account IDs only (job records). Encryption at rest: Forge storage.
- Data deletion on uninstall: **yes**, platform-managed.
