# R-3 real dual HTTP + shared PostgreSQL acceptance — PR #165

Status: MERGED (#165) as-if; all six exact-head checks and self-review required.
Baseline: 257792e80a0151e556476d7d7bb2f0fde81aecb6.
Drift A: #159 tested one authentic HTTP listener, while #158 and existing
DB tests proved atomic rate limiting with two DB handles but no competing
real HTTP request paths. The hub requires shared multi-instance rate state
and revocation; this contract is security critical.
Implementation: CI spins two genuine 127.0.0.1 Node HTTP listeners each
with its own RTC handler and DB adapter, same disposable isolated PostgreSQL
schema and the actual Stripe tools registry. Runtime-only random TEST passes
and fake encrypted key fixture. 150 overlapping HTTP pass-authenticated
requests must produce exactly 120 successful responses and 30 429 responses
with Retry-After; no bypass across listeners. Both listeners execute harmless
real registry metadata then refuse the independently owner-intent-revoked pass.
No provider payment operations, money writes, LIVE or changed protection.
Do not claim this two-listener same-process test as two OS processes,
deployed HTTPS conformance, external Toolkit D-4 three routes or genuine
Stripe TEST webhook delivery.
Drift B: STATUS and this card. The hub's full conformance with separate
processes plus authorized deployed D-4 direct, encrypted relay and Sandbox
must still be verified before RTC is accepted.
