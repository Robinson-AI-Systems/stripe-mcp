# G-3d — Privacy-safe TEST Identity sessions and hosted creation
Status: MERGED (#100), exact-head five CI checks and self-review required.
Baseline inspected main 06715a4f5954bd66a95b6e656c1ecefb4d38edf8; prior G-3c #99 merged.
Risk: sensitive Identity files, ephemeral client_secret and private redirect links.
No migration or owner permission change. No LIVE.
Read only: AGENTS; SESSION-START; BATCH-G G-3; implementation-guides/REMAINING;
identity SDK docs; billing-shared.js; write.js; radar-reads.js; app-guard.js.
## Drift check A
| Assumption | Actual | Correction/test |
| --- | --- | --- |
| Identity sessions safe in raw response | SDK contains client_secret, reports and PII | Safe whitelist projections only |
| Creating session alone proves hosted URL safe | API returns bearer-like hosted link | Validate exact HTTPS verify.stripe.com/start origin and read back |
| Caller may supply redirect to arbitrary site | Risk of phishing open redirect | No caller URL argument; fixed Stripe-hosted verification link |
| Identity reader okay to expose to all | Catalog requires full profile | Full-only reads and write, guarded indirect door |
## Mapping/verification
Reads: GET identity.verificationSessions.list(limit/cursor), retrieve(vs_).
Show id/status/type/createdAt/redactionStatus only, no client_secret.
Create: input type=document|id_number, dryRun/confirm/requestKey.
Preflight provider list in selected TEST account; POST verificationSessions.create({type},
{idempotencyKey}); independent retrieve exact vs_/TEST/type/requires_input and
https://verify.stripe.com/start link; return only verified session ID/hosted URL.
No person data or app-owned record mutation. No inverse. No LIVE, no redirect override.
Behavioral fixtures: read privacy sentinels, preview/confirm, idempotency, wrong URL,
read-only/LIVE/indirect denial, provider mismatch/unknown fields.
Mock: three SDK native request routes; registry/profile budget and five CI gates.
G-3e inherits this strict projection; cancel/redact require distinct irreversible
confirm/read-back and must never expose Identity reports or documents.
