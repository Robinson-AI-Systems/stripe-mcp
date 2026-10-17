# D-1 selected owner LIVE customer operations — source authority correction

<!-- bundle-plan:start -->
```json
{
  "baseRevision":"4988388c27d59c62a0db4e17f425d1682d8d44fc",
  "workKind":"ENGINEERING",
  "outcome":"Owner-authorized LIVE customer lookups and eight nonmonetary guarded customer lifecycle operations, without converting coding-agent TEST rules into product limits",
  "integrationBoundary":"customers.js eight redacted reads; customer-writes.js eight original non-money read/prepare/apply/readback operations; strict provider account-mode and independent owner LIVE write pass; preserve separate customer balance money approval and original app ownership",
  "estimatedProductionLines":350,
  "newEngineering":"Complete selected LIVE customer and saved-method/tax CRUD with mode and ownership validation, keep provider cost/financial balance change separate, new synthetic denied/positive regression and all required original tests",
  "relatedWorkDecision":"Original D-1 already marked MERGED as TEST. This repairs its incomplete end-user mode capability and does not recount it as a new completed subsection. Customer balance credit is money-out; to preserve original independent money approval it is explicitly NOT included in ordinary LIVE authorization.",
  "subsections":[{"id":"D-1","acceptance":["Eight actual original customer read tools list/get/search/find/masked payment methods/balance history/tax IDs in authenticated TEST or LIVE","Original customer create/update/delete, detach/set default method, add/delete tax IDs and remove discount execute LIVE only with owner-issued pass and original independent provider account, readback, app-ownership and confirmation","Provider customer and payment method/tax resource modes match the selected credential; missing LIVE evidence fails closed","Owner full/everyday grant and delegated read_only/no consent boundaries enforced in native and indirect tool dispatch, with dangerous deletion irreversible warnings","Existing customer balance credit/debit remains separate provider-derived financial/money owner approval implementation gap, no developer TEST $0 cap masquerading as customer denial","Original TEST, synthetic LIVE, real-database money regression, RTC/private core and CI pass"],"remainingEngineering":["Remove only actual developer TEST-only mode guards for eight nonfinancial writes and eight reads","Add real account+LIVE balance provider proof and fresh object mode projection","Protect money-out credit from a blanket LIVE area guard","Complete tests/docs/CI/review/merge"]}
  ]
}
```
<!-- bundle-plan:end -->

## Risks, provider facts and limits

Stripe customers create/update/delete, paymentMethods.detach and customer tax IDs are actual account-scoped APIs. https://docs.stripe.com/api/customers/create ; https://docs.stripe.com/api/payment_methods/detach ; https://docs.stripe.com/api/customer_tax_ids . Selected LIVE environment has real downstream billing and destructive consequences; preview warns and explicit confirm plus original write registry gates are mandatory. Read returns only masked payment data and safe customer metadata, never full card/bank account or tax identification secrets outside authorized customer list scope. The original user money balance credit/debit and ledger path is NOT converted to LIVE here: `customer_add_balance_credit` remains TEST-only and excluded from LIVE discovery until its exact financial authorization is independently fixed and accepted. Its absence is a remaining engineering defect, not a provider prohibition or inheriting the developer's $0 spending rule.

No live Stripe call, no real customer mutation, no production release, no spend/credential elevation. Preserve existing TEST fixtures exactly. Provider customer `livemode` must be affirmative TRUE for LIVE; for TEST reject opposite-mode evidence (older isolated TEST SDK mocks without `livemode` remain accepted only in original TEST). PM and tax IDs verify mode when published, and the verified selected account independently establishes environment. Money direction/cost/unknown outcome and duplicate reconciliation retain original stricter policy. Every separate LIVE operation rechecks account status. Run entire exact-head check/unit/mock/db/RTC/private adopter and review before merge.
