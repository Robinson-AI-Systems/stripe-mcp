# OWNER-SCHEMA-203 — one warm-isolate additive schema initialization

Status: proposed PR #203. Observed: owner setup endpoint calls 26+ additive CREATE/ALTER/index/SQL checks on every GET and POST, even password failures. Vercel Basic and Neon 0.25 CU capped; repeated DDL is an unneeded performance and availability burden.

**Scope:** Lazy, single-flight promise per Node isolate for `db.initSchema()` on owner setup; concurrent POST/GET wait for successful schema initialisation. Failure resets so next request retries, without granting access to an uninitialized DB. New deploy initializes again. No migration, no schema-bypass for fresh isolate; no session/account cache, sensitive data, LIVE or money changes.

**Proof:** unit concurrent 25 calls, sequential warmed requests, failed retry, invalid initializer; original exact-head seven checks, merge review, final-main checks. Finish grouped owner setup audit report `docs/acceptance/OWNER-SETUP-AUDIT.md`. No direct live release; owner TEST rerun on checked consolidated revision remains pending.
