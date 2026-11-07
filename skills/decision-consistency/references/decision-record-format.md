# Decision record format

A decision record is a Confluence page labelled `tether-decision` with a Page Properties
table containing these fields:

| Field | Example | Notes |
|---|---|---|
| Decision ID | ADR-PAY-001 | Unique |
| Status | Accepted | Accepted, Proposed, Superseded, Deprecated, Rejected |
| Service | payment-service | `*` or empty means every service |
| Environments | production, staging | Empty means every environment |
| Conditions | failed transactions | When the decision applies |
| Owner | @Priya Raman | A user mention gives Tether the account id |
| Decision | The payment service must retry failed transactions no more than 3 times. | The constraint, in plain words |
| Rationale | Retry storms doubled upstream load. | Why |
| Supersedes | ADR-PAY-000 | Comma separated ids |
| Superseded by | | Optional; inferred from newer records |
| Effective date | 2026-03-02 | |

A decision is **current** only if its status is Accepted and no other accepted decision
supersedes it.
