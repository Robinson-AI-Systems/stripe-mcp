# G-4c — Guarded TEST webhook add/remove subscriptions
Status: MERGED (#105) as-if-merged; five exact-head CI checks and self-review required.
Baseline inspected 60877ae0058262c09bbbe7bd48970dc1aca6334c (#104 merged); approved BATCH-G G-4.
Risk: replacing enabled_events may drop unrelated app subscriptions.
No migration, LIVE, extra permission, secret handoff or money movement.
## Drift check A
| Assumption | Verified before coding | Correction |
| --- | --- | --- |
| Update accepts incremental add/remove | Stripe SDK POST replaces enabled_events | Preflight complete list, compute union/difference |
| Existing endpoint can include wildcard | '*' subscribes broadly | Refuse wildcard changes; separate Dashboard flow |
| Provider state cannot change during confirm | No Stripe endpoint CAS | Re-fetch before update; refuse stale plan; readback exact set |
| Endpoint may belong to external app/Connect | API includes application/connect and metadata | Deny application/Connect; app guard for metadata |
| URL safe to audit | Path/query can contain secret | Use endpoint ID and named events only |
## Implementation packet
Existing: webhooks-read.js webhookSafe, billing-shared.js client/writeProfiles/
validateFields, write.js defineWrite, app-guard.js, registry and existing fake DB.
New: src/tools/webhook-event-writes.js, unit/webhook-event-writes.test.js,
mock/webhook-event-writes.test.js. Two independently named write contracts.
Input endpointId we_, distinct 1–8 named events, outsideApp optional;
native retrieve exact TEST webhook; compute sorted union for add, difference
for remove; disallow wildcard and empty subscription result.
No-op duplicate add or missing remove never sends POST. Changed set uses
webhookEndpoints.update(id,{enabled_events:[complete target]}, {idempotencyKey}).
Second pre-write retrieve must match status/URL/app marker and full current
event set. Independent final retrieve must match exact ID, TEST, status,
original URL, and new complete list before success. No raw URL or signing
secret leaves the write handler.
Tests: no-confirm/no-write, add retains unrelated, remove retains unrelated,
no-op, stale provider, ambiguous readback, app owned, Connect/application
denials, LIVE/read_only/indirect, provider native stripe-mock request.
npx vitest run tests/unit/webhook-event-writes.test.js tests/unit/registry.test.js;
npm run test:mock -- tests/mock/webhook-event-writes.test.js;
npm run check; npm test; five exact-head CI jobs.
Next G-4d: create native endpoint and securely store one-time webhook signing
secret in owner-authenticated setup page, never MCP/audit. Follow approved G2.
Stripe docs: https://docs.stripe.com/api/webhook_endpoints/update
