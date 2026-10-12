# R-4q — K-3 private portable write under original Stripe owner approvals
Status: IMPLEMENTED; exact-head all seven checks and security self-review pending.
Baseline `ac5dafd250c45d59b03715299e6487e8b43ba87b`; SHA-pinned Hub private core from #184.

## Outcome
Rehearse portable `./write` on the original Stripe `src/tools/write.js`
provider/money adapter. Inject only original account binding and stable
`rmcp_` retry prefix. The original Stripe module still owns TEST/LIVE
guard, app-owned rules, provider SDK rejection classifier, durable audit,
preview, independently authenticated transaction-specific money grant,
separate >$500 Colorado-day owner override and settlement uncertainty.
Any money preview without beforeApply/afterApply is refused.

## Acceptance
Run unchanged source generic write and all seven money/non-money write-contract
unit suites under temporarily overlaid private core. Exercise authentic
disposable source PostgreSQL across transaction-specific owner approval,
cross-account denial, Colorado $500 shared account cap, distinct owner override,
separate durable financial reservation, read-back and LIVE refusal. Synthetic
provider only; no actual Stripe transfer/refund. Restore source write in finally.
Preserve all #184–#188 private candidate original-service tests and exact head
CI. An unpublished private library is NOT installed at runtime.
