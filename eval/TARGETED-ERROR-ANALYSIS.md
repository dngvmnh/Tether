# Targeted extraction analysis — S02, S05, S11

Scope: Đạt's engine/evaluation work. Original golden tickets and labels are unchanged.
Evidence before changes: `targeted-before-2026-11-08.json` (Forge 2.2.0, real
`claude-sonnet-5`, three scenarios, 47,677 ms). This is a fresh stochastic run;
S11's overall result already differed from the first baseline without a prompt change.

## S02: correct bound comparison, incomplete reference annotation

Actual extraction contains both:

- `retry.count`, LTE 5 retries, for failed transactions.
- A material configurability requirement, quoted verbatim: `configurable per merchant`.

The numeric finding is already correct: `NO_CONFLICT_FOUND / CONSISTENT_IF_TIGHTER`.
The second property incorrectly reused the numeric attribute key and the semantic
model speculated about possible configured values. The new prompt distinguishes
configurability from counts and instructs semantic comparison to check the requested
property, not hypothetical values belonging to another claim.

The existing gold labels omit configurability. Removing a real requirement or marking
it immaterial just to reproduce the old overall verdict would hide missing coverage.
**Proposed annotation for team review:** retain the existing numeric claim and its
expected finding; add a material `retry.configurability` qualitative claim with the
quote `configurable per merchant`. If no decision addresses this property, its finding
is `INSUFFICIENT_EVIDENCE / NO_DECISION_FOUND`, making the complete ticket outcome
`INSUFFICIENT_EVIDENCE`. The numeric upper-bound assertion remains unchanged.

This is a proposal, not a change to `scenarios.json`. The legacy score must continue
to show any mismatch until the reference annotation is agreed.

## S05: explicitly named service replaced by wildcard

Actual claim subject was `Notification Service`, but `scope.service` was `*`, even
though the quote explicitly named the notification service. The engine correctly
treated that wildcard as unknown and returned `NEEDS_REVIEW / AMBIGUOUS_SCOPE`
against a payment decision instead of a confirmed conflict.

The extraction prompt and tool schema now explicitly permit new service slugs outside
the known vocabulary. An explicitly named service must not become a wildcard merely
because it is absent from the decision library. Unknown, unnamed services still remain
unknown; no scope/math safety checks were relaxed.

## S11: explicit numeric duration lost in qualitative text

The actual ticket claim was `QUALITATIVE`, attribute `retry.backoff_strategy`, with
`textValue: fixed 1 second backoff`; there was no numeric value or unit. The proposed
webhook ADR separately extracted an EQ 2 s initial delay, so deterministic comparison
could not match the properties. Semantic comparison instead cited the accepted general
transaction retry ADR with an uncertain scope. Its Needs Review outcome happened to
match gold in this run, but for a different reason.

The prompt now preserves explicit fixed/initial backoff durations as numeric claims
and uses distinct keys for delay versus strategy. Independently stated strategy rules
are still retained. It also distinguishes a component/action name from a true operating
condition. Proposed decisions must still produce review, never authoritative conflicts.

## Verification

`npm run check` passed: 110 tests, 30/30 offline scenarios, type checks, manifest and UI
build. These checks do not measure prompt quality. A full real-model regression with
diagnostics for the same three cases is required before claiming improvement.

The eval harness can capture named full reports within a 120 KB diagnostic budget.
`TETHER_EVAL_SCENARIO_IDS` optionally selects cases; unknown IDs fail explicitly.
`TETHER_EVAL_DIAGNOSTIC_IDS` selects reports to retain. Both settings belong to the
developer's own Forge environment. No extra site, app, repository or endpoint is used.
