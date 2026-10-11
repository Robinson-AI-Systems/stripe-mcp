# G-4 native Events and webhooks — automated acceptance and external TEST gap
Date: 2026-10-11. Status: AUTOMATED ACCEPTANCE PASS by #113 (as-if-merged; exact-head CI pending); **real provider-connected TEST smoke PENDING**.
Current main before this review: ce24deacc97f479efa18e21dcfdb5925ae941374; G-4 parent docs/pr-cards/G-4.md.
Design: docs/designs/BATCH-G.md G-4; drift C review: no missing required native tool by catalog.
| Acceptance | Implemented and automated evidence | External account proof |
| --- | --- | --- |
| TEST event list/get and provider-filtered undelivered | #103 tests/unit/events-read.test.js, tests/mock/events-read.test.js | PENDING |
| Bounded native webhook list/get, URL path and secret redaction | #104 tests/unit/webhooks-read.test.js, tests/mock/webhooks-read.test.js | PENDING |
| Explicit guarded subscription add/remove, preserved unrelated events | #105 tests/unit/webhook-event-writes.test.js, tests/mock/webhook-event-writes.test.js | PENDING |
| Immutable native create retry, no repeat POST on uncertain result | #108 tests/db/webhook-creation.test.js; #109 tests/unit/webhook-create.test.js and tests/mock/webhook-create.test.js | PENDING |
| One-time signing-secret handoff, independent owner password/CSRF | #109 tests/unit/webhook-create.test.js and tests/unit/setup-page.test.js | PENDING |
| Exact TEST webhook update/delete, independent read-back/tombstone | #110 tests/unit/webhook-maintenance.test.js, tests/mock/webhook-maintenance.test.js | PENDING |
| Owner-only account+endpoint encrypted HMAC verify | #111 tests/unit/webhook-signature.test.js and tests/unit/webhook-signature-setup.test.js, CI all five green at 7dbfb6ab6f5596d83481c77bf606411108ab9c98 | PENDING |
| Owner-only rotation/revocation; DB account scoping | #112 tests/db/webhook-signature.test.js and tests/unit/webhook-signature.test.js, CI all five green at db3e30ecd4bc9a41edacd9079b323a4bede15332 | PENDING |
| Guarded writes through same indirect and direct doors; full-profile only where required | tests/unit/registry.test.js, profiles.test.js, webhook-create.test.js, webhook-maintenance.test.js | PENDING |
| Secrets and private event data never returned in MCP results | checked by unit assertions, secret scan and CI check; nothing in event payload projected | PENDING |
All five CI checks green for #111 and #112 at exact heads; earlier merged PRs have their own exact-head gates, not re-characterized as provider proof. No connected account has been enrolled or an owned HTTPS endpoint reached in this session; do NOT claim those conditions pass.

**Drift C:** G-4 code and deterministic acceptance are complete, with the outside-environment smoke checklist kept open in docs/GO-LIVE-CHECKLIST.md. No design scope was silently deleted. G-5 account reads can proceed independently in TEST mode, but any G-5 provider trial or actual settings mutation remains contingent on verified TEST account access and explicit authorization when needed. LIVE mode and independent per-operation money-out authorization (shared $500/account/Colorado-day, extra override above limit) remain unchanged.
**Next:** G-5a native account profile safe projection; G-5b capabilities; then payment methods/Apple Pay settings as allowed by pinned SDK.
