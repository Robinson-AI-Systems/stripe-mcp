# R-1 — Owner-created RTC read-only TEST passes (#154)
Status: MERGED as-if; require exact-head CI and self-review.
Design: docs/designs/BATCH-R.md §1 R1, §2 and hub RTC 1 §2.
Drift A: OAuth stores hashed connector-only tokens and one-time owner secret
handoff. No pass issuance/auth existed. Reuse the same oauth_tokens and
owner-only passphrase/CSRF/lockout page, with new safe scope columns.
- Create only short-lived 24h TEST read_only passes, zero money, zero writes,
  120/min stored ceiling. Random 32-byte values; hash only at rest.
- An owner must supply own exact TEST account on protected POST; pass only
  revealed with existing one-time page and never included in HTML summaries,
  AI chat, MCP result, logs or plaintext database.
- Existing owner connection-revoke flow can revoke a pass by generated client ID;
  HTTP auth (next PR) must check active expiry/revocation and enforce rate atomically.
- No LIVE, production, money approval, key expansion, or Stripe mutations.
Tests: unit crypto/one-time/revocation, DB digest/constraints, setup-page owner
auth/CSRF tests, all five CI jobs.
Drift B: schema, status, owner guide, and gate notes updated.
Next: R-2 pass-only HTTPS doors and truthful manifest; hub conformance follows.
