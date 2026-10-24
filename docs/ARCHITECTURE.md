## 2026-10-23 — CAP-1 original subsection source completion candidate

Continuing from merged #286, new offline `src/stripe/operation-evidence.js`
records one GA-pinned typed operation/effect/owner/source/credential/
test/live-acceptance evidence object for **each of 644 Stripe GA method/
path/version operations**. `operation-evidence-report.js` generates
deterministic version/family risk and implementation-gap reports with an
offline validator and negative falsified-provider/permission/effect
fixtures. `npm run check:capabilities` now includes this final
validator; `node scripts/operation-evidence-report.mjs --gaps` shows
first 50 candidate engineering gaps without claiming entitlement.

The original CAP-1 **source inventory** index is written as MERGED
only **if this candidate passes protected exact-head CI and is actually
merged**. All five original acceptance lines are mapped in
`docs/pr-cards/CAP-1.delivery.json`, keeping unknown Stripe
permission/roles/country entitlement, source/test gaps and every
remote/provider acceptance unverified. Old protected provider acceptance
ledger remains separate, not overwritten by a made-up zero.
CAP-2/3 ordinary Full authorization, independent human identity,
Stripe App OAuth, mobile login, optional God Mode and credential
isolation; CAP-4 broader API capability; CAP-5 real provider/mobile
acceptance are still not implemented. No money, LIVE, real OAuth,
producer credentials or customer production data changed.

## 2026-10-23 — provider source correction and stronger handler evidence

Stripe's current [Connect OAuth reference](https://docs.stripe.com/connect/oauth-reference)
says the Connect access token is **deprecated**, recommending requests
through the verified platform's key and the `Stripe-Account` header.
The CAP-1 classifier now documents this distinction, rather than
presenting a Connect token as a replacement account bearer. Context
agreement remains `canExecute:false`. The v1 source inventory now
verifies that every tool name also has an **actual registered handler
function** before it labels a native/universal candidate; missing
handlers fail validation and focused tests. Neither change edits
runtime authorization or grants new Stripe privileges.
Fresh exact-head CI required after these source modifications.

## 2026-10-23 — CAP-1 credential-context safety groundwork (source candidate)

New offline `src/stripe/credential-context.js` differentiates
Stripe account secret, account restricted, Stripe App OAuth, Connect OAuth
and organization secret credentials with reviewed public Stripe sources,
exact account/tenant/mode/context matching and explicit unproven permission
status. The associated reports carry per-operation provider sources and
required header/context differences. A matching type/context is returned
as **context-candidate-only, canExecute:false** and never as permission to
execute. Unit tests reject cross-user, cross-tenant, stale/revoked,
secret-bearing, wrong-mode, arbitrary connected-account and organization
context probes. This does **not** implement real Stripe App login,
human identity enrollment, credential storage, permission escalation or
actual provider approval, and CAP-1 remains IN_PROGRESS.

The native TEST cloud adapter previously returned
`renewal_outcome_unknown_reconnect_required` on a benign whoami;
do not replay an uncertain grant or count a provider PASS. The live
Vercel source still needs a separate next scheduled daily promotion and
authenticated client acceptance. Verification for this branch pending
exact-head CI.

## 2026-10-23 — second CAP-1 source stage (candidate, not provider acceptance)

Captured immutable GA-public Stripe OpenAPI `2026-09-30.endive` from
upstream `stripe/openapi` at commit
`af2d19d63ea42049abecf784482898c654ab42d5`,
official source blob `9da296dc459321ad8cd04c68c41d32af8ca436dd`.
Compact operation snapshot records **644 published GA operations: 612 v1
and 32 v2**, independently SHA-1 blob pinned and validated. Runtime
`src/stripe/unified-source.js` and `src/stripe/unified-capability.js`
compare the SDK v1 catalog/registered tools against this reviewed
non-executable GA source, while keeping unknown provider/entitlement
and credential requirements explicit. `npm run check:capabilities`
validates both inventories offline. No Stripe API calls or credentials
are used and no parity percentage or real acceptance is asserted.
Unpublished/preview operations and reviewed credential matrices remain
original CAP-1 engineering, not complete.

## 2026-10-23 — publisher branding and custom hostname approved (not yet activated)

Owner selected the Robinson AI Systems corporate branding for all Stripe connection,
account-management, God Mode and error screens, using the approved company's actual
R logo and emerald/teal/charcoal design. Proposed standalone service origin is
`https://stripe.robinsonaisystems.com`; MCP endpoint `/api/mcp`, product name
**Stripe by Robinson AI Systems**. See [branding and domain gates](
designs/STRIPE-BRAND-DOMAIN.md). Corporate `robinson-ai-systems/docs/DOMAINS.md`
already lists this host as intended Stripe MCP responsibility; an independent
Vercel lookup found it **not currently attached** to the Stripe project.
Keep current `PUBLIC_BASE_URL` and existing clients intact until DNS, TLS,
OAuth issuer/resource, callback and exact READY release evidence pass.
No new DNS, app publication, LIVE activation or deployment has occurred.

## 2026-10-23 — staged CAP-1 inventory and approved identity architecture (NOT deployed from this PR)

The offline `src/stripe/capability-inventory.js` and
`scripts/capability-report.mjs` produce deterministic source-only
operation/credential gaps from the immutable pinned v1 OpenAPI and actual
native registry. Mapped handlers and universal read candidates are never
treated as provider proof. Registered tool names with no known operation
mapping are displayed explicitly. API-v2/org endpoints remain an
unenumerated, labeled gap requiring continued CAP-1 engineering.

The approved [Stripe connection contract](designs/STRIPE-CONNECTION-GOD-MODE.md)
specifies distinct MCP-client OAuth, authenticated human/tenant membership,
Stripe App account authorization, optional scoped additional credentials,
one-screen mobile consent, account management and additive legacy migration.
**None of those new public identity/Stripe App/God Mode execution routes is
implemented by this inventory work.** The existing owner-only OAuth and
encrypted key setup remain the current runtime behavior, including separate
TEST/LIVE and financial safeguards. Never treat a Stripe account OAuth grant
as proof identifying the human authorizing ChatGPT or Claude.

## 2026-10-21 source: client-owned OAuth disconnect

The native issuer exposes POST /api/oauth/revoke in source and advertises it through issuer
metadata. core/oauth-revocation.js validates the registered client authentication method and
atomically revokes only that client's matching connector row via revokeOAuthToken. It searches
access and refresh hashes, ignores advisory type hints and returns an empty 200 for known,
unknown, foreign or already-revoked values. Expired access can still stop its current refresh.
No provider credential, RTC pass, sibling connection, production setting or grant is changed.
Revocation addresses the current token row; obsolete tokens replaced by rotation are already
invalid and do not locate subsequent descendants. This is not an independently verified live
client disconnect or proof of full multi-user customer enrollment. See STATUS and the A-3 card.

## Native E-4 Tax/Quote, X-1 undo and X-2 smoke architecture — 2026-10-18

PR #276 uses Stripe SDK 23 for selected-account native Tax/Quote operations under original `defineWrite` preview, confirmation, app-ownership, authorized mode and independent readback guards. Each write invocation has its own provider receipt closure, avoiding cross-request resource mixups. Additive `tax_transaction_index` stores only transactions verified and recorded by this connector, never a fabricated global Stripe transaction index. Private Quote PDF download follows the authenticated Stripe files endpoint, never a public link. Tax calculation creates a provider calculation and cannot run in a zero-write audit.

`change_log.inverse` holds only exact source-derived reversible operations. The account/mode SQL claim changes `undone_by` to negative original ID before dispatch, followed by original guarded writer and nested confirmed audit ID linkage; uncertain outcomes remain claimed. Metadata restoration clears newly added keys using Stripe empty values and verifies independent absence. Isolated PostgreSQL concurrency, replay and mode tests are required. `scripts/smoke-readonly.mjs` enumerates all 166 read-labelled tools and confirms TEST identity before calling any; `docs/audits/smoke-2026-10-18.md` has inventory-only gaps rather than actual provider proof.

## E-3 durable metered billing (2026-10-18)

An additive `meter_usage_claims` table in `src/metered/store.js` enforces a permanent `(stripe_account, mode, identifier)` uniqueness key before original Stripe meter event emission. TEST and LIVE claims remain independent provider-mode namespaces on the same Stripe account; even a cross-mode acknowledgement cannot complete the wrong reservation. Uncertain claims never auto-expire or resend after Stripe's 24-hour temporary idempotency window. The acknowledged state verifies the provider SDK ingestion receipt **only**, never final aggregated usage/invoice totals. Actual billing credit creation uses the separately authenticated account-wide money-out approval and atomic reservation. Credit voids consume another exact signed-in owner approval through `money_approvals`, without miscounting voids as dollars paid out. Disposable local PostgreSQL tests enforce races, replays and owner/account isolation. Schema initialization never performs a Stripe provider write.

# ARCHITECTURE — runtime facts, as built

This file describes what **exists**, and is updated in the same PR that ships it (DRIFT-PROTOCOL checklist B). What the
system is designed to become is in `docs/designs/`; do not copy design text here before it is built.

As of 2026-10-11: Hosted `stripe-mcp` Vercel Production and dedicated Neon Launch `stripe_mcp` are provisioned. All 24 current `SCHEMA_TABLES` tables exist, one encrypted Stripe TEST key with verification timestamp is stored, and no LIVE key or LIVE-enabled account exists. Vercel variables are configured and the production build is READY. **External OAuth/custom-MCP provider smoke and owner Dashboard acceptance are not yet verified.** LIVE activation is disabled (IN-06), and every AI-initiated money-out operation needs independent owner consent.

## Infrastructure

| Piece | State |
|---|---|
| GitHub repo `Robinson-AI-Systems/stripe-mcp` | Created 2026-10-10; plan committed |
| GitHub Actions CI | Check + unit + isolated PostgreSQL 17 + stripe-mock v0.202.0; single `ci` gate (A-1, PR #9) |
| Vercel project | `Robinson AI Systems / stripe-mcp`, GitHub-linked from `Robinson-AI-Systems/stripe-mcp` main, Production READY. Vercel Authentication remains enabled. |
| Neon database | Separate Neon Launch `stripe-mcp` project, `stripe_mcp` PostgreSQL 18 in AWS us-east-1; 0.25 CU max / 300s suspend; 24 expected app tables verified. |
| Stripe keys | One owner-enrolled encrypted TEST key with verification timestamp; no LIVE keys or enabled LIVE accounts. External provider smoke remains pending. |

## Environment variables

CI only: `TEST_DATABASE_URL` (must be localhost for DB tests), `BASE_SHA` (docs reconciliation) and `STRIPE_MOCK_EXTERNAL` (CI disposable mock service). Vercel Production-only variables are `DATABASE_URL` (Sensitive, isolated Neon), `ADMIN_PASSPHRASE` (Sensitive, owner entered), `TOKEN_ENCRYPTION_KEY` (Sensitive, owner entered), and `PUBLIC_BASE_URL` (plain, HTTPS production origin). No secret values, raw credentials or key last-four have been retrieved for documentation. Preview credentials and production key must not be combined.

## Database tables

A-2 defined seven tables; B-1 added `money_reservations` and `money_approvals`, and B-2 added `live_enable_intents`. All **24 currently declared tables** are created **only when `initSchema()` is invoked**. In CI, creation is confined to an isolated throwaway localhost PostgreSQL schema. The dedicated Neon `stripe_mcp` production database was initialized via the actual server setup flow; read-only metadata check verified exactly the 24 declared tables (not a claim of provider smoke or production feature acceptance).

| Table | Purpose |
|---|---|
| `stripe_accounts` | Per-account labels, encrypted key slots, live-mode gate and money limit |
| `oauth_clients` | Client registrations |
| `oauth_codes` | Expiring one-time login codes and connection scope |
| `oauth_tokens` | Hashed access/refresh credentials, exact account/mode/profile/listing and a server-generated opaque `result_scope` stable across token refresh |
| `login_attempts` | Auditable sign-in attempts and future lockout |
| `change_log` | Preview/confirm/read-back audit history and future undo links |
| `one_time_secrets` | Only ciphertext, expiry and single-view record |
| `money_reservations` | Durable, per-account aggregate money-out reservation across ALL AI connections, Denver day, idempotency and conservative spend status (B-1) |
| `money_approvals` | Single-use authenticated owner grant per money-out request, with separate above-limit owner override (B-1) |
| `result_store` | C-1 redacted 24-hour JSON read results, indexed by opaque handle and single OAuth-row scope; bounded expiry cleanup |
| `owner_money_decision_intents` | B-8c2 private TEST-only, short-lived exact provider-derived transaction snapshots; consumed with an atomic owner grant and change-log audit; never agent-facing |
| `live_enable_intents` | Expiring, atomic owner live-enable intent, not usable while IN-06 is OFF (B-2) |
| `owner_revoke_intents` | One-time private owner intent bound to a specific Stripe account and AI connection, expiring after ten minutes; consumed with atomic token revocation and audit (B-8b2a) |
| `owner_disable_live_intents` | Ten-minute owner-only emergency LIVE-disable intent, consumed atomically with a one-way account disable and audit; cannot enable LIVE (B-8b2b1) |
| `owner_default_account_intents` | Ten-minute owner-only account-default choice with expected prior default and one-use confirmation; SQL advisory-locked atomic update and audit (B-8b2b2) |
| `owner_money_limit_intents` | Owner-only exact account cap change with old/new cents, 10-minute expiry, row-locked single-use application and audited before/after; no money grant (B-8b2b3) |

Additive indexes support token expiry, lockout, audits, reservations, approvals and live intents. A-5a adds `src/core/crypto.js` AES-256-GCM authenticated encryption (random nonce, additional authenticated context and no plaintext fallback); `src/keys.js` stores and retrieves test-only Stripe keys server-side in encrypted form, and `src/core/one-time-secrets.js` uses atomic database deletion on reveal. A-5b adds the private owner-only `/api/stripe/setup` endpoint with strict origin/CSRF checks, passphrase lockout, account-verification and permission probes; the owner has since enrolled one TEST key, encrypted at rest with a non-null verification timestamp. Read-only `stripe_whoami` and `stripe_list_accounts` are dispatched through the MCP bearer guard. Writes remain denied until Batch B. `TOKEN_ENCRYPTION_KEY` is required only when these functions execute; it is now configured as Sensitive, Production-only in Vercel, with no value disclosed. A-3a added hashed client registration, authorization code consumption, access/refresh rotation, revocation, login lockout and account selection methods. A-3b adds HTTP OAuth endpoints and the connector door; A-5 adds encryption and key handling. Later batches extend schema through their own migrations.

## Endpoints

`/api/stripe/setup` is a dedicated owner-only browser form; raw Stripe keys never enter MCP or tool calls. GET issues a secure 10-minute CSRF cookie; POST requires matching origin, cookie, form token and admin passphrase. One-time secrets appear only after authenticated POST, with an atomic delete. No live credentials are accepted.

A-3b provides `/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/token`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/api/mcp`, `/api` (status). OAuth access credentials expire after one hour; hashed refresh credentials persist until revocation and rotate on use. The MCP bearer token is not used with Stripe.

## Safety (Batch B in progress)

B-1b2 (PR #20) wires the generic `defineWrite` lifecycle to trusted monetary descriptions, integer USD cents, the atomic daily reservation ledger, confirmation, independent read-back and conservative settlement. Its seven-case contract tests use fake provider records and accept each real write tool's handler/fixtures directly. Confirmed Stripe invalid requests, access denials and card declines release rejected money reservations without replay; unknown/network outcomes retain reserved capacity. The schema's state constraint upgrades once, without dropping records. No AI-controlled approval flag is trusted; every money-out requires a separately authenticated database owner grant. LIVE/app-ownership guards were implemented in B-2/B-3; no money write tool is publicly registered.


B-1b1 adds `money_reservations`, an account-row-locked PostgreSQL function `reserve_money_out_guarded`, and the server-only `reserveMoneyOut`, `getMoneyUsage`, `settleMoneyReservation` database methods. Same request key is never reserved twice, concurrent requests cannot jointly overspend the shared Stripe-account daily limit, and uncertain outcomes never silently return capacity. The accounting cap is USD cents and non-USD attempts return `currency_unsupported` (conservative protection until a verified conversion policy exists). Test fixtures use the owner-approved $500 USD per-account default, but **no money write tool is enabled**. B-1b2 owns the actual money spec, daily enforcement integration and IN-05 decision.


B-1a adds `src/core/write.js` and `src/tools/write.js` for an internal-only TEST-mode preview→confirmation→idempotency→read-back lifecycle and `src/db.js.recordChange` for existing `change_log` audit persistence. **No write tool is registered in the MCP yet; all money operations still fail closed.** B-1b owns daily money-out enforcement; B-2/B-3 add live/app ownership guards before any public write tools.

## Stripe API version

`src/stripe/client.js` pins the official Stripe Node SDK (package lock: v23.0.0) to `2026-09-30.endive`. Keys are passed only from the encrypted store (planned A-5) and never held in this repo. Non-production deployments refuse live keys; test-only transport override cannot be selected by a production request. The exact published Stripe v2556 SDK OpenAPI description is vendored in 23 byte-preserving parts under `vendor/stripe-openapi/` due the GitHub write-size limit. `scripts/stripe-openapi.mjs` checks the reconstructed Git blob SHA-1 `509de1b4510d2c03ad8755d06778c1deb5619c7f`, version and path count before using it. `scripts/openapi-find.mjs` provides capped, read-only lookups and prints the SHA-256 on `--verify`; SOURCE.md preserves provenance.


### Money approvals and shared account budget (IN-05, 2026-10-10)

`money_approvals` stores account, idempotency key, tool, safe human description,
provider-derived USD cents, expiry, owner approval timestamp, single-use consumption,
and a separately authorized over-limit flag plus independent `override_approved_at` timestamp. `money_reservations` is serialized
under the Stripe-account row lock. Its daily sum covers all connections of the
same Stripe account; the owner's approval must be valid and is consumed inside
the reservation procedure. No public or agent-side method can approve a request.
Private TEST-only owner approvals are available in code via the protected setup page after #35, with one-use, transaction-identity-bound decisions and separate above-cap consent. No public money-writing tool or live provider operation is enabled.

### B-2b owner LIVE confirmation intent (IN-06 OFF)

`live_enable_intents` stores a random 32-character server-issued identifier,
account ID, expiration (10 minutes) and consumption. Creating a pending intent
**never enables live mode**. The owner setup route displays that account and
requires the existing protected origin/CSRF/passphrase checks plus an explicit
owner LIVE consent. Even then, `LIVE_MODE_OWNER_APPROVED` defaults OFF. Atomic
PostgreSQL consumption enables `stripe_accounts.live_enabled` only when that
additional IN-06 gate is on and the account has an encrypted live credential;
the same SQL statement records the security change in `change_log`. The MCP
dispatcher still exposes only TEST/read-only tools and cannot approve an intent.

### B-3 application-owned Stripe record guard (staged)

Internal `src/tools/app-guard.js` detects the known Appliance Desk metadata keys from `docs/APP-NEEDS-APPLIANCE-DESK.md` on the target or on its customer. If customer ownership is unknown or cannot be read, writes deny rather than treating the target as unaffiliated. App-owned changes require `outsideApp:true` under the ordinary guarded write contract; app-owned refunds have the documented exception and still require individual authenticated owner money approval. Reads can be marked `appRecord`. This protection is internal; no public write handler is registered yet.

### B-4 safely translated Stripe errors (staged)

`src/tools/errors.js` maps recognized Stripe SDK error classes to plain-English diagnostics and corrective actions, retains only sanitized request IDs/fields, and never returns raw provider messages or secrets. It is integrated in the current read-only MCP handler and guarded Stripe write adapter. Unknown errors preserve previous handling; no additional write door is exposed.

### B-5 result shaping (under review)

Read-only MCP results and guarded Stripe write results are postprocessed by a non-mutating, credential-redacting display layer. Original money minor units remain available with additive currency displays, and Unix timestamps get Denver-local companions. No changes to Stripe permissions or account authorization.

### B-6 connection-profile enforcement (in review)

Every profile's tool discovery and direct name-call gate checks the same declared metadata; write tools are withheld from read_only unconditionally. The currently registered tool surface is still read-only while remaining Batch B gates are implemented. Home endpoint lists actual exposed-tool counts.

### B-7 tool safety declarations (staged)

Every registered tool has an explicit writes:boolean declaration. Money-out risk requires an attached provider-derived money spec and a guarded write contract, enforced by the shared CI write checker. The checker does not infer write status from names.

### B-8a account-scoped read tools (in review)

Change summaries and AI connection metadata are scoped to the authenticated Stripe account, without token hashes or raw snapshots; reads are bounded. Account status reports actual shared daily budget usage. Dashboard guidance is informational and does not change settings. No new money or LIVE permission is exposed.

### B-8b1 TEST read-permission checks (in progress)

The server injects a lazy permission probe into the MCP read dispatcher, loading only the selected account's TEST key after a call. It refreshes verified per-account read-permission status and never exposes/decrypts LIVE credentials. Missing keys fail this tool, not the server startup.

### B-8b1 reviewed key rotation and dispatcher boundaries

MCP core takes a generic server-provided services object. The Stripe-only
TEST permission recheck is assembled at the external API boundary, never
accepted as an agent argument. The encrypted TEST-key snapshot is loaded once
for the call; the database persists verified permission results only if the
account's encrypted key still matches that snapshot (compare-and-set).
Rotated keys fail closed. The read tool supports `fields` and
`detail=compact|full`, with no credentials in either presentation.

### B-8b2a private connection removal (pending review)

The private setup page's origin, CSRF, administrator passphrase and login lockout
protect both preview and final confirmation. The first POST creates a time-limited
random intent for one exact Stripe account/client ID and does not revoke anything.
The second independently confirmed POST atomically consumes the intent, revokes
all matching active access/refresh tokens on that account and writes one audit
entry; other accounts and clients are unaffected. This flow does not register
`stripe_revoke_connection` as an AI-callable write tool. Additional owner account
administration and B-8c money approval remain not built.

### B-8b2b1 emergency LIVE access disable (pending #31)

The private owner setup page creates an expiring ten-minute intent only when
the selected account has `live_enabled=true`. A second, independent owner
passphrase + same-origin + CSRF + checkbox confirmation consumes the intent
and atomically flips only that account to `live_enabled=false`, writing one
audit entry. This never accesses a LIVE key, creates an enable intent or
authorizes any money movement. It is a private owner action, not an MCP tool.

### B-8b2b2 default account for new AI connections (in review)

The private owner setup page stages a ten-minute intent bound to an exact
TEST-connected account and the current default account. Independently
authenticated owner confirmation calls a PostgreSQL function holding a
transaction-scoped advisory lock, compares the stored previous default to
the present value, updates all default flags and audits exactly once.
Existing OAuth token scopes and issued connections are unaffected.
The authorization page reads accounts in default-first order.
No public MCP write is enabled, and no money or LIVE policy is changed.

### B-8b2b3 owner-controlled daily cap (in review)

The owner setup page alone can stage and confirm an account-specific USD
daily-money limit change. It shows verified existing limit, requested limit
and current shared usage as dollar amounts. Requests use exact integer cents,
bound to account and expected previous cap; the database function locks the
same `stripe_accounts` row used by B-1 money reservations and atomically
updates the cap, consumes the intent and audits both amounts. The SQL default
remains 50000 cents ($500). This setting **does not** approve a transfer,
refund or payout: each AI money-out still requires an independently
authenticated owner grant and, above the then-applicable cap, a separate
exact-transaction owner override. B-8c's actual browser approval interface
is still not built. Neither MCP nor HTTPS exposes a money-out or cap-write tool.

### B-8c1 provider-target money requests and private review (PR #34)

Additive columns `target` (default empty for legacy/test fixtures) and
`mode` (default TEST) on `money_approvals`. A money-out's trusted server
preparation must include a stable provider target ID. Reusing a request key
with a changed target, tool, amount, description, currency or mode fails
closed; preexisting empty-target rows cannot be owner-approved. The
separately authenticated owner page exposes a bounded TEST-only pending
list via protected POST, exact account-scoped, escaped account/tool/target/
request/amount/expiry fields, actual Colorado-day shared usage and dollar
limit. No payment or owner approval button exists. This stage DOES NOT
expose real Stripe write handlers or grant owner spending authority.

### Batch C — compact search and isolated result handles (#36)

Every OAuth connector gets a server-created `result_scope` on the hashed
token row, stable when the access/refresh hashes rotate but distinct even
across rows sharing an AI client ID. `result_store` keeps *redacted* JSON
in bounded UTF-8 fragments for 24 hours. Retrieval through
`stripe_get_result` requires the same authenticated OAuth row's scope;
expired handles and cross-connection requests are denied.

Catalog listing is available to Claude AI clients; other clients default
to compact. An owner can explicitly choose either mode during authorization,
and `?listing=` overrides **presentation only**, never profile permissions.
`stripe_search_tools`, `stripe_describe_tool`, `stripe_call`, and
`stripe_batch` are server-owned progressive-disclosure tools.
Indirect calls and batches reuse the same dispatcher, with all provider
writes default denied (and read_only always protected); batches refuse
any non-read call. All tool descriptions, schemas, listing sizes and
100-row default output are checked by pinned gpt-tokenizer budgets.

### Batch D-1 — native TEST customer tools (#37)

The server exposes 17 customer operations: eight read-only plus nine guarded
`defineWrite-v1` TEST mutations. The OAuth-selected account's encrypted TEST
key is decrypted only in server memory through `stripeForConnection` and the
pinned official Stripe SDK. Tool arguments cannot supply a key, choose an
unrelated account or activate LIVE.

Customer output is allowlisted, including masked saved-method summaries.
Customer changes require the declared profile, ownership guard, safe preview,
confirmation, idempotency, audit and read-back. Customer credits also require
separately authenticated exact-transaction owner approval and the shared daily
spending cap. `stripe_call` reuses the direct dispatcher; `stripe_batch`
remains read-only. No legacy agent names, aliases or adapters are built.

### Batch D-2 — native TEST payments and refunds

Nineteen payment, charge, refund and setup-intent operations share the
OAuth-selected TEST Stripe client. Ten read tools produce bounded,
allowlisted summaries without payment credentials or client secrets.
Nine mutations use the full `defineWrite-v1` lifecycle, app ownership
guard, explicit confirmation, stable idempotency and provider read-back;
`stripe_call` delegates to the same dispatcher and `stripe_batch`
remains read-only. Outgoing refunds first verify the charge's refundable
USD remainder and require exact independent owner authorization, with a
second override above the shared $500 Colorado-day limit. Incoming
charges/captures are confirmed but do not consume the outgoing limit.
LIVE is OFF and no real provider operation has been executed.

### D-3 — TEST hosted Checkout and customer portal

Seven read tools and nine guarded mutations cover Checkout sessions, payment
links and portal configurations. Customer card/US-bank setup occurs only on
Stripe-hosted pages, never by returning a client secret. Three mandatory
server-configured HTTPS URLs (`STRIPE_CHECKOUT_SUCCESS_URL`,
`STRIPE_CHECKOUT_CANCEL_URL`, `STRIPE_PORTAL_RETURN_URL`)
must share an owner-controlled origin; AI arguments cannot choose redirects.
Missing return URLs fail closed; provider-hosted links are checked against
Stripe-owned domains. All writes require the shared TEST-only contract and
are forbidden from read_only, LIVE and indirect batching.

Stripe's portal sessions have create but no retrieve endpoint: the session
tool validates Stripe's returned identity/hosted URL and independently retrieves
its selected portal configuration rather than inventing a read-back API.
No LIVE activation or real provider operation occurred.

## D-4 subscription operations (PRs #40 and #42, TEST only)

The `billing_*` namespace contains seven safe subscription/item/schedule reads and previews and fourteen guarded `defineWrite-v1` mutations. The seven item and schedule mutations from #42 use the pinned Stripe SDK and Stripe invoice previews, with exact USD cents/proration details, idempotency, immutable approval requests and independent provider read-back. Subscription current periods come exclusively from `items.data[]` rather than removed subscription-level fields. All mutations are TEST-only, deny batch invocation, and preserve read-only profile isolation and app ownership.

Future subscription schedules require verified fixed recurring USD prices and a saved customer payment method. Updates to active schedules preserve the current phase and require the exact next boundary; replacing future phases requires `replaceFuture:true`. The current/next phases and end behavior are independently verified after the provider write. Active schedule cancellation and release verify the linked subscription and its customer/ownership. Cancellation prorations and final-invoice amounts are previewed; any actual credit needs independently authenticated one-use owner approval bound to the underlying subscription plus the shared daily cap. No Stripe account or deployment was changed.


## D-5a TEST invoices and manual drafts (#43)

The invoice read namespace uses the pinned `invoices.list/retrieve/search/createPreview` and `invoicePayments.list` SDK routes with bounded customer/status/search paging, redacted compact invoice and payment projections and no `client_secret`. Five draft changes use real `defineWrite` with TEST-only connection, app ownership check, preview/confirm/idempotency/readback: `invoices.create/update` and `invoiceItems.create/update/delete`. Manual invoices disable auto-advance and exclude pending unrelated line items. The accounting preflight refuses invoices whose USD totals would be affected by automatic tax, discounts, customer credits, subscription lines or missing totals rather than assuming unchanged charges. No finalization, payment, LIVE use or monetary owner consent occurs in these draft-only tools; D-5b/c own those operations.


## D-5b — native TEST invoice lifecycle (PR #45)

Seven invoice lifecycle write handlers use `defineWrite`, official pinned Stripe SDK invoice methods, exact account/customer verification, idempotency, audit, and independent provider retrieval. Deletion requires a definite Stripe 404 `resource_missing`; uncertain outcomes are not reported as confirmed. Finalization uses `auto_advance:false`, and charge-now verifies the saved payment method belongs to the customer and exact provider-derived amount in cents. Its money spec is inbound, never a bypass for owner money-out approval. TEST send produces the `invoice.sent` event without delivering email. All operations are TEST-only and app ownership guarded. No infrastructure/keys created and LIVE OFF.


## D-5c — native TEST credit notes (PR #46)

The `creditnote_*` namespace has three redacted reads, Stripe-driven exact USD preview, and two guarded mutations. Issue calls Stripe `creditNotes.preview` first, checks original invoice, customer, status, paid/unpaid remainder, refund/credit/out-of-band allocations, then derives an outgoing financial obligation for `defineWrite`. A separate authenticated, single-use owner approval of exact target/cents is required for ALL credits; the shared account $500/Denver-day limit and independent over-cap override remain mandatory. Stripe idempotent create/void and independent retrieval decide confirmed. Voiding credit notes that refunded or transferred value is refused. Customer emails disabled via `email_type:none`. App-owned invoices and subscriptions are protected; LIVE remains OFF. This adds no keys, database tables or deployments.


## V-1a — account-scoped, idempotent TEST developer seed tracking (#47)

Two additive Neon/Postgres tables `dev_runs` and `dev_run_objects` persist a unique immutable plan per Stripe account and explicit developer requestKey. Each known TEST product/price/customer create uses an individual deterministic Stripe idempotency key, receives an independent provider retrieval to verify `rtc_run` provenance, then stores the exact object ID and step name before continuing. Duplicate requests reuse completed runs without making provider writes. Incomplete runs older than 12 hours fail closed rather than risking Stripe idempotency-window duplication. No account-global search, generic delete, LIVE API call, real payment, refund or outside-app write is involved. `dev_list_runs` returns only the selected TEST account's run status and counts. V-1b will add the approved full scenarios; V-2 later consumes the recorded IDs for precise cleanup.


## V-1b1 — bounded TEST store and trial fixtures (#48)

The existing account-scoped run tracker records two more types: `payment_intent` and `subscription`, with explicit ID prefixes. The immutable plan builder preserves the original V-1a catalog hash exactly, and binds newer scenario/description selection to the plan hash to prevent switching between equivalent descriptions during a partially completed run. All previously recorded IDs are read from Stripe again and reverified for account-created `rtc_run`, type and relevant price/customer/cents/status. One-time store sales call TEST `paymentIntents.create` with `pm_card_visa`, a provider-verified total and an inbound money preview; no owner money-out authority is used. Trial and canceled-trial subscriptions are free for the trial period, with explicit `invoice_now:false,prorate:false` on native cancellation. No refunds, disputes, ACH debits, money-out, live changes, external URLs or provider secrets are involved.


## V-1b2 — separately owner-approved TEST seed refunds (#49)

A dedicated `dev_seed_refund` operation uses the shared guarded `defineWrite-v1` **money-out** path, never an internal agent permission. Preflight requires a completed, account-scoped `basic-store` run with recorded `pi_` and `cus_` IDs, then independently retrieves the Stripe PaymentIntent and linked `ch_` charge to verify `rtc_run`, successful USD payment, exact customer, full captured amount and unrefunded balance. The one-use owner authorization request binds the charge ID/cents/idempotency key and enforces the shared $500/account/Denver-day cap and separate over-cap grant. Only after a native idempotent TEST `refunds.create` and independent `refunds.retrieve` verifies charge, cents, currency, status and provenance is `refund_N` added to the account-scoped ledger using a completed-run-only SQL path. Failed read-back or ledger storage remains unconfirmed. The base seed verifier permits extra recorded approved refund steps while continuing to require all original seeded objects. No new database table, live mode or keys.


## V-1b3 — asynchronous test fixture status integrity (#50)

The canonical TEST `dev_seed` scenario builder now supports `dispute-trigger` and `ach-awaiting-confirmation`, preserving old named scenario plan identities. Dispute-trigger uses the provider test payment method `pm_card_createDispute` and confirms only that the inbound TEST charge succeeded, not the asynchronously emitted dispute. ACH setup uses `pm_usBankAccount`, US bank account payment_method_types, `confirm:false`, and only accepts read-back statuses requiring confirmation/payment method/action with `amount_received:0`; no settled bank debit is claimed. Both record the exact `pi_` ID and owner-scoped `rtc_run` provenance for future V-1b4 outcomes and V-2 cleanup. No LIVE, refund, money-out or schema changes.

## TEST event forwarder storage (V-4b1)

`dev_forwarders` is an additive account-scoped PostgreSQL table with immutable `stripe_account`/`request_key`, canonical HTTPS target, explicit sorted TEST Event type filter, configuration digest, encrypted `secret_enc` AES-GCM envelope, use timestamps and soft deletion. Public list/get projections intentionally cannot select `secret_enc`; only a private delivery lookup can read it, with the original account and forwarder ID. Deletion disables delivery without erasing audit evidence. No schema operation contacts an external webhook or Stripe account. V-4b2 will wire guarded management and owner-authenticated one-time setup-page reveal; V-4c will wire real signed delivery using the V-4a pinned-public-IP prerequisite.

## G-4e2 TEST webhook signature verifier
Owner setup POST (passphrase, CSRF, exact HTTPS origin) verifies a native TEST Stripe webhook endpoint through the selected account's encrypted TEST key, then encrypts the owner-entered signing secret into additive `webhook_signing_secrets` (account + endpoint primary key, AES-256-GCM AAD). No signing secret enters any MCP result, audit entry, URL or generated output. The full-profile `webhook_check_signature` uses Stripe SDK `webhooks.constructEvent` (300-second tolerance), returns only validated TEST event ID/type and refuses Connect events. Re-enter a replacement secret in the private setup page after a rotation. No LIVE validation.

G-4e2 credential lifecycle: the authenticated private setup page can forget one selected TEST account/endpoint ciphertext. SQL removes only that pair; missing entries return not-found and subsequent signature checking refuses. Reprovision on the same owner-only form rotates the encrypted credential. Removing local verification material does not revoke the external Stripe endpoint; do that separately with guarded `webhook_delete`.

## G-5 native TEST account reads
`account_get` requires selected TEST account identity to match `stripe.accounts.retrieve()`; only readiness booleans, safe country/currency and requirement counts are returned, never full Account objects or private fields. `account_list_capabilities` independently re-verifies the selected native TEST account, then calls the pinned SDK `accounts.listCapabilities(id)` and projects only capability identifier/status and optional requirement **counts**, not requirement strings. Stripe permission/own-account API denial returns `available:false,verification:not_readable`; it is never interpreted as a disabled capability, no enabled ACH claim, or an accomplished Dashboard setting. Both tools are read-only, never activate LIVE or change money.


## Isolated Stripe Sandbox webhook receipt (PR #153)
The only inbound TEST receiver is `/api/stripe/test-webhooks/:account/:endpoint`.
Its Vercel file route disables body parsing and requires fresh exact-byte Stripe
HMAC using the account+endpoint owner-encrypted signing secret. It rejects LIVE,
Connect, non-POST and unauthenticated requests and stores only unique validated
TEST event ID/type/time metadata in `test_webhook_receipts` (no raw payload).
No Stripe endpoint has been registered from this deployment change. A Vercel READY
build or a Stripe webhook listing does not prove Vercel Authentication permits
Stripe ingress, authentic signed delivery, or provider retries. External TEST
acceptance remains gated until a legitimate signed event reaches this route.


## RTC pass issuance boundary (#154)
Only a passphrase/origin/CSRF-protected owner POST issues a random 32-byte
RTC bearer, then deposits it in the existing encrypted one-time reveal store.
The permanent oauth_tokens row contains only a hash and restricted TEST/read_only
scope, 24-hour expiry, zero money and zero write authority. The MCP OAuth
connector continues to query kind='connector' only; passes do not authorize
/api/mcp. The pass-only HTTPS API and shared database rate limiter follow in
R-2; issuing a pass is not itself proof of Toolkit integration.


## RTC HTTPS TEST read-only integration (#155)
Public GET `/api/contract` reports RTC 1 structure with explicit pending full
conformance; `/api/openapi.json` enumerates its limited HTTP interface.
Pass-authenticated GET `/api/whoami`, `/api/tools` and `/api/tools/:name`
plus POST `/api/tools/:name`, `/api/tools/_batch` and GET `/api/results/:handle`
share existing registered MCP dispatch, strictly read_only TEST profile and
per-pass result scope. Legacy MCP handler names are mapped to `stripe_` aliases
only at the HTTP edge. Expiry/revocation/owner-test-key gates precede every read;
`rtc_pass_rates` has atomic per-hash minute buckets, denying requests over 120
by default with HTTP 429. No live/writes/money from these doors. The pinned
hub reference conformance job tests upstream runner behavior, NOT end-to-end
Stripe service conformance; run external full suite/real routes separately.

The pre-existing owner connection-revocation transaction was broadened from
connector-only to selected connector/pass kinds, with single-use owner intent
and audit preserved. Connection listing now displays pass kind/rate only, not
bearer or digest. This is mandatory for real D-4 test cleanup.


## Owner-only TEST webhook receipt lookup (#160)
The setup route's authenticated POST action lookup-test-receipt takes exact
account, endpoint and event IDs after same-origin, CSRF and owner-password checks.
It verifies a connected TEST account with LIVE disabled, then calls the existing
getTestWebhookReceipt scoped indexed query. The browser renders only checked
safe event type and UTC time. No webhook bodies, signatures, keys or new table.
A receipt alone is not independent evidence of external Stripe delivery.
