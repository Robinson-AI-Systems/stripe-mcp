# Owner Setup Page — end-to-end safety, UX and release audit

2026-10-13 audit for the standalone Stripe MCP, source PRs #201–#203. This is a finite functional inventory, **not** a claim that authenticated external Stripe TEST acceptance has passed. All cases route through the same `/api/stripe/setup` owner page.

| Owner operation | Existing authentication / isolation | Expected browser evidence | Source verification / acceptance gate |
| --- | --- | --- | --- |
| Find saved TEST account IDs | Canonical Origin + CSRF + owner passphrase/lockout; TEST-key metadata only | Bounded, escaped account labels/IDs; no secret or LIVE-only account | #202 unit tests; genuine enrolled account must be selected by owner |
| G-4/G-5/G-6 TEST reads | Exact account key from encrypted store, independent Account/Balance TEST identity, original read-only dispatch | Safe per-tool statuses or precise fixed owner-only failure stage, never fabricated readiness | #201 failure stages, #202 visibility; real owner provider read still pending |
| Add/replace restricted TEST key | Owner password/CSRF, independent TEST identity and permission checks, encrypted storage | Explicit enrolled-key success or non-secret refusal | Existing unit tests; owner confirmation required for rotation |
| Webhook signing secret provision | Exact connected TEST account and endpoint, privately supplied secret, encrypted | Verified storage or bounded error | Existing signature-store tests; genuine signed delivery separately pending |
| Webhook secret forget | Owner passphrase and exact endpoint scope | Explicit forgotten/not found | Existing store tests; do not modify without owner intent |
| Signed TEST receipt lookup | Exact test account + endpoint + event with prior signature receipt | Bounded event type/time only; no raw event or implied external delivery proof | Existing receipt tests; actual Stripe-signed external event pending |
| Private CSV report download | Exact validated report account/run; password; no-store; CSV attachment and token expiration | Downloaded bytes or safe unavailable error | Existing unit tests; no data/PII in chat |
| Issue one-hour/24-hour read-only pass | Exact enrolled TEST account, bounded areas, password/CSRF | Only one-time reveal handoff; no bearer in normal response | Existing pass tests; real Hub and revocation pending |
| Reveal one-time pass | Unpredictable 32-char selector + owner passphrase + consume-once | Top-of-page credential only once, no-cache/no-referrer | #202 placement + existing consume-once tests; never share token in chat |
| Revoke AI connection | Two-step DB intent with exact account/client; passphrase and explicit consent | Preview then final confirmation or stale-state rejection | Existing owner revoke tests; no broad revocation |
| Emergency disable LIVE | Two-step DB intent; exact account; explicit owner consent; password | Preview then final account-specific disable (no enabling) | Existing LIVE-disable tests; LIVE remains disabled |
| Activate LIVE | Separate IN-06 owner policy, independently verified LIVE key and one-time intent, password + explicit consent | Final gated outcome; disabled by default | **NOT AUTHORIZED**; never turn on in TEST audit |
| Change default account | Exact eligible TEST account, immutable intent, password + explicit consent | Preview then confirmed or stale/expired | Existing intent tests; existing AI sessions unaffected |
| Change daily money-out limit | Exact TEST account, validated cents, DB intent and usage read | Exact old/new cap + used amount preview; confirmed only after new password and consent | Existing intent/limit tests; per-transaction approval preserved |
| View pending TEST money-out inbox | Enrolled TEST account, bounded rows and USD amounts; no LIVE writes | Safe amount/target and pending status only | Existing owner inbox tests; does not approve |
| Approve/over-limit TEST money request | Exact stored request+intent, 10-minute expiry, independent password, consent & second override above cap | Preview exact amount/target then confirmation, consumes only that intent | Existing money tests, real owner approval still mandatory |
| Schema initialization/availability | Complete additive migration on cold start, shared promise per warm isolate | Owner POST never runs against uninitialized DB; server fails closed on error | #203 concurrency/retry unit tests |

## Cross-cutting source checks

- All HTML owner responses use no-store, HTML entity escaping, nosniff, CSP `frame-ancestors 'none'`, X-Frame-Options DENY and no-referrer. Owner POST requires exact configured HTTPS Origin, double-submit CSRF, private passphrase and timed lockout. GET selectors are constrained before private state lookup.
- Private actions are grouped in native disclosure sections; private pending intent/one-time reveal is placed before general forms. No script, external images, third-party analytics or site-wide provider keys in the DOM.
- No owner privilege, key, account-mapping, billing limit or LIVE state is silently changed by the UX/performance audit.
- Remaining external gates: authenticated connected MCP OAuth + SDK/PKCE/revocation; genuine Stripe TEST provider read; Stripe-signed TEST event and owner-private receipt; Hub direct/relay/Sandbox; owner Dashboard intent. CI and Vercel READY **never** certify these.
- Release policy: Development PRs target main, checked exact-head CI; after one consolidated readiness batch and an explicitly authorized release or the existing checked daily promotion, verify exact live commit and Vercel READY/alias. No one-fix-at-a-time manual deploy.
