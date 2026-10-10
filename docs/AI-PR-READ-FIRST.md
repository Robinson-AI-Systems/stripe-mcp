# Read before any PR that touches money, keys, guards, login, passes or the relay

Blocking review input, in the spirit of Appliance Desk's audit note. Write one line per applicable item in the PR
description saying how it is honored.

## Money
1. Every money-moving tool (TOOL-CATALOG `$`) has a money spec that reads the amount from Stripe, a dollar preview, always
   needs `confirm`, and counts against the daily limit. Universal `api_write` treats unknown money-like operations as money.
2. Every Stripe write carries an idempotency key from `src/stripe/client.js`; a retried call cannot charge, refund or pay
   out twice. Tests prove the key is stable across `dryRun`/`confirm` and changes with `requestKey`.
3. Read-back decides `confirmed`; a tool never says "done" from the request alone.

## Secrets
4. No Stripe key, webhook secret, sandbox pass, passphrase, encryption key or GitHub token in code, tests, fixtures,
   logs, change-log rows, tool results or PR text. The key-scan test must stay green.
5. Keys enter only through the setup page; one-time secrets leave only through the one-time page.
6. No live key on a non-production deployment.

## Guards
7. No write bypasses `defineWrite`, the live guard, the app guard, or the profile filter — through any door (MCP,
   `stripe_call`, HTTPS, CLI, relay). The write-contract helper runs through every door that exists.
8. Records a profiled app owns are refused without `outsideApp: true` (refunds excepted and labelled).
9. `read_only` profiles and read-only passes cannot write, even by name.

## Login, passes and relay
10. Lockout after 5 wrong passphrases in 15 minutes; tokens stored hashed; revoked tokens and expired passes refused.
11. Pass defaults stay narrow (test, read-only, 24 h, $0). Widening a default is an owner decision.
12. Relay comments are ciphertext only, deleted after reading, and requests are replay-safe.

## Context
13. New tools keep listing descriptions ≤160 characters and default results ≤8 KB or a handle (budget check green).
