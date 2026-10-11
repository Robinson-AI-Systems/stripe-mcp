# G-3c — Guarded Radar value list / item lifecycle
Status: MERGED (#99), pending exact-head five CI checks.
Baseline inspected #98 head fde7e4195c5d433124c67630335eb49ad0c5ade1; Batch G G-3.
Risk: irreversible fraud control changes and private values. Migration none.
Read only AGENTS, SESSION-START, BATCH-G G-3, radar-reads.js, radar-writes.js,
billing-shared.js, app-guard.js, write.js, RECIPES §§2–3.
## Drift check A
| Assumption | Actual | Correction |
| --- | --- | --- |
| Deleting list is harmless | Stripe deletes all children too | Require verified empty list and independent list_items list check |
| Delete response proves gone | Response receipt may precede durable state | Verify exact resource_missing tombstone; unknown stays unconfirmed |
| Value item content can be echoed | Contains email/card fingerprints/IP | Preview length only; verify hidden actual provider value |
| App-owned list safe to change | Metadata may mark app record | Full app ownership guard, explicit outsideApp only |
## Input -> SDK -> readback
listId/rsl -> radar.valueLists.retrieve; item total_count 0; valueListItems.list empty
-> valueLists.del(id,{},options); own-provider retrieval must be resource_missing.
listId/value -> valueLists.retrieve + type validation
-> valueListItems.create({value_list,value}); retrieve exact rsli_ and private equality.
itemId/rsli -> valueListItems.retrieve + parent valueLists.retrieve
-> valueListItems.del(id,{},opts); independent resource_missing.
Every write uses defineWrite, confirmation, idempotency, profile, audit and app guards.
Provider values never in output/audit; errors fail closed, no inverse.
Fixture suite: preview/confirm, actual writes, stale/owned/uncertain/invalid,
LIVE/refusal, complete mock route and standard CI.
Next G-3d inherits safe Identity projection patterns, never private document bytes.
