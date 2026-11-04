# Completion schedule — Stripe Unleashed by Robinson AI Systems

**Reconciled:** 2026-11-03 (baseline corrected 2026-11-04, fleet audit)
**Code baseline:** `main` at `0c34fbe5475f9006023d9066a6e79f5ed5a46d7e`
**Release baseline:** `live` at `c95f9cf0160f85f59789a11d1885e422ec84770b`
`main` is three commits ahead of `live`: PR #303 (owner-obedience V1,
source), PR #304 (owner-obedience V2 shared machinery, source), and
PR #305 (owner-obedience V4, source). None of the three is deployed;
every live proof in this schedule is still measured at `c95f9cf0`.
**Product verdict:** **not finished yet.** Stripe Unleashed by Robinson AI
Systems is a deployed, TEST-oriented service with a large merged source
roadmap and one important live connection proof. It is not yet the finished
standalone product defined by the CAP program, the protected provider
acceptance queue, the RAS MCP Standard conformance record, the branded-domain
contract, and the production-readiness gate.

This file is the single current completion schedule. It reconciles the
historical ledgers without deleting them. When a short summary elsewhere in
the repository conflicts with this schedule about *what remains*, this file
wins until a newer dated completion reconciliation replaces it. The original
cards, queue rows, and evidence records remain the authority for their own
detailed criteria and history.

## How completion is counted

“Finished” is not one state. A requirement can be at a different point in
each of these ledgers:

1. **Source** — designed, implemented, tested in the repository, and merged.
2. **Deployed** — included in the checked `live` release and present in the
   READY Vercel production deployment.
3. **Verified live** — actually exercised against that deployed release.
4. **Provider accepted** — a real Stripe TEST account/provider workflow
   produced the required result or denial and an independent read-back.
5. **Production ready** — the RAS MCP Standard readiness gate has passed
   with evidence and any degraded check declared degraded.
6. **Owner authorized** — Chris has separately authorized the relevant
   public launch, charging, domain/identity cutover, or per-account LIVE
   activation.

The **finished standalone product** means the CAP units, the Stripe-owned
protected acceptance queue, the applicable conformance rows, the branded
identity/front-door work, and the production-readiness gate are complete.
It does **not** require LIVE mode to be switched on for any particular
Stripe account. Public launch beyond beta, charging for this product, and
per-account LIVE use remain separate owner-authorized states with their own
gates in [GO-LIVE-CHECKLIST](GO-LIVE-CHECKLIST.md).

## Verified baseline at the reconciliation

These facts were checked directly against the repository, the local
registry, Git refs, Vercel Unleashed by Robinson AI Systems, and the serving
service on 2026-11-03:

| Fact | Checked state |
|---|---|
| Repository | `Robinson-AI-Systems/stripe-mcp`; `live` at `c95f9cf0160f85f59789a11d1885e422ec84770b`; `main` three commits ahead at `0c34fbe5475f9006023d9066a6e79f5ed5a46d7e` (PRs #303, #304, #305 — owner-obedience V1, V2 shared machinery, and V4, all source-only). |
| Hosting | Vercel project `stripe-mcp`; production branch is `live`; the latest production deployment is READY at `c95f9cf0`. Only the `live` branch is deployment-enabled in `vercel.json`. |
| Package/runtime | `@robinson-ai-systems/stripe-mcp` version `0.1.0`; ECMAScript modules; Node engine `>=20` (the Vercel project is configured for Node 24.x); runtime dependencies are the MCP SDK `1.32.1`, Neon serverless `1.0.2`, and Stripe `23.0.0`. |
| Tool registry | **343 tools** in the source registry at `main`: 174 read-labelled tools and 169 write tools; 339 hand-built tools plus the four `api_*` tools. (Fleet-audit census 2026-11-04 at `main` `0c34fbe5`: the exact expected-name list in `tests/unit/registry.test.js` enumerated 322 unique names and asserted 155 writes; CAP-4 Connect slice 1 then added the seven `connect_*` read registrations, slice 2 the eleven lifecycle writes and slice 3 the three terminal writes, and the list now enumerates 343. The deployed health/front-door readouts still name 322 tools at `c95f9cf0` until a checked release carries the new registrations.) Read-only profile counts are read-only 162 / everyday 163 / full 174. Full visibility counts are 162 / 255 / 343. |
| Stripe API inventory source | Vendored Stripe OpenAPI tag `v2556`, API version `2026-09-30.endive`, 398 paths; `node scripts/openapi-find.mjs --verify` passes. |
| Serving alias | `https://stripe-mcp-psi.vercel.app` serves the application. `/api` and `/api/health` name commit `c95f9cf0`, version `0.1.0+c95f9cf0160f`, 322 tools, status healthy/`online`, and database check `true`. `/api/contract` names the same revision and advertises `/api/health`. |
| Configured issuer origin | OAuth metadata fetched from the serving alias names `https://stripe-mcp-chris-projects-de6cd1bf.vercel.app` as issuer and resource. That hostname does **not** serve the application to an unauthenticated visitor; Vercel Authentication intercepts it. |
| Branded origin | `https://stripe.robinsonaisystems.com` does not serve this deployment yet; checked paths return Vercel `DEPLOYMENT_NOT_FOUND`. |
| Root route | `/` on the serving alias returns 404. The implemented public status surface is `/api`, not `/`. This literal route difference is recorded under conformance row 8 below. |
| Production environment names | The production project has `ADMIN_PASSPHRASE`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`, and `PUBLIC_BASE_URL` configured. Values were not read or recorded. |

The audit method was two independent cartographer maps (structural and
semantic) reconciled by the coordinator, followed by direct checks of the
load-bearing code, registry, Git, Vercel, and live surfaces. No five-replica
Critic panel ran for this completion reconciliation. It is therefore a
survey-and-reconciliation record, not a full Tier 2 Critic pass, and it does
not close any product requirement by itself.

## Scoreboard

| Ledger | Reconciled state | What it does—and does not—prove |
|---|---|---|
| Original roadmap source | **57 of 57 subsections merged.** | Source implementation exists. It does not prove deployed provider acceptance or finished-product status. |
| Work index | **59 of 63 units `MERGED`**; CAP-2, CAP-3 and CAP-4 `IN_PROGRESS`; CAP-5 `APPROVED`. | CAP-1 is merged only in the source-inventory sense defined below. CAP-4's first just-in-time family cards (D-3, D-1, D-2, Connect slice 1, D-4, D-5, D-6, D-7, D-11, D-12, D-8 §A, D-8 §B, and D7b) are written and source-implemented; CAP-5's card file is intentionally absent until that unit starts. |
| Protected provider acceptance queue | **13 PASSED / 30 PENDING of 43.** Of the pending rows, **29 are Stripe-owned** and **1 is Hub-owned optional**. | The 29 Stripe-owned rows include the `STRIPE-TEST` aggregate, so the count is a ledger count, not 29 unrelated features. The Hub row is not a standalone-product gate. |
| Session planner view | `scripts/session-status.mjs` reports 42 waiting/verification tasks plus the Hub-owned optional task. | This overlaps the queue above: it treats recorded passes as deployment-recheck items. Do not add 42 to 30. The queue dispositions remain 13 passed and 30 pending. |
| RAS MCP conformance | **17 numbered rows** (14 at the 2026-11-02 pass; rows 15–17 opened 2026-11-03 by the Specification's new sections). | Rows 2, 5, and 9 have live closure evidence as scoped below. Row 3's sign-in journey is live-verified, but its My Connection settings screen remains open. Rows 15–17 record the design-conformance compensation: the capability census is incomplete past its API element, the correction process is running, and four owner-facing refusals are designed for conversion to confirmed actions. |
| CAP-5 knock-test component | **Passed** at deployed release `5b5f701c`. | It proves the real client-ID-card journey, owner approval, no-`resource` authorize/token behavior, refresh rotation and refusal of the old refresh token, `stripe_whoami`, revocation, and refusal after revocation. It does not complete the CAP-5 unit or the full client matrix. |
| Current release identity and health | **Verified live at `c95f9cf0`** for the public front door, health, and contract surfaces. | Authenticated `initialize`/`stripe_whoami` were exercised at immediate parent `5b5f701c`; the only intervening change was documentation, so the code behavior carries to `c95f9cf0`. |
| Branded identity/domain | **Not cut over.** | The configured identity is still a platform hostname, the publicly serving hostname is a different platform alias, and the branded hostname is inactive. |
| Production readiness | **No filed pass.** | A production deployment exists, but “production ready” remains barred until conformance row 10 passes with evidence. |
| Stripe LIVE | **Off / not authorized by this schedule.** | LIVE remains a separate per-account owner decision and proof sequence. |

## CAP completion schedule

### CAP-1 — Operation and credential coverage inventory

**Disposition: source inventory complete; live/provider parity not complete.**

The merged CAP-1 delivery enumerates 644 unique GA method/path rows (612 v1
and 32 v2), records five credential kinds per row, keeps provider permission,
role, and country/product entitlement explicitly `UNKNOWN` where unproven,
distinguishes native/universal candidates from schema-only operations, and
generates deterministic family/version gap reports. Its
`remainingEngineering` list is empty **for that source-inventory delivery**.

That does not prove per-operation Stripe permission, entitlement, or live
parity. CAP-1's delivery itself records test evidence as `NOT LINKED` and
independent deployed acceptance as `NOT JOINED` per operation. Those facts
remain governed by the protected provider queue and CAP-5, not by reopening
the completed source inventory. In [PLAN](PLAN.md), CAP-1 is therefore
checked only with that source-inventory qualifier.

### CAP-2 — Standard fullest authorization and effective-access recovery

**Disposition: `IN_PROGRESS`.**

Built: the read-only `stripe_explain_access` diagnostic, grounded in the
registered tools and the current verified connection, with direct/indirect
source tests for Full TEST candidates, read-only refusal, LIVE non-consent,
missing handler, recovery guidance, and unknown provider permission.

Still required to complete CAP-2:

1. Actual customer/tenant/principal-owned permissions and deliberate,
   non-destructive Full profile reauthorization for each client, persisted
   with database lifecycle tests.
2. Proof of actual credential, role, and Stripe App permission eligibility
   for each operation, plus safe recovery of genuine scopes without provider
   trial-and-error or silent fallback.
3. Validation of Full permissions and read-only/LIVE denial through every
   real deployed MCP, HTTP, and RTC door, with independent authorized
   provider and mobile-client acceptance.

Full CAP-2 depends on CAP-3's identity, tenant, and grant lifecycle.

### CAP-3 — Guided additional authority and verified identity/tenant/grant lifecycle

**Disposition: `IN_PROGRESS`.**

Built in source: an inactive, gated tenancy store; separate human/tenant/
context membership records; credential-free grant descriptors that cannot
execute; an encrypted tenant-bound grant vault with no provider execution
method; client ID-card (CIMD) resolution; and the corrected one-public-sign-in
consent journey. The CIMD/consent component is live-verified as described
above.

Still required to complete CAP-3:

1. Select and verify an independent human identity provider; implement
   provider-backed human sign-in through a maintained OIDC verifier with
   verified issuer/subject and PKCE/state/nonce.
2. Register and complete review of the actual Stripe App, including its
   permission manifest, OAuth access method, verified callback, and sandbox
   installation. Do not substitute Connect OAuth for Stripe App OAuth.
3. Implement the one-screen branded Stripe App account consent and automatic
   mobile client return using the registered Stripe App grant and the
   independent human identity.
4. Activate the encrypted tenant-bound credential lifecycle and build the
   real operation-aware policy resolver; the present vault and descriptors
   deliberately cannot execute provider work.
5. Issue, refresh, and revoke tenant-bound MCP tokens through the new
   identity/grant system.
6. Migrate the original OAuth connector and existing owner credentials only
   with independently proven ownership; never guess tenant ownership.
7. Implement Full and optional God Mode upgrades with actual operation-scope
   evidence and a genuine before/after authority difference for each
   additional credential kind.
8. Build the authenticated **My Connection** settings screen. This is the
   customer management surface; it is different from the public
   `/connection` explanatory page required by conformance row 8.
9. Prove the completed lifecycle across direct, RTC, indirect, and HTTP
   doors with real PostgreSQL and independent provider/client acceptance.

### CAP-4 — Advanced functional workflow gap closure

**Disposition: `IN_PROGRESS` — started 2026-11-04.**

The gap set is derived and frozen: the unified census reconciles
644 of 644 operations to exactly one destination (349 claimed by
CAP-4's family cards, 295 dispositioned out with reasons), the
family sequence is frozen (Phase 1 reads, D-3 first; Phase 2
Connect in three slices; Phase 3 the universal door; Phase 4 the
product-gap cards; Phase 5 organization context and the substrate
unit), and the row 17 unclassified read item is inside the set as
the read families. The first family is source-implemented:

- **D-3 — invoice, billing and credit-note reads**
  ([CAP4-D3-INVOICE-BILLING-READS](pr-cards/CAP4-D3-INVOICE-BILLING-READS.md)):
  all 13 swept handlers verify every returned object against the
  connection's own mode in both directions. D-3 also closes the
  A9 half-open state the derivation found: from PR #304's merge
  until D-3's merge, those reads executed on LIVE connections
  without verifying returned objects — neither TEST-only nor
  converted. Production never ran that code (the deployed build
  predates PR #304 and `main` was not promoted during the
  interval). Live proof for D-3 stands in the CAP-5 queue,
  including a wrong-mode-object knock test.
- **D-1 — money reads**
  ([CAP4-D1-MONEY-READS](pr-cards/CAP4-D1-MONEY-READS.md)): all
  10 money read tools (balance, balance transactions, payouts,
  payout transactions, top-ups, bank accounts, payout schedule)
  serve the connection's own mode with per-object verification;
  the three TEST-only gate sites and the embedded
  automatic-payout TEST check are converted, and bank/schedule
  account verification follows the connection mode via the
  verified-account readers. Live proof for D-1 stands in the
  CAP-5 queue (balance, one payout, one top-up, bank accounts,
  schedule on the owner's LIVE connection).
- **D-2 — payment reads**
  ([CAP4-D2-PAYMENT-READS](pr-cards/CAP4-D2-PAYMENT-READS.md)): all
  10 payment read tools (payment intents, charges, refunds, setup
  intents — list, get and search paths) serve the connection's own
  mode with per-object verification; the module-local TEST-only
  client guard is replaced by the shared mode-aware seam and the
  four projections verify on the shared-projection precedent.
  Live proof for D-2 stands in the CAP-5 queue (one charge, one
  intent, one refund, one setup intent on the owner's LIVE
  connection).
- **Connect slice 1 — connected-account reads**
  ([CAP4-CONNECT-SLICE1-READS](pr-cards/CAP4-CONNECT-SLICE1-READS.md)):
  Phase 2 opens in parallel under coordinator ruling 3 (the
  platform acts only via the owner's enrolled connection; the
  connected account is always an explicit exact argument). Seven
  new native read tools (connected-account list/get, capability
  list/get, external-account get, person list/get) verify the
  platform actor and every returned object's mode before
  projecting safe fields only — no email, tax ID, bank numbers,
  card fingerprints or person data; persons follow the Identity
  safe-fields posture. Registry 322 → 329 tools. Slices 2
  (lifecycle writes) and 3 (destructive/terminal) remain exactly
  as refused as at baseline, pinned per operation in the card's
  suite. Live proof for slice 1 stands in the CAP-5 queue on the
  testing surface only (one account + person read round against
  a TEST platform's test connected account).
- **Connect slice 2 — connected-account lifecycle writes**
  ([CAP4-CONNECT-SLICE-2](pr-cards/CAP4-CONNECT-SLICE-2.md)):
  eleven new native write tools (account create/update; person
  create/update/delete; external-account create/update/delete,
  tokenized attachment only; capability request; account-link
  and login-link minting under ruling 5's exception) on the
  guarded write lifecycle, extending slice 1's conventions: the
  platform actor is verified before any connected-account call
  (a non-platform connection refuses with no provider write),
  every preview names the exact connected account and change
  set, replay keys return the original result, before-state is
  captured, audit records are written, and read-backs verify —
  with the links carrying the recorded no-read-back disposition
  (the minted URL is shown once, in the confirmed result only,
  never in preview, audit or logs). Persons keep the
  safe-fields posture in every surface. Registry 329 → 340
  tools, 155 → 166 writes; the everyday catalog budget is
  unmoved at 19,999/20,000. Slice 3 (account delete, reject,
  unreject, v2 close) remains unbuilt and refused. Live proof
  for slice 2 stands in the CAP-5 queue as one lifecycle
  round-trip on the testing surface only.
- **Connect slice 3 — connected-account terminal operations**
  ([CAP4-CONNECT-SLICE-3](pr-cards/CAP4-CONNECT-SLICE-3.md)):
  the three terminal writes (account delete; reject with the
  pinned reason set; unreject) on the guarded write lifecycle,
  under the strongest ceremony the write contract offers — the
  full slice-2 contract plus the exact-account confirmation
  shape: every call repeats the exact connected-account ID in
  `confirmAccount`, and a missing or mismatched repeat, or the
  platform account itself offered as the subject, refuses
  before any provider call. Reject and unreject verify by
  state read-back (the re-read account's disabled reason must
  show, or no longer show, a rejection); delete verifies by
  the deleted marker or the provider's `resource_missing` for
  the exact ID, as slice 2's deletes did. The v2 close is
  covered-by-design-decision under the Connect card's fork 4
  and ruling 3(iv): it exists only on the v2 core surface,
  which has no dispatch surface here. Registry 340 → 343
  tools, 166 → 169 writes; the everyday catalog budget is
  unmoved at 19,999/20,000. **With slice 3, the Connect family
  is COMPLETE** in source: all three slices landed, every one
  of the card's 45 census operations carrying its disposition
  (canonical v1 built; aliases covered-by-canonical;
  `account_tokens`/`person_tokens` refused by ruling; the 15
  v2 core operations covered-by-design-decision). Live proof
  for slice 3 stands in the CAP-5 queue as one ceremony
  refusal on the testing surface only.
- **D-9 — the universal door, classified**
  ([CAP4-D9-UNIVERSAL-DOOR](pr-cards/CAP4-D9-UNIVERSAL-DOOR.md)):
  the door's write classifier is now a data table — 215 rows,
  one per non-money pinned POST/DELETE operation, each naming
  ownership, cost, secret, read-back and disposition, drift-
  checked against the pinned catalog in CI. 39 rows run
  generically under the existing guarded-write contract
  (Terminal locations, readers and configurations; billing
  meters/alerts/feedback configuration; Tax registrations,
  locations and settings; Radar value lists and items; a
  small payment-method/review set), 122 redirect to an owning
  native family by name, and the remainder refuse with their
  true class reason; the old generic refusal is asserted
  absent from every in-scope refusal, and the 92 money rows,
  the metadata-only route and the whitelist paths are
  byte-identical. The Connect accounts-row flip lands here:
  all 13 `v1/accounts` rows (plus account links) name their
  slice 1–3 Connect tools; billing meter events stay refused
  as an ingestion class, citing E-3's native idempotent
  route. The Terminal family is the proof family — the
  registration code is proven shown-once and never journaled.
  Registry unchanged (343 tools, 169 writes); the door's
  description and the 19,999/20,000 everyday budget did not
  move. Live proof for the door rows (one generic-allow
  family plus a refusal sample) stands in the CAP-5 queue.
- **D-4 — dispute and event reads**
  ([CAP4-D4-DISPUTE-EVENT-READS](pr-cards/CAP4-D4-DISPUTE-EVENT-READS.md)):
  all 5 registry tools (dispute list/get; event list, get and
  undelivered list) serve the connection's own mode with
  per-object verification; the handler TEST-only gates are gone
  and both projections verify on the shared-projection precedent,
  with projection shapes and the privacy posture unchanged in
  both modes. The census names the fifth tool `event_list_types`;
  the registry's fifth tool is `event_list_undelivered` — naming
  drift, recorded in the card. Live proof for D-4 stands in the
  CAP-5 queue (one dispute and one event read on the owner's
  LIVE connection).
- **D-5 — checkout, payment-link and portal reads**
  ([CAP4-D5-CHECKOUT-READS](pr-cards/CAP4-D5-CHECKOUT-READS.md)):
  all 7 registry tools (checkout session list/get/line items,
  payment-link list/get, portal-configuration list/get) serve
  the connection's own mode with per-object verification; the
  shared TEST-only provider helper is converted to the shared
  seam and all four projections verify on the shared-projection
  precedent, with projection shapes unchanged in both modes.
  The census names the family with drifted tool names and
  claims an eighth operation (a payment-link line-items read)
  that does not exist; the build also converts an unenumerated
  mode-shaped gate the census missed — the session-ID pattern
  admitted only `cs_test_` IDs at baseline. Live proof for D-5
  stands in the CAP-5 queue (one session read, one line-item
  read, one payment-link read and one portal-configuration
  read on the owner's LIVE connection).
- **D-6 — report, file and Radar reads**
  ([CAP4-D6-REPORT-FILE-RADAR-READS](pr-cards/CAP4-D6-REPORT-FILE-RADAR-READS.md)):
  all 12 registry tools (report type list, report run list/get
  and the result-file read; file list/get; Radar
  fraud-warning, review, value-list and list-item reads) serve
  the connection's own mode with per-object verification. The
  family was half-converted by V2: `fileSafe` and the Radar
  projections already took a mode their read callers never
  passed; reports carried a wrapper gate, a second gate in the
  result-file module and per-projection hard-checks, each
  parameterized by its own baseline semantics (strict for the
  runs, boolean-present for the report type and the result
  file) so TEST behavior and refusal texts are byte-identical.
  The census names three radar tools that do not exist; the
  build also converts a TEST-hardcoded `scope` literal in the
  report-type list result. The three invariants hold in both
  modes: no signed report URL is ever exposed, Radar results
  identify value-list items by ID and type only, and the file
  purpose bounds are unrelaxed. Live proof for D-6 stands in
  the CAP-5 queue (one report type/run read, one result-file
  read, one file list/get and one Radar review plus
  value-list/items read on the owner's LIVE connection).
- **D-7 — account and admin reads**
  ([CAP4-D7-ACCOUNT-ADMIN-READS](pr-cards/CAP4-D7-ACCOUNT-ADMIN-READS.md)):
  `account_get` and `account_list_capabilities` follow the
  connection mode (mode-matched verified reader; the account
  record's `livemode` strictly equals the connection mode), and
  the shared admin gate is mode-aware, so
  `stripe_admin_overview`, `admin_list_requirements`,
  `admin_fees_and_billing` and `admin_review_security` derive
  every section from the selected connection with payload
  `mode` fields reporting its actual mode. The fees
  projection's categorical LIVE refusal is replaced by the
  standard wrong-mode refusal (default semantics; the baseline
  TEST read set is unchanged). The census admin names are
  drift (business health, attention and todos are overview
  sections/derivations). Under the coordinator's ruling the
  guided settings gate follows the shared helper and the
  guided list payload reports the connection mode; D-12 owns
  that family's full conversion. One leg is **flagged, not
  converted**: `stripe_check_key_permissions` stays TEST-only
  because persisting a LIVE probe result requires a
  `src/db.js` ruling (`updateKeyPermissions` is
  `test_key_enc`-pinned and the permission columns are shared
  across modes); baseline pins hold its contract with no
  cross-mode fallback. Live proof for D-7 stands in the CAP-5
  queue (account, requirements, overview, fees and security
  reads on the owner's LIVE connection; the probe's LIVE row
  also waits on the flagged conversion).
- **D-11 — Identity reads**
  ([CAP4-D11-IDENTITY-READS](pr-cards/CAP4-D11-IDENTITY-READS.md)):
  both registry tools (`identity_list_sessions`,
  `identity_get_session`) serve the connection's own mode.
  The smallest conversion in the series: the projection
  `identitySafe(v, mode)` already took an optional mode (V2
  Identity, PR #315) and the write callers already passed it —
  the build deletes the two handler TEST-only gates and passes
  the connection mode at both read call sites, leaving the
  projection itself untouched. The field set is frozen and
  pinned by an exact-keys test in both modes: `id`, `type`,
  `status`, `createdAt`, `redactionStatus`, `actionRequired`,
  `note` — verification state and verified metadata only, no
  document images, personal data, access secrets or report
  IDs in either mode. The 2 verification-report GETs are
  deliberately not claimed (no native read tool exists; they
  stay door-served). Live proof for D-11 stands in the CAP-5
  queue (one Identity list read and one session read on the
  owner's LIVE connection).
- **D-12 — brand reads and guided tools**
  ([CAP4-D12-BRAND-READS-GUIDED](pr-cards/CAP4-D12-BRAND-READS-GUIDED.md)):
  all 9 tools serve the connection's own mode by adopting
  the either-mode twins V2 built for the family's writes.
  The six guided tools (which return Dashboard steps and a
  read-back verification; the owner performs the change)
  dispatch on the either-mode selector and read back
  through the mode-verified account: guidance text is
  mode-templated (steps name the mode the owner is working
  in; the settings URL loses its `/test/` segment on
  LIVE), and TEST payloads stay byte-identical except the
  one named refusal correction for unselected accounts.
  The template reads verify provider mode evidence with
  default semantics (the baseline read set is unchanged),
  and `brand_get` reads the kit revision from the
  connection's own mode partition. Under the D-7 ruling's
  annex, the admin guided tools' remaining descriptions
  and TEST-shaped text are discharged and
  `admin_check_setting`'s full observed flow is pinned in
  both modes. No branding write handler was modified. Live
  proof for D-12 stands in the CAP-5 queue (one guided
  read-back, one template list and get, one `brand_get`,
  and the annex's observed flow on the owner's LIVE
  connection).
- **D-8 §A — workflow read composites**
  ([CAP4-D8-WORKFLOW-READ-COMPOSITES](pr-cards/CAP4-D8-WORKFLOW-READ-COMPOSITES.md)):
  all nine registered `writes: false` workflow composites
  serve the connection's own mode. The shared
  `verifyContext` is preserved byte-identical for the write
  composites under the frozen card's preservation clause
  (the split route): the read composites opt into a new
  mode-aware verifier through the shared plumbing's opt-in
  option, and every write entry still funnels through the
  legacy gate first — pinned by tests for all six write
  composites, with both write composites' suites unchanged.
  Result stamps follow the connection mode; month-end close
  verifies the composed snapshot's stamp against it, and
  provider report runs keep D-6's mode partitioning. The
  go-live checklist's internal TEST-matrix plus LIVE-sentinel
  contract is preserved, so on LIVE it degrades honestly
  (per-app gap or the matrix refusal) rather than
  fabricating a matrix; the dispute kit's agreement link
  stays TEST-gated with the Projects reads and lands on the
  LIVE checklist as a gap. The readiness read handler's
  CAP-4 comment is discharged; the Projects write side is
  untouched. Live proof for D-8 §A stands in the CAP-5
  queue (the LIVE composite rows — customer summary,
  billing overview, month-end close, readiness — plus the
  remaining composites on the owner's LIVE connection).
- **D-8 §B — workflow dispute-kit save**
  ([CAP4-D8B-DISPUTE-KIT-SAVE](pr-cards/CAP4-D8B-DISPUTE-KIT-SAVE.md)):
  the one write composite §A held out now follows the
  connection mode under the V2 write idiom, completing D-8
  and the Phase 1 read+workflow scope. The gate is a split
  `writableMode` beside a byte-identical `writable`, the
  examination is §A's converted `examine()` with the
  mode-aware verifier, and the already mode-converted
  guarded native writer is untouched; on TEST the behavior
  is byte-identical. The app-agreement link stays
  TEST-gated (ruling 4): on LIVE its recorded gap is
  carried on the saved kit and checklist without blocking
  staging, while every other gap and staging fact still
  blocks and TEST refuses on a failed link exactly as at
  baseline. Live proof for the save's LIVE row stands in
  the CAP-5 queue.
- **D7b — the key-permission probe, per mode**
  ([CAP4-D7B-KEY-PROBE-PER-MODE](pr-cards/CAP4-D7B-KEY-PROBE-PER-MODE.md)):
  D-7's flagged leg, split into its own schema-bearing card
  by the coordinator's probe-split ruling, is converted.
  The probe's stored record is split per mode: the baseline
  `key_permissions`/`key_checked_at` columns are the TEST
  record by construction, new additive
  `live_key_permissions`/`live_key_checked_at` columns start
  never-probed, and `db.updateKeyPermissions` matches the
  mode's own key ciphertext (the LIVE branch under the
  `live_enabled` gate). The reprobe service verifies and
  persists in the connection's mode, the handler serves
  either mode with the both-modes refusal text D-7
  deferred, and `stripe_whoami` reports the connection
  mode's own stored record (nulls when never probed, never
  the other mode's). `admin_review_security`'s LIVE probe
  section now observes, untouched. Live proof for the
  probe's LIVE row stands in the CAP-5 queue; the db-suite
  persistence and legacy-migration proof rides exact-head
  CI (no local PostgreSQL on the coordinator VM).
- **PROD-PAYMENT — payment-area coverage completion**
  ([CAP4-PROD-PAYMENT](pr-cards/CAP4-PROD-PAYMENT.md)):
  Phase 4's first product-gap card closes the payment area
  with evidence; no native tool is built. The four claimed
  operations are dispositioned: `payment_records` reads take
  native coverage deliberately out (third-party subject, no
  consumer — the family closes as a unit with D-9's
  refused-third-party writes, on the census's
  financial-connections precedent) with the guarded
  universal read serving both GETs; the `mandates` GET is
  door-sufficient (no list operation exists in the pinned
  catalog, so the door's per-object mode verification is
  complete for the family, proven in both modes and both
  wrong-mode directions); the `confirmation_tokens` GET
  takes no native read (an ephemeral client-issued
  pre-confirmation snapshot whose every field group is
  payment detail or PII, with no consuming workflow) — and
  the enumeration proved the door served it at baseline,
  because the sensitive-family screen's `tokens` pattern
  cannot match `confirmation_tokens` (no word boundary
  precedes `tokens` after the underscore), returning the
  full payload at `detail:'full'` under credential
  redaction only. The screen now names the family
  explicitly and refuses before any provider call — the
  unit's only source change. The area sweep re-ran at this
  baseline: 69 pinned operations across the eleven payment
  families, zero unclassified (native 28, door 16, D-9 10,
  row-35 money 14, out 1), reconciling with the census
  appendix. A disposition-verification row (the deployed
  refusal plus the mandate and payment-record door reads)
  stands in the CAP-5 queue.

Still required:

1. The remaining families in the frozen order: Phase 1 is
   complete in source with D-8 §B above; D-7's flagged probe leg
   (`stripe_check_key_permissions`), split into follow-up card
   CAP4-D7b, is likewise source-implemented above; Phase 2
   Connect is complete above (slices 1–3; the Connect family
   is COMPLETE in source); Phase 3 the universal door (D-9)
   is source-implemented above; Phase 4's payment product card
   (PROD-PAYMENT) is source-implemented above; next in Phase 4
   are the billing, Tax-closure, event and entitlement product
   cards; Phase 5 organization context and D-10.
2. The capability-census addendum conformance row 15 requires
   (beside-API and substrate dispositions and the consumer test)
   lands with CAP-4's final card; the consumer test itself runs
   under CAP-5 as CAP-4's closing instrument.
3. Implement and test each selected gap through preview, authorized
   effect, stable replay key, before state, audit, provider
   read-back, bounded results, and pagination/asynchronous
   completion—or record a provider-evidenced unavoidable
   disposition for that gap.

### CAP-5 — Independent acceptance and truthful reporting

**Disposition: `APPROVED`, not started as a complete unit; one component passed.**

No `docs/pr-cards/CAP-5.md` exists yet, again under
`WRITE_CARD_AT_START`. The completed component is the CIMD live knock test
at `5b5f701c`.

Still required:

1. Write the CAP-5 card and freeze the precise positive and negative
   scenario set before running the unit's acceptance.
2. Complete the full client-compatibility matrix for ChatGPT and Claude
   (phone, browser, and desktop), Muse, Hermes Agent, Claude Code,
   Cursor, Windsurf, VS Code, Codex, and Gemini CLI. A client that cannot
   be tested must be declared untested; a setup snippet is not live proof.
3. Run the pre-deploy, spec-shaped handshake for each transport/auth shape:
   initialize, `tools/list`, and one real tool call. Cover both bearer/pass
   access and OAuth 2.0/2.1 with PKCE, including public clients with no
   secret.
4. Verify ordinary Full and genuinely additional-authority workflows beyond
   the single knock-test journey.
5. Verify read-only/user-policy denials and wrong principal, tenant, and
   resource refusals.
6. Verify refresh/revocation across the frozen scenario set, interrupted
   setup recovery, and ambiguous-effect replay.
7. Generate source/live coverage metrics and record the external
   prerequisite for every unverified operation.
8. Reconcile CAP-5 with the original 43-row protected acceptance queue
   without overwriting or silently reclassifying its rows.

CAP-5 cannot finally close before CAP-2, CAP-3, and CAP-4 are complete.

## RAS MCP Standard conformance schedule

| Row | Reconciled status | Remaining work or exact scope |
|---|---|---|
| 1. Client compatibility | **OPEN — planned under CAP-5.** | Full matrix, both auth shapes, per-shape handshakes, and recorded per-client results remain. Snippets exist; snippets are not verification. |
| 2. Client ID cards (CIMD) | **VERIFIED LIVE — component closed.** | The real-card knock test passed at `5b5f701c`; the code carries unchanged through the documentation-only change to `c95f9cf0`. This does not verify every named client. |
| 3. One public sign-in | **Journey VERIFIED LIVE; unit PARTIAL.** | The corrected consent journey was exercised in the knock test and defaulted to `full`. The authenticated My Connection settings screen remains CAP-3 work gated on human identity. |
| 4. Developer access boundary | **SOURCE IMPLEMENTED; LIVE PAIR OPEN.** | Run the entitled-developer versus ordinary-user pair at a checked deployed release, including crossover refusals both ways. The future `DevGrant` issuance system is conditional scope if a consumer arises; it is not built and is not silently counted as part of the present boundary's live pair. |
| 5. Release provenance / VER-1 | **VERIFIED LIVE.** | Public front door, health, and contract were re-read at `c95f9cf0`; authenticated initialize and `stripe_whoami` were exercised at `5b5f701c`, with only documentation intervening. No further work for this row at the baseline. |
| 6. Identity anchoring / branded origin | **OPEN.** | One-source derivation is proven in code, but the live cutover has not happened. See the domain schedule below. |
| 7. Unleashed branding and naming | **PARTIAL.** | The public name and Break-Out mark are corrected in the governing documents, and the front door/consent surfaces carry the required name/disclaimer text. The D-005 Magenta `#E35FD0` claim is **not filed**. For this schedule, “first branded surface” means the first surface carrying the Break-Out mark, not product-name text alone; file and verify the claim in that same change. |
| 8. Branded front door — five fleet things | **PARTIAL.** | (a) Branded subdomain attachment remains open. (b) The status surface's substance is live at `/api`; the row's literal `/` route returns 404, so either the route or the governing wording must be deliberately resolved—do not call the literal row complete. (c) Public `/connection` explanatory page remains unbuilt. (d) Instructions cannot name only the branded address until cutover. (e) The single `robinsonaisystems.com/tools` listing remains unverified in this repository and may show a connect button only when the branded connection page answers. |
| 9. Fleet health contract | **VERIFIED LIVE.** | `/api/health` and the `/health` rewrite answer at `c95f9cf0` in the pinned shape with a genuine database check; `/api/contract` advertises the health path. No further work for this row at the baseline. |
| 10. Production readiness and protection gate | **OPEN — no filed pass.** | Pass every gate section with evidence, state and sweep this server's retention clocks or record a dated variation, file the readiness report where the next builder can read it, and declare any degraded check degraded. Charging for this product or launching beyond beta also requires the one-time attorney review of Terms/Privacy. |
| 11. Discovery and contract governance | **CONFORMS at plan level.** | This is not a live conformance pass. Standalone `/api/contract` behavior is separately visible in the baseline checks. |
| 12. No global credential fallback | **CONFORMS at plan level.** | The governing design states the rule. Future CAP-2/CAP-3 implementation and CAP-5 proof must continue to demonstrate it; this row supplies no independent live pass. |
| 13. Version evolution | **CONFORMS at plan level.** | Additive/fail-closed evolution remains a continuing rule for later changes, not a completed acceptance event. |
| 14. Pattern appraisal guardrails | **RECORDED; remote coding runtime NOT APPLICABLE.** | No further baseline work. |
| 15. Capability completeness | **CORRECTABLE — PARTIAL under the 2026-11-04 grading amendment; re-census filed.** | The two-source fleet re-census (service map: 415 operations across 104 objects; server inventory at `2688228f`: 329 tools) dispositioned the full reachable surface: 341 covered (200 native, 141 through the universal door), 2 composed, 61 missing, 3 missing in LIVE, 8 unverified — full record in the conformance file's row 15. The headline absence is this server's own records: enrollment has no exit (no enrolled-account or enrolled-key removal; no OAuth client edit or delete) — cards CAP4-RECENSUS-1-ACCOUNT-DEENROLL and CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE are filed. Still owed: beside-API and substrate dispositions in the census-addendum sense, the workflow-frequency research, and the consumer test — the addendum filed with CAP-4's card — plus the front-door depth line citing the census instead of the tool count, which rides the branded cutover. |
| 16. Conformance-correction process | **CORRECTABLE — process running.** | Steps 0–2 are done (two declared-degradation audits, the retroactive census, this record at 17 rows). The row closes when every row conforms or carries a ruled exception with live proof filed. |
| 17. Owner-obedience | **CORRECTABLE.** | All 47 refusal mechanisms are classified in the conformance record: 36 aim checks kept hard, 4 non-convertible boundaries, 3 platform rules, and **4 convertible vetoes**. The first conversion — the LIVE enablement deployment-flag stop — is **source-implemented 2026-11-03 (OWNER-OBEDIENCE-V1)**: flag removed, ceremony bound to a fingerprint of the evaluated state, atomic re-check at consumption, journaled, read back; it closes only on live proof at a checked release. The fourth conversion — the pass/revoke preparation gate — is also **source-implemented 2026-11-03 (OWNER-OBEDIENCE-V4)**: preparation now works on the owner's full connection in either mode, with completion still owner-page-only; it likewise closes only on live proof. The second conversion (LIVE write allowlists/TEST-only handlers) is in progress: its shared machinery (preview-fingerprint binding and the mode-aware client seam) is source-implemented, and its families convert one card at a time, most destructive first. Family 1, **Money**, is fully source-implemented (the recorded blocker — the money reservation bound a non-pass approval to TEST mode — was ruled and fixed the same day: the expected approval mode now binds to the connection's own stored token-row mode, so LIVE payout creation/reversal complete in tests). Family 2, **Disputes**, is source-implemented (submit evidence, accept and save evidence complete the confirmed-action sequence in LIVE in tests, with accept's money gates demonstrably unrelaxed). Family 3, **Payments & refunds**, is source-implemented (all nine payment writes complete the confirmed-action sequence in LIVE in tests, with the refund's money gates and the app-owned-target guard's refund exception demonstrably unrelaxed). Family 4, **Invoices & credit notes**, is source-implemented (the family was dispatcher-refused in both modes, so it is admitted in TEST and LIVE and all fourteen operations complete the confirmed-action sequence in the connection's mode in tests, with the credit note's money gates demonstrably unrelaxed). Family 5, **Billing**, is source-implemented (all fourteen subscription, item and schedule writes complete the confirmed-action sequence in the connection's mode in tests, subscription discounts verify only in their own mode, and the plan change's money gates are demonstrably unrelaxed; no dispatcher change — the billing area was already a guarded LIVE area). Family 6, **Checkout, payment links and portal sessions**, is source-implemented (all nine hosted writes complete the confirmed-action sequence in the connection's mode in tests, with the hosted-URL aim check demonstrably unrelaxed and no money wiring touched). Family 7, **Radar**, is source-implemented (all five review and value-list writes complete the confirmed-action sequence in the connection's mode in tests, with the raw-value privacy invariant demonstrably preserved and no money wiring touched). Family 8, **Identity**, is source-implemented (all three verification-session writes complete the confirmed-action sequence in the connection's mode in tests, cancel and redact stay independent, the safe projection verifies a session only in its own mode with its field set unwidened — no personal data beyond the existing projections — and the read tools stay TEST-only under CAP-4's ownership). Family 9, **Files**, is source-implemented (the family was dispatcher-refused in both modes, so it is admitted in TEST and LIVE and both operations — evidence import and brand-asset file link — complete the confirmed-action sequence in the connection's mode in tests, with the brand-asset scope guard, expiry requirement, URL-withholding re-verification and import bounds demonstrably unrelaxed and no money wiring touched); Family 10, **Reports**, is source-implemented (the single report-run write completes the confirmed-action sequence in the connection's mode in tests, with the report-type allowlist, interval bound and availability verification demonstrably unrelaxed, creation never reported as completion, no report contents or file URL surfaced, and the report reads staying TEST-only under CAP-4's ownership); Family 11, **Branding**, is source-implemented (the branding area is admitted in LIVE — its payout-schedule exposure already converted with Money under ruling 6 and is untouched — and all six writes — brand kit save, image upload, Checkout preview, invoice template archive/unarchive and portal look — complete the confirmed-action sequence in the connection's mode in tests, with the kit store's own TEST-only save gate converted so LIVE kits are separate records, and the portal look's row 32 ownership refusal demonstrably intact in both modes — it does not convert — alongside the public-HTTPS and return-destination checks; the guided tools and reads stay TEST-only under CAP-4); Family 13, **Projects** (provider-write half only, coordinator ruling 4), is source-implemented (exactly three provider writes — portal creation, project setup and the readiness fix — admitted by name in both modes and completing the confirmed-action sequence in the connection's mode in tests, with setup's disclosure stating the recorded draft is not bound and scoped ownership is not enabled; the binding half — profile binding and scoped-ownership enablement — gains no admission in either mode, its module is byte-untouched with refusals proven unchanged, and it is referred to the owner-surface migration; the readiness read stays TEST-only under CAP-4) — **the V2 family sequence is complete in source; the binding half and all live proof remain open**. The third conversion (catalog `outsideApp` ban) is also **source-implemented 2026-11-04 (OWNER-OBEDIENCE-V3)**: the seven catalog writes convert the categorical ban into the fingerprint-bound ceremony — a known app-owned target proceeds only when the owner passes `outsideApp: true` and confirms with the fresh fingerprint the preview carries, bound to the evaluated marker and the exact change; unclear ownership still refuses as an aim check, and one unmapped refusal (reuse of an existing app-owned lookup-key price) is recorded in the card as an open point pending a coordinator ruling. **All four conversions now stand source-implemented; each closes only on live proof.** Four unclassified items are recorded as defects (incl. read tools that refuse LIVE data Stripe serves). Each conversion closes only on live proof. |

The conformance file contains **17** numbered rows (14 from the 2026-11-02
pass plus rows 15–17 opened by the Specification's 2026-11-03 sections).
Any older reference to 16 rows is superseded by this count.

## Branded domain, identity, and public front-door schedule

The approved target is `https://stripe.robinsonaisystems.com`, with the MCP
endpoint at `https://stripe.robinsonaisystems.com/api/mcp`. Approval of the
target is not activation.

The cutover remains gated in this order:

1. Verify current DNS zone authority and the absence of a conflicting
   record; attach the exact domain to the Stripe Unleashed by Robinson AI
   Systems Vercel project; confirm Vercel's required DNS records and TLS.
   Do not disturb unrelated records or production aliases.
2. On the custom host, verify discovery, the account-only setup surface,
   MCP transport, HTTPS redirects, and Origin allowlists without placing
   secrets in URLs.
3. As one ruled identity change, update `PUBLIC_BASE_URL`, the issuer and
   protected-resource identity, Stripe App callbacks/redirect lists, the
   MCP resource audience, and the RTC manifest. Implement an explicit safe
   transition/reconnect path because changing the issuer can invalidate
   existing connections.
4. Independently test new sign-in, automatic mobile ChatGPT and Claude
   return, ordinary Full and read-only behavior, optional God Mode,
   refresh/revoke, wrong-origin refusal, two independent user/tenant
   contexts, and existing-client recovery at the branded origin.
5. Confirm the exact READY Vercel release at the branded origin before
   declaring the cutover. Do not activate LIVE or move money as part of it.

Until that cutover, connection material must distinguish three things that
older text sometimes collapsed:

- the **branded identity target**, which is not serving;
- the **configured issuer origin** on a platform hostname, which is
  intercepted by Vercel Authentication for unauthenticated visitors; and
- the **public serving alias** `stripe-mcp-psi.vercel.app`, which is the
  hostname this audit verified answering the application.

That mismatch is itself an unfinished identity item. The serving alias is
not the product identity, and the gated configured origin is not a completed
public connection address.

## Protected provider acceptance queue

The authoritative queue remains embedded in [STATUS](STATUS.md). Its
reconciled count is **13 PASSED / 30 PENDING of 43**:

- **29 Stripe-owned pending rows** are listed below.
- **1 Hub-owned optional pending row**, `STRIPE-HUB-ROUTES`, is preserved
  for evidence but is **not** a Stripe standalone-completion gate.

`STRIPE-TEST` is an aggregate over several of the other boundaries. It
closes only when its constituent standalone TEST, OAuth, webhook, and owner
boundaries close; counting it beside them is ledger accounting, not a
separate feature.

| Pending ID | Remaining proof, in plain terms |
|---|---|
| `STRIPE-TEST` | Finish the remaining standalone selected-account TEST, OAuth, webhook, and owner acceptance boundaries in this queue. |
| `STRIPE-V3-REMAINING` | Accept the remaining supported TEST trigger types, including disputed/failed/paid events and genuine hosted Checkout with browser participation. |
| `STRIPE-SIGNED-WEBHOOK` | Deliver a genuine signed Stripe TEST webhook to the protected hosted receiver and verify the private receipt and replay refusal. |
| `STRIPE-OAUTH-EXTERNAL` | Complete the original external OAuth acceptance as written, including preserved settings after refresh and the required scoped denial. The 2026-11-03 CIMD knock test is genuine partial evidence, but this queue row was not reclassified by it. |
| `STRIPE-G6-OWNER` | Complete the signed-in owner Dashboard review of G-6 status and sensitive settings; H-1 remains dependent on genuine G-6 acceptance. |
| `STRIPE-V3-PENDING-RECEIPTS` | Prove failed confirmed native TEST triggers expose only account-scoped audited unfinished-run IDs and no false success at a deployed release. |
| `STRIPE-V3-TRACKED-INVOICE-DECLINE` | Prove a genuinely declined run-owned attached TEST invoice card, the original `invoice.payment_failed` event, guarded detach, and independent cleanup read-back. |
| `STRIPE-V3-THREE-NATIVE-EVENTS` | Prove original `payment_intent.created`, `customer.subscription.updated`, and `invoice.paid` events with exact provider retrieval and durable run sources. |
| `STRIPE-V3-OWNED-PAYMENT-METHOD-EVENTS` | Verify genuine `payment_method.attached`, `updated`, and `detached` events from run-owned synthetic cards. |
| `STRIPE-V3-SETUP-INTENT-EVENTS` | Verify original `setup_intent.created`, `canceled`, and `succeeded` events from exact run-owned SetupIntents. |
| `STRIPE-V3-INVOICE-TERMINAL-EVENTS` | Confirm genuine `invoice.voided` and `invoice.marked_uncollectible` events from run-owned no-payment invoices. |
| `STRIPE-V3-NATIVE-CHARGE-EVENTS` | Verify original `charge.succeeded` and `charge.updated` events from independently linked run-owned PaymentIntent and Charge sources. |
| `STRIPE-V3-NEW-SOURCE-CLEANUP-READBACK` | Verify the standalone TEST cleanup read-back classifications against verified original events and provider states. |
| `STRIPE-P4-DRAFT-PROFILE` | Confirm the deployed P-4 draft-from-findings flow creates the exact inactive project profile without account binding or an external repository change. |
| `STRIPE-P4-PROVIDER-SETUP` | Execute genuine TEST P-4 guarded setup steps with confirmation, idempotent rerun, provider read-back, safe cleanup, and the private webhook-secret handoff. |
| `STRIPE-W1-MONEY-SNAPSHOT` | Prove `workflow_money_snapshot` against real selected TEST records, including Denver money flows, discounted/trialing MRR, multiple currencies, and complete/partial pagination honesty. |
| `STRIPE-W2-FAILED-PAYMENTS` | Prove `workflow_failed_payments` returns genuine provider decline and retry/hosted-link facts with honest scope. |
| `STRIPE-W2-CUSTOMER-OVERVIEW` | Prove `workflow_customer_overview` against an exact owner-approved disposable TEST customer across ownership, records, and bounded multi-page completeness. |
| `STRIPE-W3-REFUND-CUSTOMER` | Prove the guarded refund workflow with exact charge selection, ambiguity/stale/app-scope refusals, separate owner money-out approval, and provider read-back. |
| `STRIPE-W4-CANCEL-CUSTOMER` | Verify the cancellation workflow's exact preview, optional separately approved refund and invoice voids, guarded read-backs, and uncertain-outcome stops. |
| `STRIPE-W5-CHANGE-PLAN` | Verify the plan-change workflow's two provider preview totals and the separately approved guarded change with exact read-back. |
| `STRIPE-W6-DISPUTE-KIT` | Verify the dispute kit against a real TEST dispute, including owner-scoped allocation and draft-only evidence staging without bank submission. |
| `STRIPE-W7-WEBHOOK-HEALTH` | Verify complete TEST webhook coverage and honest undelivered-event scope, then the separately approved add-only repair and provider read-back. |
| `STRIPE-W8-GO-LIVE-CHECKLIST` | Run the 21 guarded readiness checks against an active bound TEST project while preserving unreadable/needs-owner states and proving LIVE is not queried. |
| `STRIPE-W9-MONTH-END` | Prove month-end close figures and the guarded report creation/read-back/private file handoff on genuine TEST data. |
| `STRIPE-W9-CATALOG-SETUP` | Demonstrate the catalog setup workflow's two protected confirmations, immutable lookup replay, app-owned refusal, and no duplicate on uncertain retry. |
| `STRIPE-W9-FIND` | Verify all six native search categories with provider-safe projections, cursors, multi-page/empty cases, and inaccessible-source gaps. |
| `STRIPE-W10-BRAND-BUSINESS` | Demonstrate the brand/business workflow, guarded brand and optional Portal saves, Dashboard needs-you read-back, and hosted TEST Checkout no-op replay. |
| `STRIPE-U1-UNIVERSAL-API` | Prove the universal API door against real selected TEST fixtures, including safe reads and guarded non-money writes with create/update/delete read-back and cleanup. |

## Go-live and owner-authorization schedule

[GO-LIVE-CHECKLIST](GO-LIVE-CHECKLIST.md) mixes four different kinds of
items. They must not be collapsed into the product scoreboard:

1. **Already-built infrastructure.** The Vercel project, Neon database, and
   production secret/config names are present and checked. Older checklist
   prose that says the whole service or a since-deployed owner feature is
   “not deployed” is historical wording; the current service is deployed in
   TEST-oriented form.
2. **Product/launch verification still unrecorded.** The hosted-page launch
   gates and the owner-control verification groups—money-out approvals,
   connection administration, emergency LIVE disable, default account,
   daily cap, and pending-request review—remain unchecked as written.
   Unchecked means the checklist has not recorded the required deployed
   verification; it does not, by itself, prove the code is absent.
3. **Separate external evidence.** The signed-webhook and related receiver
   items overlap the protected queue above and remain governed there.
4. **Per-account LIVE authorization.** For any account that will use real
   money, the account still needs its verified LIVE restricted key,
   separate IN-06 approval, one-time live-enable intent, owner passphrase
   affirmation for the exact account, consumption/audit verification, and
   the $1 LIVE charge-and-refund proof with the owner watching. None of
   that is implied by product completion, a production deployment, or a
   TEST pass.

The Appliance Desk section of the go-live checklist belongs to that
project's own money go-live. It is not a completion gate for the standalone
Stripe Unleashed by Robinson AI Systems product.

## What is not blocking standalone completion

- `STRIPE-HUB-ROUTES`: Hub-owned, optional, and preserved only as a
  historical pending row.
- Turning on LIVE for Chris's or any other particular Stripe account.
- The Appliance Desk project's own Stripe go-live items.
- A future `DevGrant` issuance product, unless and until a real consumer
  requires it; the developer-boundary live pair remains blocking under
  conformance row 4.
- CAP-4/CAP-5 card files existing before their units start; the blocking
  item is the unfinished unit work, not the intentionally deferred file.

## Shortest truthful answer

Stripe Unleashed by Robinson AI Systems still needs: CAP-2 completion;
CAP-3's human identity, Stripe App, executable tenant grants, migration,
God Mode, and My Connection work; CAP-4's frozen and implemented workflow
gaps (with the capability-census addendum filed first); CAP-5's full
independent acceptance and client matrix; the developer-boundary live
pair; the four owner-obedience conversions (all four
source-implemented — LIVE enablement flag, LIVE write allowlists
with the family sequence complete in source, catalog `outsideApp`
ban, and pass/revoke preparation gate), each still to be live-proven; the 29 Stripe-owned protected acceptance rows;
the branded-domain/identity and public front-door completion; and the
production-readiness gate. Only after those are complete—and separately,
only with Chris's authorization for launch or per-account LIVE use—can it
be called a finished product.
