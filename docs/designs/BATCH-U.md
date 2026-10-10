# Design — Batch U: Universal tools (every other Stripe operation)

Status: **APPROVED** (Chris, 2026-10-10, IN-00). Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch U.
Card U-1. Depends on Batches B and C (and A-4's vendored OpenAPI file).

Goal (Chris, 2026-10-10): "let my AI agent do literally almost everything for me." Hand-built tools cover the common
jobs comfortably; four universal tools reach every operation in Stripe's API — Terminal, Issuing, Treasury, Financial
Connections, shipping rates, anything Stripe adds — with the same safety rules. In compact mode they cost nothing until
used.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| U1 | `vendor/stripe-openapi/<version>.json` matches `STRIPE_API_VERSION` | `cat vendor/stripe-openapi/SOURCE.md`; compare with `src/stripe/client.js` |
| U2 | The `stripe` library exposes a raw request method (`stripe.rawRequest`) that still sends the pinned version and idempotency key | read `node_modules/stripe/types/index.d.ts` around `rawRequest` |

## 1. Decisions

**U1. Tools:** `api_search(query)` (method, path, one-line summary, and reads / changes / moves money), `api_describe(op)`
(parameters trimmed from Stripe's description), `api_read(op, params)` (GET; Batch C result rules apply),
`api_write(op, params)` (POST/DELETE; `full` profile only; passes need `allow_writes`).

**U2. Only what Stripe describes.** Every request is checked against the vendored description: unknown operation or
parameter → refused in words. No guessing.

**U3. `api_write` always needs `confirm`** (test mode too) and supports `dryRun`; the preview shows the operation in plain
words, the parameters, and the object as it is now when the path has an ID.

**U4. Money detection** (`src/stripe/money-operations.js`): a table of operations that move money (refunds, payouts,
transfers, captures, confirming payments, paying invoices, credit notes, top-ups, Issuing authorizations, Treasury
outbound payments/transfers, …) → dollar preview and daily limit. **Unknown operations whose summary says create, confirm,
capture, pay, send or transfer are treated as money-moving** until added to the table.

**U5. Hand-built tools win.** If a hand-built tool covers the operation, `api_write` refuses and names it, so curated
checks (refundable amount, app guard specifics, read-back verification) are never bypassed.

**U6. Guards apply:** app guard (via the target's metadata when the path has an ID), live guard, change log, idempotency
key, read-back when the response has an `id` (otherwise `confirmed: null`), undo for metadata and active/inactive flags.

## 4. Work units

### U-1 — Universal tools (L, medium effort)
Files: `src/tools/universal.js`, `src/stripe/openapi-index.js`, `src/stripe/money-operations.js`, `src/stripe/hand-built-map.js`.
Tests: unknown operation and unknown parameter refused; no-confirm changes nothing; a refund via `api_write` refused naming
`payment_create_refund`; an unlisted "creates" operation treated as money; money ops count toward the limit; app and live
guards (write-contract via `api_write`); stripe-mock accepts 25 random GET and 10 POST operations; `api_search "terminal
reader"` and `"issuing card"` find the right operations.

## 5. Stop-and-ask points

1. U2 false (no raw request that keeps version and idempotency): stop; amend to use per-resource library methods.

## 6. Acceptance mapping

| PLAN Batch U line | Evidence |
|---|---|
| Every request validated against Stripe's description | `tests/unit/universal.test.js` |
| Safe default for unknown money operations | same |
| Same guards as hand-built tools | write-contract through `api_write` |

## Amendments
