# G-4 webhook endpoint LIVE authority remediation (cross-cutting original G-4b/c/d2/e1)

<!-- bundle-plan:start -->
```json
{
  "baseRevision":"72eb2149dab8f073b81399fa4f4cc3c0bf07271b",
  "outcome":"Owner-authorized TEST/LIVE Stripe webhook endpoint lifecycle, with independently verified account mode and unchanged one-time signing-secret safety",
  "integrationBoundary":"webhook endpoint list/get/create/subscription add-remove/destination update/delete; original durable creation ledger, MCP/RTC scoped discovery and receipt",
  "workKind":"ENGINEERING",
  "newEngineering":"Correct seven previously TEST-hardcoded original webhook tools as one full coherent provider family; genuine provider APIs, owner mode validation, guarded execution and regression proof",
  "estimatedProductionLines":300,
  "relatedWorkDecision":"Original G-4b, G-4c, G-4d2 and G-4e1 were marked MERGED as TEST-only and cannot be recounted; this is owner-authorized remediation within those original outcomes, not a new roadmap unit.",
  "subsections":[
    {"id":"G-4b","acceptance":["List and retrieve bounded safe webhook metadata for authenticated selected Stripe mode, redact path, secret and metadata, verify exact provider identity and mode"],"remainingEngineering":["LIVE provider account proof","LIVE safe record projection and read/dispatch"]},
    {"id":"G-4c","acceptance":["Exactly add/remove named subscriptions while preserving unrelated subscriptions, guard app ownership, stale concurrent state and provider verified readback"],"remainingEngineering":["selected LIVE handler and provider mode","original write authorization and opposite-mode tests"]},
    {"id":"G-4d2","acceptance":["Create one webhook with safe URL and checked subscriptions, durable single-create intent, one-time owner-only secret handoff and independent verification"],"remainingEngineering":["LIVE provider mode","mode-partitioned durable creation intent","LIVE one-time secret AAD mode"]},
    {"id":"G-4e1","acceptance":["Update only chosen endpoint fields, delete only with independently observed tombstone, app/Connect ownership and stale state protection"],"remainingEngineering":["selected LIVE mode and guard","LIVE provider mode readback, protected idempotency"]}
  ]
}
```
<!-- bundle-plan:end -->

## Acceptance and risk frozen before source edits

- Stripe provider docs confirm GET/POST/DELETE `/v1/webhook_endpoints` and `/:id`, and `enabled_events` updates: https://docs.stripe.com/api/webhook_endpoints/create and https://docs.stripe.com/api/webhook_endpoints/update. A native endpoint must carry explicit mode and account-owned identity.
- Developer agent has no authority to enroll LIVE credentials, activate production, charge money, mutate any real webhook or reveal secrets. A properly delegated end user may; any scope/profile/area/mode denial remains default deny.
- Owner LIVE account must be independently enabled in DB, service in production, current account ID verified via Stripe and LIVE balance; every endpoint returned must have `livemode:true`. TEST remains unchanged and rejects LIVE records. No wildcard or Connect endpoint mutations introduced.
- All five existing native `defineWrite` writers must actually install `authorizeLiveWrite`, retain preview and distinct confirm, idempotent audit, guarded target, stale readback, uncertain outcome, and no automatic retry.
- Native webhook create must partition durable create intents by mode without schema breaking previously issued TEST retries; LIVE signing secret must be one-time encrypted with LIVE AAD, never returned by MCP or logged. A missing secret, missing provider readback, or unknown POST remains non-replayable.
- Unprivileged LIVE read-only or no-write delegated passes cannot call writes via direct MCP/RTC/meta; selected user scope controls discovery. No blanket LIVE grant to unrelated native webhook testing/simulation tools.
- Add synthetic LIVE positive/denial/provider-mode/unknown-outcome tests and retain original TEST tests; real DB-backed creation race/single-use and other finance tests remain mandatory. Run original full exact-head GitHub CI, private-core adopter, manual security review, resolve blocking comments, then merge only if permitted; report deployment/acceptance separately.
