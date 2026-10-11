# G-4a — Safe TEST Event list/get/undelivered
Status: MERGED (#103) as-if-merged; exact-head CI/self-review required.
Baseline 4c6adf987b6ff0b59da58d4693de0ce4501b2c7c. Parent G-4; Batch G section 4, G-3 closed #102.
Risk: Event data.object has version-dependent private customer/payment data.
No migrations, LIVE writes, Stripe account activity, new secrets or money operations.
## Drift checklist A
| Assumption | Observed | Correction |
| --- | --- | --- |
| Event data.object safe in results | Raw PII and payment data | Whitelist event IDs/type/time/source ID only |
| Delivery_success=false proves app failed | Provider endpoint-wide filter | Explain that app processing is not proved |
| Events never expire | Native list limited to about 30 days | No historical completeness claim |
| SDK supports delivery_success | Pinned native endpoint | Mock verifies exact request |
## Code map (existing vs new)
Existing: billing-shared.js client/guarded/paging/pageResult/local;
index.js registry; unit registry/profiles; stripe-mock harness.
New: src/tools/events-read.js; tests/unit/events-read.test.js;
tests/mock/events-read.test.js. No SQL or handmade Stripe HTTP.
Input list: limit at most 25, cursor evt_, type XOR types, createdGte,
fields/detail maps to events.list with native created.gte and
delivery_success:false for undelivered. Exact eventId to events.retrieve.
Never project raw data.object, contact, billing, card, metadata or request.
Fixtures: sensitive sentinel, LIVE mode, wrong ID/type, bad page/filter,
unknown args; mock tests SDK list and retrieve.
Run npx vitest run tests/unit/events-read.test.js tests/unit/registry.test.js
tests/unit/profiles.test.js; npm run test:mock -- tests/mock/events-read.test.js;
npm run check; npm test; five exact-head CI checks and self-review.
G-4b inherits privacy-safe native webhook projections. Signing secret
from future create flows may go only to private owner setup, never MCP.
Reference https://docs.stripe.com/api/events/list
