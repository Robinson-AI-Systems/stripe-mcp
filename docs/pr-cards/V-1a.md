# V-1a — durable developer run ledger and TEST catalog starter

Status: **MERGED (#47 as-if-merged; exact-head CI and complete self-review required).**
Parent: `docs/pr-cards/V-1.md`; approved `docs/designs/BATCH-V.md`.

## Drift check

Base current main `4aecc992def423f628089dfac6c5c7ea24e85f81` (credit notes #46 merged). Existing database `src/db.js` `createDb` and additive `initSchema`, pinned Stripe SDK v23, `defineWrite-v1` are authoritative. No legacy aliases or modifying other projects.

## Exact implementation

- Add `dev_runs` and `dev_run_objects` to the additive schema and machine-checked `SCHEMA_TABLES`. Unique (account, requestKey) and unique (run, stepName) guarantee stable plan and non-duplication.
- `dev_seed` currently supports explicit TEST `catalog-starter` size 1..5. Preview precise planned counts and recurring USD prices; explicit confirm, audit, no LIVE. Creates products, recurring prices, synthetic customers, each `rtc_run`-tagged and read back before recording IDs for V-2 cleanup.
- Stable per-step Stripe idempotency keys and 12-hour maximum incomplete-run retry horizon; refuse stale or conflicting plans rather than silently generating new objects.
- `dev_list_runs` supports account-scoped, paged status/counts (safe read-only).
- Unit: seven case actual handler test of multi-step workflow, including preview/no-confirm/idempotency/readback/unsupported metadata/live refusal/account isolation. Disposable PostgreSQL schema/uniqueness tests and pinned SDK stripe-mock.
- No seeded payment, refund, credit, dispute or Connect operation in this safe first slice. Those remain explicitly in V-1b, with independent owner approval where money leaves.
- IN-02/03/04 remain for deployment, IN-06 LIVE OFF. No spending or keys.
