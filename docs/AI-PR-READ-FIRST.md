# Read before any PR that touches money, keys, guards, login or passes

Blocking review input, in the spirit of Appliance Desk's audit note. Write one line per applicable item in the PR
description saying how it is honored.

## Money
1. Every money-moving tool (TOOL-CATALOG `$`) has a provider-derived money spec, a
   dollar preview, explicit confirmation and an independently authenticated, single-use
   owner approval for the exact account, target, amount and operation. A reservation
   consumes the approval and counts against the shared daily account limit. The
   universal `api_write` door must treat unknown money-like operations as money.
1a. IN-05: every AI money-out needs owner-authenticated approval of the exact account, operation, target and Stripe-derived amount. Exceeding $500/account/Denver-day needs a second owner override for the same request. Neither `confirm` nor any AI context flag authorizes a payment. Owner UI is disabled until completed in B-8.
2. Every Stripe write carries an idempotency key from `src/stripe/client.js`; a retried call cannot charge, refund or pay
   out twice. Tests prove the key is stable across `dryRun`/`confirm` and changes with `requestKey`.
3. Read-back decides `confirmed`; a tool never says "done" from the request alone.

## Secrets
4. No Stripe key, webhook secret, pass, passphrase, encryption key or GitHub token in code, tests, fixtures,
   logs, change-log rows, tool results or PR text. The key-scan test must stay green.
5. Keys enter only through the setup page; one-time secrets leave only through the one-time page.
6. No live key on a non-production deployment.

## Guards
7. No write bypasses `defineWrite`, the live guard, the app guard, or the profile filter — through any door (MCP,
   `stripe_call`, HTTPS). The write-contract helper runs through every door that exists.
8. Records a profiled app owns are refused without `outsideApp: true` (refunds excepted and labelled).
9. `read_only` profiles and read-only passes cannot write, even by name.

## Login and passes
10. Lockout after 5 wrong passphrases in 15 minutes; tokens stored hashed; revoked tokens and expired passes refused.
11. Pass defaults stay narrow (test, read-only, 24 h, $0). Widening a default is an owner decision.
12. A token refresh copies every connection setting (account, mode, profile, listing) from the issuing row — never
    defaults. Rate limits live in the database (shared by every serverless instance), never in memory.
13. Contract behavior (RTC 1) unchanged unless the PR moves to a newer contract version; conformance stays green.

## Context
14. New tools keep listing descriptions ≤160 characters and default results ≤8 KB or a handle (budget check green).
