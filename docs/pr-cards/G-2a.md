# G-2a — TEST dispute list/get and response deadlines
Status: as-if-merged (#90), exact-head CI/self-review pending.
Baseline inspected: 6d5856d3 (#89); approved Batch G-2.

## Build contract
- `dispute_list` and `dispute_get`: read_only/everyday/full, no writes.
- Exact `du_` identifier, TEST mode, Stripe `disputes.list/retrieve`,
  1–100 pagination, exact provider identity and amount/status checks.
- Return only charge, payment intent, amount in minor units, currency, status,
  response deadline localized to America/Denver, days left, evidence boolean
  and submission count. No raw evidence or payment method details.
- Tests: unit and stripe-mock reads; ordinary read_only MCP dispatch; profile
  counts and registry; full five CI checks.
- Owner authentication/money rules unchanged; no evidence writes.

## Drift check
Stripe dispute IDs use `du_`, not `dp_`; all tests and schemas enforce it.
Stripe evidence_details has due_by and submission_count, but provider evidence
contains sensitive customer information. Return neither evidence contents nor raw
payment_method_details. No real Stripe account configured for E2E.
Source: https://docs.stripe.com/api/disputes/object

Next: G-2b secure evidence file transport and safe file metadata.
