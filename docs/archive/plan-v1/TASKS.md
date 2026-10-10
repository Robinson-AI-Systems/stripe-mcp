> **RETIRED DOCUMENT — reference only.** First version of this plan (2026-10-10), written in the Google Workspace MCP plan style before it was rebuilt in the Appliance Desk system. Nothing here is a current instruction. Use `AGENTS.md`, `docs/START-HERE.md`, `docs/designs/` and `docs/TOOL-CATALOG.md` instead.

# Task cards

Work the cards in order. Prefer one card per PR; cards marked "may group with"
can share one. Every card has acceptance checks; a card is done only when all
of them pass and the ledger at the bottom is updated in the same PR.

Size key: **S** under a day, **M** one to two days, **L** three to five days.
Model key: default Sonnet 5.5; `[H]` = Haiku 4.5 is enough.

"Port" means: take the toolkit's handler for that tool
(`robinsons-toolkit-mcp/handlers/stripe.js`) as the reference for *which*
Stripe call it makes, rewrite it in this repo's conventions with the official
library, and fix anything listed in FINDINGS.md. Never copy the toolkit's
`encode()` or `fetch` wrapper.

---

## Phase 0: Foundation

### P0-1 · Repository, test harness and CI (M)

**Build.**
- New repo `Robinson-AI-Systems/stripe-mcp`, Node 20, ES modules,
  `package.json` with `@modelcontextprotocol/sdk`, `@neondatabase/serverless`,
  `stripe` (latest), dev: `vitest`, `pg`.
- Copy, from the Workspace MCP at its current `main` commit (record the hash
  in the PR): `src/crypto.js`, `src/once.js`, `src/tools/util.js`,
  `src/tools/write.js`, `src/changelog.js`, `test/helpers/fake-db.js`,
  `test/contract/*`, `test/helpers/pg-neon-adapter.js`, `.github/workflows/ci.yml`,
  `vitest*.config.js`. First line of each: `// Copied from google-workspace-mcp <path> @ <commit>`.
- `test/helpers/fake-stripe.js` (TESTING.md).
- CI runs `npm run check`, `npm test`, `npm run test:db` (throwaway Postgres),
  and `npm run test:mock` against the `stripe/stripe-mock` service container.

**Acceptance.**
- All four commands pass locally and in CI. A deliberately failing test turns
  the PR red (prove once, then remove). CI badge in README.

### P0-2 · Database schema (S) may group with P0-3

**Build.** `src/db.js` with every table in ARCHITECTURE.md, additive DDL only,
`initSchema()` idempotent. Fake and real implementations pass the same contract.

**Acceptance.** Contract tests pass against fake and Postgres. Running
`initSchema()` twice changes nothing.

### P0-3 · Connector login with account, mode and profile (M)

**Build.** Port the Workspace server's OAuth 2.1 + PKCE flow and lockout.
The authorize page shows: account dropdown, mode (test always; live only
when `live_enabled`), profile (read_only / everyday / full, default everyday),
passphrase. Codes and tokens store `stripe_account`, `mode`, `profile`.

**Acceptance.**
- Tests: wrong passphrase 5 times in 15 minutes locks the address; live is not
  offered when `live_enabled` is false, and a forged `mode=live` form post is
  refused; refresh only works for the same client; revoked tokens are refused.

### P0-4 · Stripe client wrapper (M)

**Build.** `src/stripe/client.js` exactly as ARCHITECTURE.md "The Stripe client":
official library, pinned `STRIPE_API_VERSION`, idempotency key builder,
`requestKey` override, timeouts, retries, `listAll` with cap, key decrypted per
request.

**Acceptance.**
- Unit: the same args produce the same idempotency key; `dryRun`/`confirm`
  do not change it; a different `requestKey` does; list helpers stop at the cap
  and say so.
- Mock test (stripe-mock): a nested body (`items: [{ price, quantity }]`) is sent
  correctly (FINDINGS bug 4 regression test).
- A grep test proves no file outside `src/stripe/` imports `stripe` directly.

### P0-5 · Encrypted key store and setup page (M)

**Build.** `api/stripe/setup.js` behind passphrase + lockout. Paste a key →
verify with `GET /v1/account` → probe permissions → store encrypted. Server
refuses to run the page if `TOKEN_ENCRYPTION_KEY` is missing. Keys are never
returned, logged or put in the change log.

**Acceptance.**
- Tests with fake keys: stored value is ciphertext; wrong encryption key gives
  a plain error, never a crash and never the key; a test greps every tool
  result and change-log row produced by the whole unit suite for `sk_`/`rk_`
  patterns and fails if any appear.
- `stripe_whoami` (built here) returns account, mode, key kind and last 4.

### P0-6 · DEPLOY.md (S) `[H]`

**Build.** Step-by-step for Chris: Vercel project, Neon database, environment
variables, generating `TOKEN_ENCRYPTION_KEY`, creating the three restricted
keys in Stripe with their exact permission lists, adding them on the setup
page, adding the connector in claude.ai (test first).

**Acceptance.** Chris (or a reviewer pretending to be him) can follow it
without asking a question. No step says "configure appropriately".

---

## Phase 1: Trust layer

### P1-1 · Safety layer with money rules (L)

**Build.** Extend the copied `defineWrite` with the money spec, dollar preview
line, always-confirm for money out, daily money limit, read-back and verify,
change-log fields (ARCHITECTURE.md "Safety layer"). Define the money list:
every tool marked `$` in TOOL-CATALOG.md.

**Acceptance.**
- Tests: a `$` tool without `confirm` changes nothing and returns the dollar
  line; with `dryRun` it changes nothing and logs a preview; a call that would
  pass the daily limit is refused with the running total; the money amount is
  taken from Stripe, not the argument (test passes a wrong amount, preview shows
  the real refundable amount); read-back mismatch sets `confirmed: false` and a
  warning.

### P1-2 · Live guard (S) may group with P1-1

**Acceptance.** On a live connection every `writes: true` tool needs
`confirm`; every result has `"mode": "LIVE"`; change-log rows are marked live.

### P1-3 · App-owned guard (M)

**Build.** `src/tools/app-guard.js` per ARCHITECTURE.md, with the refund
exception and read marking.

**Acceptance.**
- Tests: updating a subscription whose metadata has `agreementId` is refused
  with the agreement ID and the plain explanation; the same with
  `outsideApp: true` goes ahead; a refund on an app-owned charge goes ahead with
  `confirm` and says the app will record it; a customer created by the app
  makes its subscriptions app-owned too.

### P1-4 · Plain-English errors (M)

**Acceptance.** One test per row of the errors table in ARCHITECTURE.md using
real Stripe error shapes (copy them from stripe-mock responses and Stripe's
docs); unknown errors fall back to the raw message, unchanged.

### P1-5 · Result shaping (S)

**Acceptance.** Tests: `_display` dollars for USD and a zero-decimal currency
(JPY); `_local` dates in America/Denver across a daylight-saving change;
`client_secret` and webhook `secret` hidden; LIVE banner.

### P1-6 · Profiles and read-only connections (M)

**Acceptance.** `ListTools` for `read_only` contains no `writes: true` tool;
calling a hidden tool by name is refused with a plain message; counts per
profile printed on the home page.

### P1-7 · check-writes and the writes declaration test (S)

**Acceptance.** `npm run check` fails when a tool lacks `writes`, when a
`writes: true` tool lacks `dryRun`, or when a `$` tool lacks a money spec
(prove each once with a deliberate bad tool, then remove it).

### P1-8 · Change log tools (S) may group with P1-6

**Build.** `stripe_recent_changes`, `stripe_list_connections`,
`stripe_revoke_connection`, `stripe_set_money_limit`,
`stripe_enable_live`/`disable_live` (enable also requires the setup-page
passphrase step), `stripe_where_is_setting`, `stripe_check_key_permissions`,
`stripe_list_accounts`, `stripe_set_default_account`.

**Acceptance.** Tests per tool; `stripe_enable_live` alone never sets
`live_enabled` without the setup-page step.

### P1-9 · Small results: summaries, fields, handles, annotations (M)

**Build.** CONTEXT-AND-ACCESS.md Part 1, "Results" and "Rules every tool
follows": `src/tools/summaries.js` (one mapper per Stripe object type),
`fields` and `detail` on every read tool (added by a registry layer, not by
hand), the 8 KB cap with result handles stored in a new `result_store` table
(24 hours, tied to the connection), `stripe_get_result`, MCP annotations from
each tool's metadata, `outputSchema`/`structuredContent` support for
workflows.

**Acceptance.**
- A test calls every read tool against 100-item fixtures and fails if a default
  response is over 8 KB without a handle.
- `fields` returns only the asked paths; unknown paths are listed in a note,
  not an error.
- A handle from one connection cannot be read by another (test).
- Every tool's annotations match its `writes` and safety marks (test).

### P1-10 · Listing modes: catalog and compact (M) may group with P1-9

**Build.** `stripe_search_tools`, `stripe_describe_tool`, `stripe_call`,
`stripe_batch` (reads only, max 10); compact listing as in
CONTEXT-AND-ACCESS.md; listing mode chosen at login (claude.ai default:
catalog; everything else: compact) and per request by `?listing=` on the URL.
`stripe_call` dispatches through the same wrapped handler, so every guard
applies.

**Acceptance.**
- Tests: `stripe_call` of a write runs the same preview/confirm/app-guard path
  as the direct tool (shared write-contract helper run through both);
  `stripe_call` refuses tools outside the profile; `stripe_batch` refuses writes.
- Token budget test: compact listing under 5,000 tokens, `everyday` catalog
  under 20,000, every listing description ≤ 160 characters, every schema under
  1,500 tokens. The numbers are printed in CI output.

---

## Phase 2: Everyday money

Every card: port or build the tools listed for its area in TOOL-CATALOG.md;
each read tool tested with fake-stripe, each write tool tested for preview,
confirm, read-back and app guard, and each area run once against stripe-mock.

### P2-1 · Customers (M)
Plus: README table mapping every old toolkit Stripe tool name to its new name
(or "removed, because …").

### P2-2 · Payments, charges, refunds, setup intents (M)
**Extra acceptance.** `payment_create_refund` refuses an amount above the
refundable remainder, in words. `payment_charge_saved_method` requires a
description and refuses when the customer has no default payment method.

### P2-3 · Checkout, payment links, portal (M)
**Extra acceptance.** No result contains a `client_secret`; setup links use
Checkout `mode: setup` and offer card and US bank account.

### P2-4 · Subscriptions (L)
**Extra acceptance.** FINDINGS bugs 1, 3 and 5 have regression tests:
`billing_preview_change` calls `create_preview`; periods come from items;
cancel-at-period-end is an update and `billing_undo_cancel` reverses it.

### P2-5 · Subscription schedules (S) may group with P2-4

### P2-6 · Invoices (L)
**Extra acceptance.** `invoice_mark_paid_outside_stripe` uses
`paid_out_of_band` and its description warns that on an app-owned invoice the
app's own "Record payment" screen is the right place (app guard refuses
without `outsideApp`).

---

## Phase 3: Catalog, tax, usage billing

### P3-1 · Products and prices (M)
### P3-2 · Coupons, promotion codes, features, entitlements, tax rates (M)
### P3-3 · Meters, usage, billing alerts, credit grants (M)
**Extra acceptance.** No tool calls the removed usage-records endpoints
(FINDINGS bug 2; a grep test).
### P3-4 · Stripe Tax, credit notes, quotes (M)
### P3-5 · Test clocks (S)
**Extra acceptance.** Every `testclock_*` tool refuses on a live connection.

---

## Phase 4: Money out and risk

### P4-1 · Balance, payouts, payout schedule, top-ups, bank account list (M)
### P4-2 · Reports (S) may group with P4-1
### P4-3 · Disputes and evidence files (M)
**Extra acceptance.** `dispute_submit_evidence` preview shows the exact
evidence fields and files being submitted and the deadline; `file_upload_evidence`
accepts a public URL or a Google Drive link the person has shared, downloads it
server-side with a 10 MB cap, and never puts file bytes in chat.
### P4-4 · Radar and Identity (M)
**First step:** check Stripe's API reference for a Radar rules endpoint. If
none exists, the four rule tools are not built and `stripe_where_is_setting`
covers rules (FINDINGS bug 9). Record the finding in the PR.
### P4-5 · Events, webhooks, signature check (M)
**Extra acceptance.** `webhook_create` shows the signing secret once and never
again (a later `webhook_get` hides it); `webhook_add_events` reads the current
list and adds without removing anything; `event_list_undelivered` uses the
events list's delivery filter.
### P4-6 · Account settings, capabilities, payment method settings, Apple Pay (M)

### P4-7 · Branding and setup (M)

**Build.** The `brand_*` and `setup_*` tools in TOOL-CATALOG.md, a
`brand_kits` table (per account: colors, corners, font, display name, logo and
icon file IDs, button wording, terms text), and every Checkout/payment-link
tool applying the kit unless the call overrides it.

**First step:** in test mode, try updating Chris's own account's
`settings.branding`, `settings.payouts.schedule`, `settings.card_payments` and
`settings.dashboard`. Record in the PR which Stripe accepts. For each one it
refuses, the tool does the parts it can (file upload), gives the exact
dashboard link and clicks, and afterwards reads the account back to confirm.
Never report a setting as changed unless the read-back shows it.

**Acceptance.** Tests: the kit is applied to Checkout sessions and payment
links (request contains `branding_settings`); statement descriptor over 22
characters or with forbidden characters is refused in words; icon that is not
square is refused; the dashboard fallback path returns `done: false` with the
link and does not claim success; stripe-mock accepts every request.

### P4-8 · Universal API tools (L)

**Build.** The four `api_*` tools in TOOL-CATALOG.md. Load Stripe's published
OpenAPI description for the pinned API version (vendored into the repo as
`vendor/stripe-openapi/<version>.json`, updated only with the API version
card), build a small search index of operations, the money-operations table,
the "hand-built tool wins" map, and the safe default for unknown
create/confirm/capture/pay/send/transfer operations.

**Acceptance.**
- Tests: an operation not in Stripe's description is refused; a parameter not
  in it is refused in words; `api_write` without `confirm` changes nothing;
  a refund through `api_write` is refused and names `payment_create_refund`;
  an unlisted operation whose summary says "creates" is treated as money-moving;
  money operations count against the daily limit; app guard and live guard
  apply (write-contract helper run through `api_write`).
- stripe-mock run: 25 randomly chosen GET operations and 10 POST operations
  from the description are accepted.
- `api_search "terminal reader"` and `api_search "issuing card"` return the
  right operations (test).

---

## Phase 5: Workflows in Chris's language

Each workflow card: the tool in TOOL-CATALOG.md, tests with fake-stripe for
the normal case, an empty account, a paged account (more than one page of
results), a mixed-currency account, and running out of time budget (returns
partial results with a note). Answers are written for Chris.

### P5-1 · `workflow_money_snapshot` (M)
**Extra acceptance.** FINDINGS bug 6 regression: MRR test fixture with
quantity 2, a quarterly price, a 20% coupon, a trialing subscription and two
currencies gives the hand-computed numbers in the test.
### P5-2 · `workflow_failed_payments` and `workflow_customer_overview` (M)
### P5-3 · `workflow_refund_customer` (M)
### P5-4 · `workflow_cancel_customer` (M)
### P5-5 · `workflow_change_plan` (S)
### P5-6 · `workflow_dispute_kit` (M)
### P5-7 · `workflow_webhook_health` (M)
**Extra acceptance.** With the Appliance Desk event list from `known_apps`
(P7-1) and an endpoint missing `checkout.session.async_payment_succeeded` and
`…_failed`, the answer names exactly those two, and applying the fix (with
`confirm`) adds them and reads the endpoint back.
### P5-8 · `workflow_go_live_checklist` (L)
**Extra acceptance.** Read-only by default. Copying catalog items to live is a
separate confirmed step that refuses unless the connection is live, and creates
items by lookup key so running it twice creates nothing new.
### P5-9 · `workflow_month_end_close`, `workflow_set_up_catalog`, `workflow_find` (M)
### P5-10 · `workflow_brand_business` (M)
**Extra acceptance.** Run twice with the same inputs changes nothing the
second time; the final answer lists, per item, "done" or "needs you: <link>".

---

## Phase 6: Reach any agent (HTTPS API, CLI, GitHub relay, code mode)

Read CONTEXT-AND-ACCESS.md Part 2 first. Nothing here adds Stripe logic: every
door calls the same registry and guards.

### P6-1 · Sandbox passes (M)

**Build.** `kind = 'pass'` tokens; `stripe_create_sandbox_pass` (confirm;
shown once), the same choices on the setup page; defaults test / read_only /
24 hours / $0 money limit; live + writes requires the setup-page passphrase;
passes in `stripe_list_connections`; revocation.

**Acceptance.** Tests: a pass is never shown twice; an expired pass is refused
with exit-code-friendly error `pass_expired`; a read-only pass cannot write
even through `stripe_call`; a pass's money limit is $0 unless raised.

### P6-2 · Plain HTTPS API and OpenAPI (M)

**Build.** `/api/tools`, `/api/tools/{name}`, `/api/tools/_batch`,
`/api/results/{handle}`, `/api/openapi.json` (generated; meta operations +
workflows only), per-pass rate limit.

**Acceptance.** The write-contract helper passes when driven through HTTP; the
OpenAPI file validates and has no more than 30 operations; a request with a
connector token or no token is refused.

### P6-3 · `rstripe` CLI, code SDK and local MCP proxy (L)

**Build.** `packages/cli` (plain JavaScript, no build step, Node 20+),
installable with `npm install -g github:…#cli-v1`. Every command in the CLI
table; `--out` file mode; exit codes; `rstripe sdk` generates typed functions
per area from `/api/tools`; `rstripe mcp` (stdio, compact listing);
`rstripe skill` prints `packages/cli/SKILL.md`; `rstripe engine` (test keys
only, refuses live keys).

**Acceptance.**
- CLI tests against a locally started server with fake Stripe: every command,
  every exit code, `--out` prints one line and writes the file.
- The generated SDK compiles (`tsc --noEmit`) and a sample script runs.
- `rstripe mcp` passes an MCP client smoke test (list, call a read, call a
  write without confirm → needs confirmation).
- `rstripe engine` refuses a `sk_live_` / `rk_live_` key (test).
- `SKILL.md` is under 600 words and tells an agent: start with whoami, search
  then describe then call, use `fields`, use `--out` and the SDK for anything
  big, never pass a key.

### P6-4 · GitHub relay transport (L)

**Build.** CONTEXT-AND-ACCESS.md "The GitHub relay": private relay repository,
per-pass issue, encrypted request/response comments (key derived from the pass,
never the pass itself), signed webhook endpoint `api/relay/github.js`, CLI
automatic fallback (direct first; relay when blocked; says which once),
deletion after read, hourly cleanup, issue closed on revoke/expiry.

**Acceptance.**
- Tests with a fake GitHub API: a request round-trips; the comment bodies are
  ciphertext; both comments are deleted afterwards; a webhook with a bad
  signature is ignored; a revoked pass's relay request is refused; a retried
  request returns the original result (idempotency key); the write-contract
  helper passes through the relay door.
- A real run from a cloud agent workspace that can only reach GitHub and npm
  (for example a Claude workspace like the one that wrote this plan): `init`
  reports "relay", `whoami` and one read work. Output summary in the PR.

### P6-5 · Agent setup recipes and real runs (M)

**Build.** `docs/AGENT-SETUP.md` with the recipes listed in
CONTEXT-AND-ACCESS.md and the paste-in paragraph; `rstripe init` writes the
skill and AGENTS.md files; `scripts/agent-check.mjs` runs `init`, `whoami`, a
read, and a code-mode script and prints a pass/fail line per step.

**Acceptance.** `agent-check` green in three real places against Chris's
test-mode account: a local machine (direct), a cloud agent workspace (relay),
and one general sandbox such as Vercel Sandbox with an outbound allow-list
(direct; and a `curl https://api.stripe.com` from inside is blocked). Passes
revoked afterwards.

---

## Phase 7: Appliance Desk support

### P7-1 · `known_apps` seed for Appliance Desk (S)
**Build.** Read the appliance-desk repository: the metadata keys it writes and
the webhook events it handles (today: `src/domains/**`, `src/app/api/webhooks/stripe/route.ts`).
Seed `known_apps` with them and make `APP_METADATA_KEYS` read from it.
**Acceptance.** A test lists the keys and events with the appliance-desk file
and line each came from, in the PR body.

### P7-2 · App record links (S)
**Build.** Where a Stripe record carries `agreementId`/`estimateId`/`invoiceId`,
results include the Appliance Desk URL for that record (base URL from
`known_apps`).

### P7-3 · Documentation for the app repo (S) `[H]`
**Build.** A short section for appliance-desk's `docs/ARCHITECTURE.md`, handed
to Chris as a PR text (not committed here): what the Stripe connector will and
will not touch, and that its changes appear in Stripe's own event log so the
app's drift workbench sees them.

---

## Phase 8: Undo and the real-account smoke test

### P8-1 · Undo (M)
**Build.** `inverse` on every guard spec where one exists (list in
ARCHITECTURE.md "Undo"), `stripe_undo_change`.
**Acceptance.** Tests: undo of archive, deactivate, cancel-at-period-end,
pause, metadata change and webhook event change; money movement says it cannot
be undone and suggests the right opposite action (for example a refund).

### P8-2 · Read-only smoke test against Chris's test-mode account (M)
**Build.** `scripts/smoke-readonly.mjs`: every `writes: false` tool with
minimal arguments, on a **test-mode** connection only (refuses live), report
`docs/plan/smoke-report-<date>.md`.
**Acceptance.** Report committed; every failure fixed or listed as a known gap.
(The Workspace server never built this; here it is part of the plan, not an
afterthought.)

---

## Phase 9: Optional

### P9-1 · Connect (L) — only when YardSync or Cortiware needs it
### P9-2 · Toolkit Stripe namespace decision (S)
**Build.** A one-page note for Chris: keep the toolkit's `stripe` namespace for
local development, retire it, or point its compound tools at this server; and
the work each choice needs. Chris decides; the next card does it.

---

## Status ledger

| Card | Status | PR | Notes |
| --- | --- | --- | --- |
| P0-1 | TODO | | |
| P0-2 | TODO | | |
| P0-3 | TODO | | |
| P0-4 | TODO | | |
| P0-5 | TODO | | |
| P0-6 | TODO | | |
| P1-1 | TODO | | |
| P1-2 | TODO | | |
| P1-3 | TODO | | |
| P1-4 | TODO | | |
| P1-5 | TODO | | |
| P1-6 | TODO | | |
| P1-7 | TODO | | |
| P1-8 | TODO | | |
| P1-9 | TODO | | |
| P1-10 | TODO | | |
| P2-1 | TODO | | |
| P2-2 | TODO | | |
| P2-3 | TODO | | |
| P2-4 | TODO | | |
| P2-5 | TODO | | |
| P2-6 | TODO | | |
| P3-1 | TODO | | |
| P3-2 | TODO | | |
| P3-3 | TODO | | |
| P3-4 | TODO | | |
| P3-5 | TODO | | |
| P4-1 | TODO | | |
| P4-2 | TODO | | |
| P4-3 | TODO | | |
| P4-4 | TODO | | |
| P4-5 | TODO | | |
| P4-6 | TODO | | |
| P4-7 | TODO | | |
| P4-8 | TODO | | |
| P5-1 | TODO | | |
| P5-2 | TODO | | |
| P5-3 | TODO | | |
| P5-4 | TODO | | |
| P5-5 | TODO | | |
| P5-6 | TODO | | |
| P5-7 | TODO | | |
| P5-8 | TODO | | |
| P5-9 | TODO | | |
| P5-10 | TODO | | |
| P6-1 | TODO | | |
| P6-2 | TODO | | |
| P6-3 | TODO | | |
| P6-4 | TODO | | |
| P6-5 | TODO | | |
| P7-1 | TODO | | |
| P7-2 | TODO | | |
| P7-3 | TODO | | |
| P8-1 | TODO | | |
| P8-2 | TODO | | |
| P9-1 | TODO | | Optional |
| P9-2 | TODO | | Optional |
