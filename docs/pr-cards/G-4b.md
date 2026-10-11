# G-4b — Privacy-safe native webhook endpoint list/get
Status: MERGED (#104) as-if-merged; CI and self-review mandatory.
Baseline 51854917e649aaf00b39f98d152e65b174315b61; parent G-4 and approved Batch G.
Risk: Stripe endpoint URL paths/query and the one-time signing secret.
No SQL, no mutation, no LIVE, no owner money/security policy change.
## Drift check A
| Assumption | Main/provider fact | Correction |
| --- | --- | --- |
| Webhook URL safe verbatim | Paths/query may contain credentials | Only verified HTTPS origin, never path/query |
| Endpoint secret always absent | Returned only on creation, but fixtures may include it | Strict whitelist projection regardless |
| Event lists always small | enabled_events unbounded | Bounded slice plus count/more flag |
| Endpoint list has paging | Native limit/cursor supported | Bounded 5 per call; readback validated |
## Build packet
Existing: billing-shared guarded/pageResult/paging/local, TEST Stripe client,
registry/profile and native mock harness. Proposed: webhooks-read.js,
unit/webhooks-read.test.js and mock/webhooks-read.test.js.
Input webhook_list limit<=5, starting_after we_, fields/detail -> native
stripe.webhookEndpoints.list. Exact webhook_get endpointId -> retrieve.
Validate we_ object/livemode/status/timestamp/enabled_events; expose only
id/status/createdAt/HTTPS origin/count and bounded event names in full detail.
Exclude raw URL, description, metadata, signing secret, userinfo/port.
Failure fixtures: private secret in URL, provider secret field, invalid IDs,
wrong-mode, malformed list, overlimit, wrong provider identity. No writes.
Run targeted unit and mock, npm run check, npm test, five GitHub exact-head jobs.
Successor G-4c inherits this projection, but mutating enabled_events must
read the complete provider list, preserve unrelated entries and independently
verify exact result. If an existing provider endpoint contains secrets in URLs
do not echo them or use them as previews.
Stripe API: https://docs.stripe.com/api/webhook_endpoints/list
