# Design — Batch B: Trust layer (safety, money rules, guards, errors, profiles)

Status: **APPROVED** (Chris, 2026-10-10, IN-00). Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch B.
Cards B-1 … B-8. Depends on Batch A.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| B1 | `src/tools/write.js` (copied in A-1) exports `defineWrite`, `guard`, `gone`, `safetyNote` | `grep -n "^export" src/tools/write.js` |
| B2 | `change_log` has the money columns from Batch A §2 | `grep -n "change_log" src/db.js` |
| B3 | `stripe` errors expose `type`, `code`, `decline_code`, `param`, `requestId` | read `node_modules/stripe/types/Errors.d.ts` (≤150 lines around `StripeError`) |

## 1. Decisions

**B1. Every write tool is built with `defineWrite`** (preview with `dryRun`, confirmation, apply, read-back, verify,
change-log row), extended with:
- `money(args, ctx, before) → { amountCents, currency, direction: 'in'|'out'|'change', description }` for tools marked `$`
  in TOOL-CATALOG. The amount comes from Stripe (`before`), never trusted from arguments: a refund's preview uses the
  charge's refundable remainder; a plan change uses the invoice preview.
- Preview's first line in dollars: `Refund $85.00 USD to Jane Henderson (card ending 4242) from charge ch_… on Sep 28. TEST MODE.`
- `inverse(args, before, after) → { tool, args } | null` stored in the change log (used by Batch X undo).

**B2. Money out always needs `confirm: true`**, in test mode too: refunds, payouts, transfers, credit notes, balance credits,
invoice charge-now, charging a saved method, top-ups.

**B3. Daily money limit** per connection: the sum of confirmed money-out today (Colorado calendar day) from the change log;
a call that would pass `stripe_accounts.money_limit_cents` (default $500, IN-05) is refused with the running total and how
to raise it (`stripe_set_money_limit`).

**B4. Live guard.** On a live connection every `writes: true` tool needs `confirm`, every result carries `"mode": "LIVE"` at
the top, and change-log rows are marked live. `live_enabled` turns on only through `stripe_enable_live` (confirm) **plus** the
passphrase re-entered on the setup page within 10 minutes; a tool alone can never enable live.

**B5. App-owned guard** (`src/tools/app-guard.js`). A Stripe record is app-owned when its metadata (or its customer's) has a
key in `APP_METADATA_KEYS` (read from `known_apps` once Batch P exists — one set per profiled app; until then the Appliance Desk list in
`docs/APP-NEEDS-APPLIANCE-DESK.md` is a constant). The guard reports **which** app owns the record. Writes on an app-owned record return `done: false` with the app record ID, why it would make the app disagree with
Stripe, and the app screen to use instead — unless `outsideApp: true`. **Exception:** refunds go ahead with normal confirm
(the app recognises refunds made in Stripe), and the preview says "The rental app will see this refund and record it."
Reads are never blocked; read results mark app records with `"appRecord": { "agreementId": "…" }`.

**B6. Plain-English errors** (`src/tools/errors.js`, same shape as the Workspace server): what happened, likely cause, what
to do, then one technical line with Stripe's request ID. Rules: card declines by `decline_code`; `permission_error` on a
restricted key (names the permission to tick); test/live mix-up ("a similar object exists in live mode"); revoked or rolled
key; `idempotency_error`; `rate_limit`; `invalid_request_error` with `param`; account not activated (`requirements.currently_due`).

**B7. Result shaping** (`src/tools/util.js` `compact`): `<field>_display` dollars beside every amount (zero-decimal currencies
handled), `<field>_local` America/Denver beside every Unix time, `client_secret`/`secret`/key-shaped strings → `[hidden]`,
LIVE banner.

**B8. Profiles** (`read_only`, `everyday`, `full`) come from each tool's `profiles` metadata; `read_only` lists no write tool
and refuses one called by name. Profile counts print on the home page.

**B9. Writes are declared, not guessed.** Every tool declares `writes: true|false`; `scripts/check-writes.mjs` fails when a
tool lacks the declaration, a `writes: true` tool lacks `dryRun`, or a `$` tool lacks a money spec. (The Workspace server
matched verb names only and missed eleven tools.)

## 2. Schema

None (Batch A tables). `stripe_set_money_limit` updates `stripe_accounts.money_limit_cents`.

## 3. Shared primitives — the write-contract helper (`tests/helpers/write-contract.js`)

`runWriteContract({ tool, args, fixtures, moneyCents?, appOwned?, inverse? })` runs the seven checks every write tool
must pass, through every door that exists at the time (direct handler; `stripe_call` after C-2; HTTPS, CLI and relay
after Batch R):

1. `dryRun: true` → no write call on fake Stripe; a preview change-log row.
2. Without `confirm` (when needed) → nothing changed; plain "ask first" result.
3. With `confirm` → exactly one write call, with an idempotency key; read-back returned; change-log row with the key.
4. Read-back mismatch → `confirmed: false` and a warning.
5. App-owned target → refused without `outsideApp` (refunds: allowed and labelled).
6. Live connection → needs `confirm` even when test mode would not.
7. `$` tools → dollar line; daily limit enforced; amount from Stripe, not arguments.

## 4. Work units

### B-1 — Safety layer with money rules (L, medium effort)
Files: `src/tools/write.js`, `src/money.js` (limit, dollar formatting), `tests/helpers/write-contract.js`.
Tests: the seven checks against a sample `$` tool and a sample non-money tool.

### B-2 — Live guard (S) — may group with B-1
Files: `src/tools/live-guard.js`, `src/tools/index.js`. Tests: check 6; LIVE banner; live-enable needs both steps.

### B-3 — App-owned guard (M)
Files: `src/tools/app-guard.js`. Tests: subscription with `agreementId` refused with the ID; `outsideApp` goes ahead; refund
on an app charge goes ahead with confirm and the label; a customer created by the app makes its subscriptions app-owned.

### B-4 — Plain-English errors (M)
Tests: one per rule using real error shapes (from stripe-mock and Stripe's docs); unknown errors fall back unchanged.

### B-5 — Result shaping (S)
Tests: USD and JPY display; Denver times across a daylight-saving change; secrets hidden; LIVE banner.

### B-6 — Profiles (M)
Tests: read_only lists no write; hidden tool refused by name; counts on the home page.

### B-7 — check-writes and the writes declaration (S)
Done when: `npm run check` fails on each of the three violations (prove once each, then remove).

### B-8 — Server tools (S) — may group with B-6
Tools: `stripe_recent_changes`, `stripe_list_connections`, `stripe_revoke_connection`, `stripe_set_money_limit`,
`stripe_enable_live` / `stripe_disable_live`, `stripe_check_key_permissions`, `stripe_set_default_account`,
`stripe_where_is_setting` (data file `src/data/dashboard-map.js`: setting → dashboard URL + numbered clicks, returned as
structured steps; seeded with every "guided" row of `docs/APP-NEEDS-APPLIANCE-DESK.md`, which are general Stripe settings useful to any project).
Tests: per tool through the write-contract helper; enable-live alone never sets `live_enabled`.

## 5. Stop-and-ask points

1. A money tool whose real amount cannot be read from Stripe before acting: stop that tool; propose an amendment.
2. Any change to the default money limit or to what `read_only` contains (owner defaults).

## 6. Acceptance mapping

| PLAN Batch B line | Evidence |
|---|---|
| Seven write-contract checks exist and run | `tests/unit/write-contract.test.js` |
| Live guard, app guard, errors, shaping, profiles | their unit test files |
| check-writes enforces declarations | B-7 PR evidence |

## Amendments

(Dated entries only.)
