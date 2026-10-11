# V-4 acceptance — TEST webhook forwarders
Date: 2026-10-11. Implementation complete: PR #67/#68/#69/#70/#71.
Status: AUTOMATED ACCEPTANCE PASS; genuine account/hosted TEST smoke PENDING.

| Approved V-4 condition | Evidence at exact-head green CI | Outcome |
| --- | --- | --- |
| TEST only; direct and wrapped LIVE refused | tests/unit/dev-forwarders.test.js and dev-forward-events.test.js | PASS |
| Real Stripe Event, not fabricated | tests/unit/dev-forwarder-delivery.test.js independent events.retrieve and list comparison | PASS (isolated fake provider) |
| Stripe signature on EXACT HTTPS bytes | tests/unit/dev-forwarder-delivery.test.js Stripe SDK webhooks.constructEvent | PASS |
| Public-only target, DNS rechecked for each send, SNI/TLS pin | tests/unit/dev-forwarder-security.test.js and dev-forwarder-delivery.test.js | PASS (fake DNS/HTTP) |
| No redirects, bound request and response size/timeout | tests/unit/dev-forwarder-delivery.test.js HTTP 301/302/307 refusal | PASS |
| Signing secret AES-GCM encrypted, account-scoped; one-time owner reveal | tests/db/dev-forwarders.test.js, tests/unit/dev-forwarders.test.js, tests/unit/setup-page.test.js | PASS (mock owner page) |
| Soft delete blocks future forwarding | tests/db/dev-forwarders.test.js, tests/db/dev-forwarder-replays.test.js | PASS |
| Durable HTTP outcomes; no false app-delivered confirmation | tests/unit/dev-forward-events.test.js negative HTTP and network uncertainty | PASS |
| Interrupted/retried request cannot silently resend | tests/db/dev-forwarder-replays.test.js and tests/unit/dev-forward-events.test.js | PASS |
| Original real Stripe TEST Event and reachable owned developer HTTPS service end-to-end | Not run: no enrolled account/host available in implementation session | PENDING TEST SMOKE |

Secret rotation policy: no in-place rotation endpoint. Delete the old forwarder and register a new one with
a fresh request key and secret; the old entry is disabled. Never display the secret outside the private
password-verified one-time owner setup page. A lost one-time link requires the owner to delete/recreate.

The code is merged and the automation gates passed; **do not claim a real provider webhook
round-trip succeeded**. TEST-smoke completion will be recorded when owner enrollment exists.
This manual acceptance item does not block independent V-5 TEST-only development.
