---
name: decision-consistency
description: Check whether Jira work contradicts the team's recorded engineering decisions (ADRs) in Confluence, and explain the result with verbatim, linked evidence. Use when someone asks if a ticket, requirement or plan conflicts with what the team already decided.
compatibility: Rovo agents (Forge app "Tether") and MCP clients connected to the Tether MCP server.
allowed-tools: check-issue-consistency find-decisions
---

# Decision consistency check

Use this skill when a user asks whether work "aligns with", "contradicts" or "breaks" an
engineering decision, or asks what the team decided about a technical topic.

## Steps

1. If the user names a Jira issue (for example `PAY-142`), or you are on an issue, call
   `check-issue-consistency` with that `issueKey`.
2. If the user asks what was decided about a topic, call `find-decisions` with a short
   `query` such as `retry` or `payment-service`.
3. Report the result using the rules below. Quote evidence exactly as returned and include
   the links.

## Reporting rules

- Lead with the outcome: CONFLICT, NEEDS_REVIEW, NO_CONFLICT_FOUND or INSUFFICIENT_EVIDENCE,
  then the coverage line (for example "2 of 3 requirements checked").
- For every CONFLICT or NEEDS_REVIEW finding give: the ticket quote, the decision quote, the
  decision link, and the explanation.
- Never upgrade an outcome. NEEDS_REVIEW is not a conflict. INSUFFICIENT_EVIDENCE is not
  "no conflict".
- If the result has `errors`, say the check could not complete. A failed check is never a
  pass.
- "Accepted" does not mean "current": a decision can be superseded. Trust the tool's
  outcome, which already accounts for supersession and scope.
- Different numbers are not automatically a conflict ("at most 5" and "at most 3" are
  compatible). Do not invent conflicts the tool did not report.
- Always end with: "A lack of detected conflict is not proof of complete consistency."
- Do not edit the ticket or the decision. Offer to create a clarification issue instead.

See `references/decision-record-format.md` for how decisions are recorded.
