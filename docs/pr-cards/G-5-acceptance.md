# G-5 automated acceptance reconciliation — 2026-10-11 (PR #120)
Native TEST account tools #114–#119: account_get, account_list_capabilities,
account_list_payment_method_settings, account_update_payment_method_settings,
account_list_apple_pay_domains and account_add_apple_pay_domain.
Evidence: unit/stripe-mock tests, registry/profile classification and five exact-head
CI jobs from each predecessor; guarded writes use defineWrite preview/confirm,
idempotency and independent readback, no unauthenticated cross-account write.
Permission-denied own-account endpoints must return unreadable or done:false
guidance, never fake enabled ACH, ready Apple Pay or mutated Dashboard settings.
**External blocker/gap:** no enrolled, independently authenticated own-account
TEST Stripe key or hosted webhook session in this environment; no actual permission
trial, Apple Pay activation or connected TEST-account smoke is claimed.
LIVE remains disabled, no money moved. Independent money-out owner consent,
shared $500/account/Denver-day cap and separate above-limit override unchanged.
G-5 automated scope is complete, but external provider acceptance remains open.
G-6 code may proceed TEST-only; owner-connected validation must be recorded
separately, never checked off based on mocks.
