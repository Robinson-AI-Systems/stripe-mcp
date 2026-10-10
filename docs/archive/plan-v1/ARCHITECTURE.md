> **RETIRED DOCUMENT — reference only.** First version of this plan (2026-10-10), written in the Google Workspace MCP plan style before it was rebuilt in the Appliance Desk system. Nothing here is a current instruction. Use `AGENTS.md`, `docs/START-HERE.md`, `docs/designs/` and `docs/TOOL-CATALOG.md` instead.

# Architecture

Read this before touching code. It describes what the server is, why, and the
conventions every card must keep. Once code exists, the code is the truth and
this page gets fixed in the same PR that changes it.

## One-paragraph summary

A Node.js (ES modules, Node 20) MCP server. It runs as Vercel serverless
functions under `api/`, keeps all state in a Neon Postgres database, and is
reached by Claude at `https://<host>/api/mcp` with a bearer token the server
itself issued. It holds Stripe keys for one or more Stripe accounts, each in
test mode, live mode, or both (`stripe_accounts`); each Claude connection is
bound at login to one account **in one mode** and one tool **profile**. Tool
calls go to Stripe through one client wrapper that pins the API version, adds
an idempotency key to every write, and retries safely. Every tool that changes
anything goes through the safety layer (preview, confirm, money rules,
read-back, change log), then two guards (live mode, app-owned records).

## What is copied from the Google Workspace MCP

Reuse, do not reinvent. These files are copied from
`Robinson-AI-Systems/google-workspace-mcp` at the commit named in card P0-1,
with Google-specific parts removed. Each copied file keeps a first-line comment
naming its source path and commit.

| Copied from Workspace MCP | Becomes | Changes |
| --- | --- | --- |
| `api/oauth/*`, `api/well-known/*`, `src/oauth/*` | same | Login page dropdown lists Stripe account + mode instead of mailboxes, and adds a profile choice |
| `src/crypto.js` | same | Unchanged |
| `src/once.js` | same | Unchanged |
| `src/changelog.js` | same | Adds `livemode`, `amount_cents`, `currency`, `idempotency_key`, `inverse` |
| `src/tools/write.js` (`defineWrite`, `guard`, `gone`) | same | Adds money rules (below) |
| `src/tools/util.js` (`ok`, `compact`, `mergeNamespaces`) | same | `compact` gains money and date formatting (below) |
| `src/tools/errors.js` | same | Rewritten rules for Stripe errors; same output shape |
| `scripts/check-writes.mjs` | same | Stripe verb list; also fails when a money tool has no `money` spec |
| `test/helpers/fake-db.js`, `test/contract/db-contract.js`, `pg-neon-adapter.js` | same | New tables |
| `.github/workflows/ci.yml` | same | Adds the stripe-mock service (TESTING.md) |
| `api/mcp.js` | same | Builds Stripe client instead of Google clients |

## Request path

```
Claude ──bearer──▶ api/mcp.js
                     │ ensureSchemaReady()      additive CREATE/ALTER IF NOT EXISTS, once per warm instance
                     │ getAccessToken(token)    → oauth_tokens row: stripe_account, mode, profile (revoked tokens refused)
                     │ buildServer(connection)
                     ▼
               ListTools → registry filtered by the connection's profile (and mode: read_only hides every write)
               CallTool  → handler(args, ctx)
                     │ ctx = { stripe, account, mode, livemode, profile, connection, appGuard, moneyLimit }
                     │ stripe = makeStripeClient(account, mode)   key decrypted for this request only
                     ▼
               ok(value) | errorResult(err)    errors.js translates Stripe errors
```

A fresh MCP `Server` and transport per request, exactly as the Workspace
server. A tool hidden by the profile is also refused if called by name.

## Stripe accounts, modes and keys

### The `stripe_accounts` table

One row per Stripe account: `id` (Stripe's `acct_…`), `label`
("Appliance Rentals"), `business_name`, `test_key_enc`, `live_key_enc`,
`test_key_kind`, `live_key_kind` (`restricted` or `secret`), `test_key_last4`,
`live_key_last4`, `live_enabled` (boolean, default false), `money_limit_cents`
(per-connection daily cap, default 50000 = $500), `is_default`, `added_at`,
`key_checked_at`, `key_permissions` (JSON: what the key was found able to do).

A key is only ever stored encrypted (AES-256-GCM, `src/crypto.js`,
`TOKEN_ENCRYPTION_KEY`). **Unlike the Workspace server there is no plain copy
and no fallback**: if the encryption key is missing the server refuses to start
the setup page and every tool says what to fix. This is the Workspace server's
P5-2 goal, done from the start.

### Adding a key: the setup page, never a tool

`api/stripe/setup.js` serves a page behind the same passphrase and lockout as
the connector login. Chris pastes a key there (restricted keys `rk_test_…` /
`rk_live_…` recommended; `sk_…` accepted with a warning). The server:

1. Calls `GET /v1/account` with it to learn the account ID and name, and checks
   the key's mode from its prefix.
2. Probes what a restricted key may do with harmless reads (one per resource
   family) and stores the result in `key_permissions`, so `stripe_whoami` and
   `stripe_check_key_permissions` can say "this key cannot see payouts" before
   a tool fails.
3. Stores the key encrypted. Shows only the last four characters, ever.

There is no MCP tool that accepts a key. A key typed into chat would sit in
the conversation history.

`DEPLOY.md` (card P0-6) contains the exact restricted-key permission lists for
three recommended keys: **Read only**, **Everyday** (customers, payments,
refunds, checkout, subscriptions, invoices, products, prices, webhooks write;
everything else read), **Full**.

### Modes and the live guard

- Each connection is bound to `(account, mode)`. Mode `test` is the default in
  the login dropdown. `live` appears only when `live_enabled` is true for that
  account, which Chris switches on with `stripe_enable_live` (needs
  `confirm: true`, and the passphrase re-entered on the setup page; a tool alone
  cannot turn live on).
- On a live connection: every write requires `confirm: true` (the safety layer
  treats every tool as destructive), every result carries `"mode": "LIVE"` at
  the top, and every change-log row is marked live.
- The Appliance Desk rule "test mode until Chris authorizes live" is therefore
  enforced twice: by the app, and here.

### Profiles (smaller tool menus)

Chosen at login, stored on the token, changeable only by reconnecting:

| Profile | What Claude sees | Typical use |
| --- | --- | --- |
| `read_only` | Every list/get/search tool and the read-only workflows. No writes at all, even if called by name. | Bookkeeping questions, checking on things from the phone. |
| `everyday` (default) | Customers, payments, refunds, checkout, portal, subscriptions, invoices, catalog, workflows, server tools. About 120 tools. | Running the rental business. |
| `full` | Everything, including payouts, Radar, Identity, Connect, account settings. About 270 tools. | Setup and rare admin jobs. |

Fewer tools means Claude picks the right one more often and the connector
loads faster. (This is the Workspace plan's P7-6 and P7-7, built in.)

## The Stripe client (`src/stripe/client.js`)

- Uses the official `stripe` npm library, not hand-written `fetch`. The
  library encodes nested parameters correctly (FINDINGS bug 4 cannot happen),
  retries network failures with the same idempotency key, and has typed errors.
- **Pinned API version**: one constant, `STRIPE_API_VERSION`, set in P0-4 to the
  version the installed library ships with. Every request sends it. Changing it
  is its own card with a changelog review.
- **Idempotency key on every write** (`POST`/`DELETE`):
  `rmcp_<tool>_<sha256(account, mode, tool, canonical args without dryRun/confirm)>_<10-minute bucket>`.
  The same call repeated within ten minutes gets Stripe's original answer back
  instead of a second charge. A tool may take `requestKey` (string) to make the
  key explicit when Chris deliberately wants the same thing twice.
  Stripe remembers keys for about 24 hours; the change log keeps them forever.
- Timeouts: 20 s per call; workflows have a total budget of 50 s and return
  what they have with a note if they run out (Vercel limit).
- `maxNetworkRetries: 2`.
- **Stripe's own API description** for the pinned version is vendored at
  `vendor/stripe-openapi/<version>.json`. The universal `api_*` tools check
  every request against it and refuse anything not in it (TOOL-CATALOG.md).
- Auto-paging helper `listAll(listFn, params, { max })` with a hard cap
  (default 1,000) and a note when the cap was hit. Workflows that compute
  totals use it; plain list tools return one page plus `next` (the
  `starting_after` value).
- The key is decrypted per request, held only in the client object, and never
  attached to anything that is returned or logged.

## Tool registry layers

`src/tools/index.js` builds the registry in five steps:

1. `mergeNamespaces([...modules])` joins every tool module. Duplicate names
   throw at import time.
2. `applyGuards(...)` wraps changing tools with the safety layer (spec tables
   in `src/tools/guards*.js`; new tools use `defineWrite` directly).
3. `applyAppGuard(...)` (`src/tools/app-guard.js`) protects records the
   Appliance Desk app owns (below).
4. `applyLiveGuard(...)` makes every write need `confirm` on live connections.
5. `filterForProfile(registry, profile)` is applied per request in
   `api/mcp.js`, not at import.
6. `applyResultRules(...)` adds `fields`/`detail` to read tools, the size cap
   with result handles, and MCP annotations (CONTEXT-AND-ACCESS.md Part 1).
7. Per request, the listing mode (`catalog` or `compact`) decides what
   `ListTools` returns. `stripe_call` dispatches into the wrapped handlers, so
   it cannot skip a guard.

The HTTPS API (`api/tools/*`), the GitHub relay (`api/relay/github.js`) and
the `rstripe` CLI use this same registry
(CONTEXT-AND-ACCESS.md Part 2). There is one engine and several doors.

Each tool carries metadata used by these layers: `area`, `profiles`
(`['everyday','full']` etc.), `writes` (boolean), `money` (spec or null),
`appTargets` (which argument names hold Stripe IDs the app guard must check).

## Safety layer (every tool that changes things)

Everything the Workspace server's `defineWrite` does (dryRun, confirm,
plan → apply → read-after → verify → change log), plus:

- **Money spec.** A tool that moves money declares
  `money: (args, ctx) => ({ amountCents, currency, direction, description })`
  where `direction` is `in` (charge), `out` (refund, payout, transfer, credit)
  or `change` (plan change: the preview's difference). The plan step must
  compute the real number from Stripe (for example the invoice preview for a
  plan change, the charge's refundable amount for a refund), never trust an
  amount Claude typed without checking it against Stripe.
- **Money preview text.** Every money tool's preview starts with one line in
  dollars: `Refund $85.00 USD to Jane Henderson (card ending 4242) from charge
  ch_… on Sep 28. TEST MODE.`
- **Always confirm money out.** Refunds, payouts, transfers, credit notes,
  balance credits, invoice "pay", and charging a saved card always need
  `confirm: true`, in test mode too.
- **Daily money limit.** The total of confirmed money-out today (Colorado
  calendar day) on this connection is read from the change log. A call that
  would pass `money_limit_cents` is refused with the running total and how to
  raise the limit (`stripe_set_money_limit`, `confirm: true`, setup-page
  passphrase for live).
- **Read-back.** After a change the tool retrieves the object again and
  returns that. `verify` checks the field that matters (refund `status`,
  subscription `cancel_at_period_end`, invoice `status`).
- **Change log row** includes the idempotency key, mode, amount, currency and,
  when one exists, the inverse (see Undo).

`scripts/check-writes.mjs` fails when a tool whose name contains a changing
verb has no `dryRun`, or when a tool in the money list has no `money` spec.
Unlike the Workspace server, the verb list is not the only check: every tool
must declare `writes: true|false`, and a test asserts each `writes: true` tool
has `dryRun` — so a tool named with an unusual verb cannot slip through (the
Workspace server's eleven-tool gap).

## The app-owned guard (`src/tools/app-guard.js`)

The Stripe counterpart of the Workspace server's domain guard.

- **What counts as app-owned:** a customer, subscription, payment intent,
  checkout session, invoice, refund or price whose `metadata` contains any of
  the keys in `APP_METADATA_KEYS` (`agreementId`, `estimateId`, `depositId`,
  `invoiceId`, `refundId`, `creditId`, `rentalLineId`, `customerId`,
  `sessionId`, `rdf_record_id`), or whose customer does. The list lives in one
  file and is the single source of truth; P7-1 checks it against the app's code.
- **What it does:** before a write runs, the plan step retrieves the target
  (it does anyway for the preview). If it is app-owned and the call does not
  say `outsideApp: true`, the tool returns `done: false` with: which app record
  it belongs to (`agreementId …`), why changing it here would make the app's
  records disagree with Stripe, and what to do instead (the screen in the app,
  or run again with `outsideApp: true` after asking Chris).
- **Exceptions, on purpose:** refunds. The app's rules say a refund made
  directly in Stripe settles correctly, so `payment_create_refund` on an
  app-owned charge is allowed with the normal `confirm`, and its preview says
  "The rental app will see this refund and record it."
- Reads are never blocked. Every read result marks app-owned records with
  `"appRecord": { "agreementId": "…" }` so Claude can say so.

## Errors (`src/tools/errors.js`)

Same shape as the Workspace server: what happened, likely cause, what to do,
then "Technical detail" with Stripe's own message and request ID. Rules for:

| Stripe says | Plain English |
| --- | --- |
| `card_error` + `decline_code` | Which decline (insufficient funds, expired, do not honor, etc.), what the customer should do, whether retrying makes sense |
| `permission_error` on a restricted key | "This Stripe key is not allowed to <resource>. Add '<permission name>' to the restricted key in Stripe (Developers → API keys), then run stripe_check_key_permissions." |
| `resource_missing` with "a similar object exists in live/test mode" | "That ID belongs to live mode but this connection is test mode" (or the reverse) and how to switch |
| `authentication_error` / expired key | Key revoked or rolled; add the new one on the setup page |
| `idempotency_error` | The same request key was used for a different request; nothing was done twice |
| `rate_limit` | Wait and retry, with the retry-after |
| `invalid_request_error` with `param` | Which argument was wrong, in words |
| account not activated / `charges_enabled: false` | What Stripe still needs (from `requirements.currently_due`) |

## Results (`src/tools/util.js`)

`compact()` from the Workspace server, plus:

- Every integer field named `amount*`, `*_amount`, `balance`, `unit_amount`
  gets a sibling `<field>_display` ("$85.00 USD"), using the object's currency
  and Stripe's zero-decimal currency list. Cents are kept; nothing is replaced.
- Every Unix timestamp field (`created`, `*_at`, `period_*`, `arrival_date`,
  `due_date`) gets `<field>_local` in `America/Denver` ("Oct 10, 2026, 9:02 AM MDT").
- `client_secret`, `secret`, webhook endpoint `secret` (except once, on
  creation, see P4-5), and any key-like string are replaced with `[hidden]`.
- `object` labels are kept (Stripe IDs alone do not always say what they are).
- `livemode: true` on any object → top-level `"mode": "LIVE"` banner.
- Lists: one page, with `has_more` and `next` explained in words.

## Undo (`stripe_undo_change`)

When a write has a clean opposite, its guard spec declares `inverse(args,
before, after) → { tool, args }` and the change log stores it. Examples:
archive product ↔ unarchive; deactivate payment link ↔ activate; set
`cancel_at_period_end` ↔ clear it; pause ↔ resume; add metadata ↔ restore old
metadata; update a webhook's events ↔ restore the old list. Money movement,
sent invoices, finalized invoices, submitted dispute evidence and deletions
have no inverse and say so. `stripe_undo_change` takes a change-log ID,
previews the inverse, and runs it with `confirm: true`. (The Workspace plan's
P7-5, built in.)

## Database (Neon)

| Table | Purpose |
| --- | --- |
| `stripe_accounts` | Above |
| `oauth_clients`, `oauth_codes`, `oauth_tokens` | As Workspace, with `stripe_account`, `mode`, `profile`, `listing` on codes and tokens; `last_used_at`, `revoked_at`; `kind` (`connector` or `pass`), `expires_at`, `allow_writes`, `money_limit_cents` for sandbox passes |
| `login_attempts` | As Workspace (5 wrong tries in 15 minutes locks the address) |
| `change_log` | As Workspace plus `livemode`, `amount_cents`, `currency`, `direction`, `idempotency_key`, `inverse` JSONB, `undone_by` |
| `brand_kits` | Per-account look for Checkout pages and payment links (colors, font, corners, logo/icon file IDs, wording) |
| `result_store` | Big results kept for 24 hours behind a handle, tied to one connection or pass |
| `known_apps` | Which webhook events and metadata keys each of Chris's apps relies on (seeded with Appliance Desk in P7-1), used by the webhook health and app guard |

Same database rules as the Workspace server: additive only, idempotent
`initSchema`, previews share the production database.

## Environment variables (Vercel)

`DATABASE_URL`, `ADMIN_PASSPHRASE`, `PUBLIC_BASE_URL`, `TOKEN_ENCRYPTION_KEY`
(**required**). Optional: `DEFAULT_TIMEZONE` (default `America/Denver`). No
Stripe keys in environment variables; they live encrypted in the database.
Never print any of these.

## Tool module convention

Same as the Workspace server:

```js
export const tools = [ { name, description, inputSchema, area, profiles, writes, money?, appTargets? }, … ];
export const handlers = { [name]: async (args, ctx) => ok(...) };
```

- Names are `area_verb_object` in snake_case: `customer_list`,
  `payment_create_refund`, `billing_cancel_subscription`. Workflows are
  `workflow_*`. Server-about-itself tools are `stripe_*`.
- Descriptions are written for Claude and for Chris: what it does, what it
  needs, whether it moves money, anything irreversible. Every money tool's
  description starts with `MOVES MONEY:`.
- A new tool that changes things is built with `defineWrite`, never as a bare
  handler.
- No tool ever takes a secret key, card number or bank number as an argument.
  Card and bank details are collected only on Stripe's hosted pages (Checkout
  in setup mode, the Billing Portal, payment links).
