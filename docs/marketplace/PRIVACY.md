# Tether privacy policy

_Last updated: 10 November 2026. Draft for the Atlassian Marketplace listing; the app owner
publishes this text at a public URL (for example a GitHub Pages page of this file) and puts
that URL in the listing._

Tether is an Atlassian Forge app that checks whether a Jira work item's technical
requirements contradict engineering decisions recorded in Confluence.

## Where Tether runs

Tether runs entirely on Atlassian's Forge platform and is eligible for the **Runs on
Atlassian** program. It has **no external egress**: it does not send data to any server
operated by the Tether team or any third party. Language-model calls use **Forge LLMs**,
which Atlassian hosts; no data leaves Atlassian's infrastructure through Tether.

## What Tether reads

Only when a user runs a check (issue panel, Rovo agent, or MCP tool), or when a page or
issue it has already checked changes:

- The Jira work item being checked (summary, description, acceptance criteria, labels, remote links).
- Confluence pages carrying the configured decision label in the configured spaces, plus pages linked to the work item (through Jira remote links or Teamwork Graph).
- Whether the requesting user can view each of those pages. Pages the user cannot view are excluded from that user's results.

Tether reads data **as the requesting user** where the platform allows it, and filters
app-level reads with the Confluence permission check, so a check never shows content the
user could not open themselves.

## What Tether stores

In Forge storage (hosted by Atlassian, scoped to the site installation):

| Data | Purpose |
|---|---|
| Analysis reports per work item (quotes from the work item and decision pages, outcome, coverage) | Show the latest result in the issue panel and to the Rovo agent |
| Job records (work item key, status, the Atlassian account ID of the requester) | Run checks asynchronously and show progress |
| A per-page index of which work items were checked against it | Flag those work items when the decision page changes |
| Extracted constraints per decision page version | Avoid re-reading unchanged pages |
| App settings (spaces, label, model order, Teamwork Graph query key) | Configuration |

Tether stores no email addresses, names or credentials. Atlassian account IDs are
opaque identifiers used only to run the check as that user.

## Data residency, retention and deletion

Forge storage follows Atlassian's data residency for Forge apps. Stored data is deleted by
the platform when the app is uninstalled from the site. Admins can also clear results by
uninstalling and reinstalling.

## Personal data and GDPR

Tether processes personal data only as far as it appears in Jira or Confluence content the
user asks it to check, and the requester's Atlassian account ID. It does not profile users,
sell data, or use content to train models. Atlassian's Forge LLM terms govern model calls.

## Contact

Questions or deletion requests: open an issue at https://github.com/dngvmnh/Tether/issues
or contact the vendor through the Marketplace listing.
