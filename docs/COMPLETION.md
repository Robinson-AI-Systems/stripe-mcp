# Completion schedule — Stripe Unleashed by Robinson AI Systems

**Reconciled:** 2026-11-03
**Code and release baseline:** `c95f9cf0160f85f59789a11d1885e422ec84770b` (`main` = `live`)
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
| Repository | `Robinson-AI-Systems/stripe-mcp`; `main` and `live` both at `c95f9cf0160f85f59789a11d1885e422ec84770b`. |
| Hosting | Vercel project `stripe-mcp`; production branch is `live`; the latest production deployment is READY at `c95f9cf0`. Only the `live` branch is deployment-enabled in `vercel.json`. |
| Package/runtime | `@robinson-ai-systems/stripe-mcp` version `0.1.0`; ECMAScript modules; Node engine `>=20` (the Vercel project is configured for Node 24.x); runtime dependencies are the MCP SDK `1.32.1`, Neon serverless `1.0.2`, and Stripe `23.0.0`. |
| Tool registry | **322 tools** in the local registry and the deployed health/front-door readouts: 167 read-labelled tools and 155 write tools; 318 hand-built tools plus the four `api_*` tools. Read-only profile counts are read-only 155 / everyday 156 / full 167. Full visibility counts are 155 / 248 / 322. |
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
| Work index | **59 of 63 units `MERGED`**; CAP-2 and CAP-3 `IN_PROGRESS`; CAP-4 and CAP-5 `APPROVED`. | CAP-1 is merged only in the source-inventory sense defined below. CAP-4/CAP-5 card files are intentionally absent until their just-in-time card is written at start. |
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

**Disposition: `APPROVED`, not started as a carded unit.**

No `docs/pr-cards/CAP-4.md` exists yet. That absence is intentional under
the index's `WRITE_CARD_AT_START` readiness, but it also means the concrete
CAP-4 operation set has not been frozen.

Still required:

1. Satisfy or formally reconcile the CAP-2 and CAP-3 prerequisites, because
   CAP-4's design depends on CAP-1, CAP-2, and CAP-3.
2. Derive the active gap set from CAP-1, prioritizing Connect platform and
   connected-account lifecycle and organization context, then payment,
   billing, Tax, event, and advanced entitled-product gaps. Before the
   set is frozen, file the capability-census addendum conformance row 15
   requires (substrate dispositions, workflow-frequency research, and
   the consumer test), and take in the two engineering items row 17 left
   unclassified: the read tools that refuse LIVE data Stripe serves, and
   the universal door's unclassified non-money operations.
3. Reconcile that set with original unfinished cards so existing work keeps
   its original ID and is not double-counted.
4. Write and freeze the just-in-time CAP-4 card and its request, credential,
   secret, guard, failure, and recovery contracts.
5. Implement and test each selected gap through preview, authorized effect,
   stable replay key, before state, audit, provider read-back, bounded
   results, and pagination/asynchronous completion—or record a
   provider-evidenced unavoidable disposition for that gap.

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
| 15. Capability completeness | **CORRECTABLE.** | CAP-1 censused the API surface (644 operations). Still owed: beside-API and substrate dispositions, the workflow-frequency research, and the consumer test — all filed as a census addendum with CAP-4's card — plus the front-door depth line citing the census instead of the tool count, which rides the branded cutover. |
| 16. Conformance-correction process | **CORRECTABLE — process running.** | Steps 0–2 are done (two declared-degradation audits, the retroactive census, this record at 17 rows). The row closes when every row conforms or carries a ruled exception with live proof filed. |
| 17. Owner-obedience | **CORRECTABLE.** | All 47 refusal mechanisms are classified in the conformance record: 36 aim checks kept hard, 4 non-convertible boundaries, 3 platform rules, and **4 convertible vetoes**. The first conversion — the LIVE enablement deployment-flag stop — is **source-implemented 2026-11-03 (OWNER-OBEDIENCE-V1)**: flag removed, ceremony bound to a fingerprint of the evaluated state, atomic re-check at consumption, journaled, read back; it closes only on live proof at a checked release. The remaining three (LIVE write allowlists/TEST-only handlers, catalog `outsideApp` ban, pass/revoke preparation gate) are designed but not built. Four unclassified items are recorded as defects (incl. read tools that refuse LIVE data Stripe serves). Each conversion closes only on live proof. |

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
pair; the four owner-obedience conversions (LIVE enablement flag, LIVE
write allowlists, catalog `outsideApp` ban, pass/revoke preparation
gate), each live-proven; the 29 Stripe-owned protected acceptance rows;
the branded-domain/identity and public front-door completion; and the
production-readiness gate. Only after those are complete—and separately,
only with Chris's authorization for launch or per-account LIVE use—can it
be called a finished product.
