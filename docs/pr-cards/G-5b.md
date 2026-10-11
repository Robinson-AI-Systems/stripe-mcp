# G-5b — own-account TEST capability status list with honest guided fallback
Status: MERGED (#115 as-if-merged; exact-head CI pending).
Baseline main c4e2edd63421901619bfc015a9472a3bcb3fedbc with G-5a #114 merged. Design docs/designs/BATCH-G.md G-5.
Risk: the native Connect capability endpoint may refuse own-account keys;
unreadable must never mean no capabilities or 'disabled ACH'.
Existing: G-5a src/tools/account-profile.js verified own account identity, src/stripe/client.js
pinned official SDK, src/tools/billing-shared.js TEST connection/profile guarding.
Proposed: src/tools/account-capabilities.js (does not exist before this PR).
Drift check A: official Stripe API GET /v1/accounts/:id/capabilities lists
connected-account capabilities; first verify accounts.retrieve() matches the selected
TEST account. A real own-account test trial is PENDING (no enrolled key in this environment).
Args limit/offset and fields/detail are local result-projection only. List API has no
paging parameters; all returned records must be validated before slicing. An unexpected
provider has_more=true causes failure, never an incomplete green status.
Outcome: validated id/status/requested/requirement-count projection; no owners, tax,
company/person addresses, documents, bank, private requirement names, raw provider JSON.
403/404 permission refusal becomes available:false + explicit owner Dashboard guidance,
not a false 'inactive' or 'none' result. 401/network unknown errors are not hidden.
Tests: tests/unit/account-capabilities.test.js, tests/mock/account-capabilities.test.js,
registry/profile/meta counts; exact-head check, unit/mock/db, all review threads.
Next: G-5c TEST owner account payment-method configuration and safe own-account
provider trial; if prohibited, read-backed owner-guided flow, never fake a write.
LIVE disabled, real TEST account smoke pending, independent money-out guard unchanged.
