# G-6 — Owner TEST Setup & Readiness Report (#152)
Status: MERGED (as-if merged; exact-head CI and review gates required).
Design: docs/designs/BATCH-G.md §4 G-6 and approved owner instructions on PR #151.
Drift A: src/acceptance/owner-test-smoke.js already dispatches safe TEST reads;
src/stripe/setup-page.js currently prints their bare redacted statuses. Missing:
a truthful owner-private exception-focused readiness interpretation. Reuse both;
do not create a public setup report or new Stripe privileges.

## Scope and acceptance
- Classify each owner-validated selected TEST MCP native read as observed/partial/
  not_readable/error; strict tool-set validation and no arbitrary source fields.
- Owner-private page presents the report and recommended next action without
  interpreting absent settings as Stripe defaults or successful reads as intent.
- No blanket manual Dashboard checklist; owner’s prior signed-in facts are
  documented as owner observations only.
- OAuth, signed event delivery/signature, Dashboard verification, H-1, and LIVE
  remain independently unverified/gated.
- Unit tests: tests/unit/setup-readiness-report.test.js,
  tests/unit/setup-page.test.js; CI check/unit/db/mock/ci required.
- No migration, Stripe write, credential handling change, webhook receiver,
  money, external project, LIVE, or extra spending.
Drift B: code/test/STATUS/OWNER-INPUTS/OWNER-GUIDE/card aligned.
Next: approved isolated TEST webhook receiver and genuine signed delivery;
never register an endpoint until it is able to receive authenticated requests.
