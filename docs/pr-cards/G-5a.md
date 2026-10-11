# G-5a — own-account TEST status and verification read
Status: MERGED (#114 as-if-merged; exact-head CI pending).
Baseline a8283ccf06019ca6f38183b10692a70649b09a80, G-4 automated closure #113.
Approved Batch G G-5. Existing: src/keys.js accounts.retrieve() TEST identity check,
src/tools/billing-shared.js guarded and allProfiles, registry/profile tests.
Proposed: src/tools/account-profile.js (not present before PR).
Drift A: official pinned Stripe SDK account retrieve has no account selector for own key.
Input fields[]/detail -> account_get safe projection. Official SDK accounts.retrieve().
Before: caller connection is selected TEST account, valid acct_ identity; provider id
must match the selected account. LIVE provider resource is refused. Missing requirements
produce not_readable, not false zero counts. Permission refusal returns explicit
unavailable Dashboard guidance, not fabricated status.
Never return address, DOB, tax ID, email, phone, person, account number, webhook
secret, payout destination, provider raw response or unfiltered requirements.
Tests: tests/unit/account-profile.test.js; tests/mock/account-profile.test.js; registry/
profile counts, no-secrets CI, exact-head check, full unit suite and review resolution.
Successor G-5b: capability list per verified own-account ID with Connect-only fallback.
No LIVE, money-out, mutation, provider-connected smoke claim.
