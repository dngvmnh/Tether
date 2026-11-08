# Independent six-case audit — 8 November 2026

**Current status:** Đăng's four clarifications have now been received and applied in
the implementation/reference data. The pending-review notes below describe the earlier
diagnostic stage; the adopted decisions are recorded at the end of this file.

Scope: S01, S09, S12, S13, S27, S28 only. S02 remains in the earlier review record.
Before evidence: `remaining-six-before-2026-11-08.json`, deployed version 2.5.0 with
unchanged engine prompts, real `claude-sonnet-5`. All six overall verdicts matched;
none passed strict field scoring. Full diagnostics were captured for all six in
68,698 ms. An unchanged overall outcome does not establish correct extraction.

## Findings and bounded actions

| Case | Observed difference | Action |
|---|---|---|
| S01 | The explicit retry logging acceptance criterion is material in extraction, but immaterial in gold; logging key and `each retry` scope also differ | Preserve the source requirement. Ask the team to resolve materiality/scope; give uncovered logging a stable `retry.logging` key |
| S09 | The audit recipient is incorrectly selected as the actor; idempotency and audit conditions are explicit in extraction but absent from gold | Clarify actor versus recipient and provide a stable audit-event key. Keep scope differences visible for review |
| S12 | Source says refunds `up to 50,000 USD`; extraction uses LTE on an auto-approval-limit key, while gold uses EQ on a configured maximum key | Do not force EQ merely to match gold. Review whether the label represents a configured threshold or a bound/condition on refund amounts |
| S13 | `may be attempted at most 4 times` is extracted with modality MAY, despite its binding maximum | Clarify constraint strength in the tool schema. Reject this specific permission/binding-cap confusion and request one repair; preserve genuinely optional configuration |
| S27 | Extraction keeps `payment creation requests` as a scope restriction; gold has no conditions | Keep the source restriction pending a team convention; do not broaden an idempotency rule merely to pass field scoring |
| S28 | Same idempotency scope difference; `metrics.emission_interval` versus gold `metrics.emit_interval`; gold display label incorrectly says gateway timeout | Provide a canonical emission-interval naming hint. Fix only the cosmetic gold label and regenerate fixtures; leave scope labels unchanged |

Naming hints contain property definitions, not scenario IDs, numeric answers or expected
verdicts. The scorer has not been weakened, and no alternative attribute key is silently
accepted as a strict pass. Explicit recipient names are still retained when they really
are the actor (e.g. Notification Service performs notification retries).

The S13 guard applies only to extracted MAY numeric count caps with explicit permission
phrasing such as `may be attempted at most`. It asks the model to repair its response;
it never silently rewrites the modality. A regression test verifies repair preserves
LTE 4 total attempts including the initial request. A second test preserves genuinely
optional retry-policy configuration instead of promoting all uses of may to MUST.

## Annotation decisions not made by the agent

The user is asking Đăng about S02 configurability, S01 logging materiality and the
idempotency creation-request scope convention. No answer has been supplied yet.

S12 is an additional representation decision: `configured maximum = 50,000` and
`refund amount <= 50,000` describe different properties. A reference annotation must
make that distinction explicit. The staging-versus-production applicability result
already matches gold; this audit does not rewrite the threshold policy or source ticket.

Aside from S28's display label (`gateway timeout` → `metrics emit interval`), golden
inputs, operators, materiality, conditions and expected outcomes remain unchanged.
No shared contracts, adapters, UI components or manifest files were edited. The only
UI data change is the generated S28 fixture label and text derived from that label.

## Verification

After source changes and fixture generation, `npm run check` passed: 113 tests,
30/30 offline scenarios, backend/UI type checking, manifest schema and UI build.
Three evaluator orchestration tests also passed after the diagnostic byte budget was
raised from 120 KB to 160 KB to capture six reports below the Forge KVS value limit.

A full real-model regression is required to confirm the actor and modality changes.
Its results will be recorded below without treating unresolved annotations as passes.

## Team clarifications adopted

Đạt forwarded Đăng's explicit answers, then requested implementation. No shared API
schema was changed.

- S01 logging is material. Both it and S09's audit emission retain their explicit
  per-retry scope. S01's expected coverage is 1/2, with the logging claim unassessed
  because no decision covers that feature. The README example was updated.
- S02 retains the compatible numeric bound and adds required
  `retry.count.config_scope`, qualifier `merchant`. The existing `textValue` string
  field carries that qualifier; `value` remains numeric. Its expected overall outcome
  is Insufficient Evidence, coverage 1/2. Numeric retry caps cannot supply evidence
  for a separate configuration-scope obligation.
- Idempotency stays `idempotency_key`; `payment creation requests` is preserved in
  both the decision metadata/constraints and the relevant ticket claims. The strict
  scorer accepts request/requests grammatical variation, not refund/creation scope
  substitutions. Existing runtime substring scope matching is unchanged.
- S12 keeps the configured maximum property and gold EQ 50,000. GTE is an explicitly
  accepted annotation alternative. LTE remains invalid for this mandatory approval
  coverage; it would incorrectly permit a smaller configured threshold. Tests verify
  both accepted forms conflict with a production cap of 10,000 and preserve S12's
  staging-versus-production Insufficient Evidence result.

The engine's feature-presence comparison also refuses a clean pass when categorical
qualifiers differ or one is missing. Extraction requests one repair for a missing
configuration qualifier or an inverted refund-threshold interpretation. These are
generic property checks; no scenario IDs or expected verdicts are passed to the LLM.

After applying the decisions and regenerating fixtures, `npm run check` passed:
**123 tests, 30/30 offline scenarios**, type checks, manifest and UI build. The 10 new
tests cover the approved coverage rules, categorical qualifier preservation, refund
threshold safety, approved operator alternative, and request-type scope separation.

The annotation revision has changed intentionally. A new real-model strict score must
be reported with that revision, not described as a directly comparable accuracy gain
over the earlier incomplete labels.
