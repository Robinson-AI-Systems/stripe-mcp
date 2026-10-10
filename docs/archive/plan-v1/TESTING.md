> **RETIRED DOCUMENT — reference only.** First version of this plan (2026-10-10), written in the Google Workspace MCP plan style before it was rebuilt in the Appliance Desk system. Nothing here is a current instruction. Use `AGENTS.md`, `docs/START-HERE.md`, `docs/designs/` and `docs/TOOL-CATALOG.md` instead.

# Testing strategy

Same three layers as the Google Workspace MCP, plus one the Workspace server
could not have: Stripe publishes an official fake Stripe (`stripe-mock`) that
answers every API call with a correctly shaped response. Using it proves the
server sends requests Stripe will accept, which unit fakes cannot.

## Four layers

| Layer | Command | Runs | Talks to | Proves |
| --- | --- | --- | --- | --- |
| **Unit** | `npm test` | Every PR | Nothing real: `fake-stripe`, `fake-db` | Logic: preview, confirm, money rules, limits, app guard, live guard, profiles, errors, result shaping, workflows' arithmetic |
| **Database** | `npm run test:db` | Every PR, throwaway Postgres in CI | Real Postgres in its own schema | Schema is additive and idempotent; fake DB behaves like the real one |
| **Mock Stripe** | `npm run test:mock` | Every PR, `stripe/stripe-mock` container in CI | stripe-mock on localhost | Every tool's request is one Stripe accepts (parameter names, nesting, endpoints exist). One test per tool, generated from the registry so a new tool cannot skip it |
| **Smoke** | `scripts/smoke-readonly.mjs` (P8-2) | By hand, once per phase | Chris's real Stripe account, **test mode only** | Read tools work against a real account |

stripe-mock does not keep state (a created customer cannot be fetched back),
so read-back and multi-step logic are proven in the unit layer; stripe-mock
only proves each call is well-formed.

## Budget tests (context and usage)

Part of `npm test`, from CONTEXT-AND-ACCESS.md:

- Listing size per profile and mode, counted with a standard tokenizer:
  compact under 5,000 tokens, `everyday` catalog under 20,000. Printed in CI.
- Every listing description at most 160 characters; every schema under 1,500
  tokens.
- Every read tool called against 100-item fixtures: default response at most
  8 KB, or a handle.
- Annotations match each tool's `writes` and safety marks.

## Door tests

The write-contract helper (below) runs through each door: direct MCP call,
`stripe_call`, `POST /api/tools/{name}`, the `rstripe` CLI against a local
server with fake Stripe, and the GitHub relay with a fake GitHub API. The same seven checks must pass on every door, so a
door can never become a way around a guard.

## Fakes and helpers (`test/helpers/`)

### `fake-stripe.js`

`makeFakeStripe({ livemode = false })` returns `{ stripe, calls, when }`.
`stripe` mirrors the official library's shape (`stripe.customers.create`,
`stripe.invoices.createPreview`, …). Every method records
`{ path, params, options }` (options include the idempotency key) and returns
what `when(path).resolves(value)` / `.rejects(err)` configured.
`stripeError(type, { code, decline_code, param, message })` builds an error
with the same class and fields the official library throws.

```js
const { stripe, calls, when } = makeFakeStripe();
when('charges.retrieve').resolves({ id: 'ch_1', amount: 8500, amount_refunded: 0, currency: 'usd', metadata: {} });
const r = await handlers.payment_create_refund({ charge: 'ch_1', amount: 12000 }, ctxWith(stripe));
expect(r.content[0].text).toMatch(/\$85\.00/);           // preview uses Stripe's number
expect(calls.find(c => c.path === 'refunds.create')).toBeUndefined(); // no confirm, nothing done
```

### Fixtures (`test/fixtures/`)

Realistic objects taken from stripe-mock responses and edited by hand, never
from Chris's real account. Includes app-owned versions (metadata with
`agreementId`) of customer, subscription, charge and invoice, and live-mode
versions.

### Keys in tests

Only obviously fake keys: `rk_test_FAKE…`, `sk_test_FAKE…`. A test scans every
tool result and change-log row the suite produces for anything shaped like a
real key and fails if it finds one (P0-5).

## What every write tool's tests must show

1. `dryRun: true` → nothing called on Stripe except reads; change log has a preview row.
2. Without `confirm` (when needed) → nothing changed; plain "ask first" result.
3. With `confirm` → the write is called once, with an idempotency key; read-back
   result returned; change-log row written with the key.
4. Read-back mismatch → `confirmed: false` and a warning.
5. App-owned target → refused without `outsideApp: true` (except refunds).
6. Live connection → needs `confirm` even if it would not in test mode.
7. For `$` tools → dollar line in preview; daily limit enforced; amount from Stripe.

A shared test helper (`test/helpers/write-contract.js`) runs these seven checks
against any tool given a small spec, so each card adds one line per tool.
