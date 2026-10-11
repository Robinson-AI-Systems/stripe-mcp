# V-4a — Safe HTTPS forwarding and Stripe-compatible signing
Status: MERGED (as-if-merged; exact-head CI/review gate required).
Approved scope: docs/designs/BATCH-V.md §4 V-4. Baseline: main after #66 (9c09a655).
Risk area: outbound webhooks/SSRF and HMAC, **no external requests or new tools in this slice**.
No migration; about 130 production lines, 2–3 files.

## Read only
- docs/SESSION-START.md §§0–6 and AGENTS hard limits
- docs/designs/BATCH-V.md §§0,1,V-4,6
- src/core/crypto.js (existing encrypted secrets)
- src/tools/dev-events.js and src/tools/index.js (later V-4 slices)
- docs/implementation-contracts/DRIFT-PROTOCOL.md A/B

## Drift A
| Assumption | Verified environment | Correction |
| --- | --- | --- |
| Any HTTPS URL is publicly reachable | Hostnames can resolve to loopback, RFC1918, link-local, metadata or rebind | Strict HTTPS hostname validation; resolve and reject if **any** returned address not global; pin verified chosen IP for HTTPS socket |
| fetch rejects redirects automatically | fetch follows redirects unless disabled and often re-resolves DNS | Use native HTTPS request with pinned lookup, no redirect following in V-4c |
| Stripe signature can be based on parsed body | Provider signature covers *raw exact bytes* of timestamp + '.' + payload | Serialize once, HMAC SHA256, send exactly signed bytes, test constructEvent |
| Forwarding to arbitrary port is safe | Untrusted ports can access internal services | Restrict forwarded webhooks to 443 only, no URL credentials or fragment; no IP literals |
| Stripe events from source are arbitrary | LIVE or foreign events are not supported in Batch V | Only account verified Stripe TEST events in later execution card |

## This PR
- Strict forwarded URL parser: HTTPS 443, ordinary DNS hostname, reject localhost/private syntaxes, userinfo/fragment, Unicode controls, nonstandard port, .local/.internal/.test/etc.
- Injectable asynchronous DNS resolver; fail closed for empty/invalid responses and any private/reserved IPv4 or IPv6, including mapped/translation. Return pinned address information; caller must never resolve again.
- Stripe native HMAC signature with second timestamp, bytes preserved. Guarded exact event ID/type/object and TEST flag; payload size bound; no raw secret in results/logs.
- Unit tests DNS, SSRF, signature verification with official Stripe SDK constructEvent, timestamp, body tampering and size guard; no provider writes or secrets.
- V-4b: durable encrypted forwarder registration/list/delete and one-time owner-only setup secret. V-4c: actual HTTPS delivery and bounded replay with original Stripe event retrieval.

## Gate
Full npm run check + unit + mock + db + ci at exact head, code self-review, merge.
No LIVE, money-out, buying plans, key exposure, app-owned changes. No need for owner decision.
