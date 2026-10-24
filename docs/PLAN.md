## 2026-10-23 — CAP-2 ordinary Full explanation (source candidate, NOT deployed)

New registered read-only `stripe_explain_access({tool,compareProfiles?})`
uses only the current authenticated selected Stripe account and the
**original enforced** `src/core/profiles.js` predicates. It shows the
actual source-policy status and, optionally, safe side-by-side Full/
Everyday/read-only profile candidates on the **same account and mode**.
No tool argument can choose a different account, provider credential,
user identity or LIVE environment. Recovery guidance distinguishes an
explicit user-initiated profile reconnection from unavailable implementation,
Stripe provider credential/entitlement uncertainty, independently activated
LIVE and independently owner-approved money-out. The original MCP
dispatcher and meta-tool indirect call rules remain authoritative. A
source-eligible candidate does **not** mean actual provider permission,
successful Stripe invocation, real external acceptance or automatic God
Mode escalation.

This delivers useful **CAP-2 engineering but not full CAP-2**: secure
multi-user tenant grants, provider-authorized ordinary Full upgrades,
persisted explicit reconnection/consent, God Mode optional lifecycle and
direct-client real account acceptance require CAP-3 source/acceptance.
New tool implemented in `src/tools/access.js`, pure classifier in
`src/core/effective-access.js`, synthetic/direct/indirect denial tests
in `tests/unit/effective-access.test.js`. Original independent
money-out owner approval + shared $500/account/Denver-day unchanged;
no LIVE, money, OAuth, DNS or provider write occurred.

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

## 2026-10-23 — approved Stripe App login, management and optional God Mode

The owner approved the [GitHub-derived, Stripe-specific direct connection
contract](designs/STRIPE-CONNECTION-GOD-MODE.md). **No public onboarding,
Stripe App enrollment, God Mode key enrollment, permission expansion or real
provider acceptance is claimed by this design.** Implement within CAP-1..CAP-5
in dependency order. Initial connect should be client-initiated and mobile-safe;
the independent tenant/human identity must be verified separately from the
Stripe account grant; advanced keys are optional and never an unrestricted
cross-tenant fallback. Original money-out consent and $500/account/day stay
enforced. GitHub's classic master token has no universal Stripe equivalent.

The CAP-1 work branch `ai/gpt6/cap1-inventory-doc-reconciliation-20261023`
was frozen at planning commit `b79b4c47961f1d22ea79df8f9dd534a2b97c4494` and adds an offline source
inventory/validator. All classifications are code **candidates**, not fresh
Stripe permissions or actual deployed provider PASS. At the checked start
`main=live=cc5be1c3d41ed1dbca68b4ed05d435ec70b26c71`,
the Vercel deployment `dpl_CWMMndp4Y8zuumQiZp2awtEBTkqR` was
reported READY on that exact GitHub SHA. Original source 57/57 MERGED;
CAP-1..CAP-5 remain not completed; last original protected acceptance
ledger is 13 PASSED / 30 PENDING (43), with the Hub-owned optional row
still recorded pending but not required for standalone completion. No
new authenticated acceptance or real Stripe mutation occurred in this
reconciliation.

## 2026-10-19 Stripe completion versus optional Hub-operated connection proof

## Maximum legitimate authority — owner-approved 2026-10-21

[MAXIMUM-AUTHORITY](designs/MAXIMUM-AUTHORITY.md) adds five indexed APPROVED,
NOT IMPLEMENTED units CAP-1..CAP-5: operation inventory; ordinary fullest authority;
secure additional credential lifecycle; advanced functional gaps; independent proof.
Existing acceptance and unfinished original cards retain priority. Named-tool counts
do not establish provider API coverage. No runtime grant or release change is implied.


The owner explicitly assigned discovery, OAuth onboarding and actual direct/relay/Sandbox routing to the Hub. Only provider-side standalone RTC1 conformance, an accurate public contract, real bounded authorized `stripe_search_tools` continuation, scoped credentials, permissioned `describe/call`, original financial/owner protections and direct MCP operation are Stripe completion gates. The historical `STRIPE-HUB-ROUTES` criterion remains PENDING and recorded as `HUB_OWNED_OPTIONAL`, but is **not** an obligation blocking Stripe completion. The top-level `STRIPE-TEST` aggregate refers only to standalone TEST/OAuth/webhook/owner verification. These are owner-approved boundary corrections, not accepted Hub route results or permission to perform live/financial operations.

Checked main/live/READY Vercel baseline `f38dfac2deed9fac204a619afaf0facc58726908`, 13 of 43 original checks PASSED, 29 mandatory Stripe-owned PENDING and one Hub-owned optional PENDING. Authentic custom Stripe Cloud adapter could not deliver a new provider call (`upstream_request_failed`), so none of those 29 were passed solely on this source correction.

## 2026-10-18 — E-1 genuine deployed guarded TEST catalog acceptance

Already-deployed original native catalog has now passed original `STRIPE-E1-CATALOG-WRITES` real provider acceptance (native guarded confirmations, unique lookup reuse, exact archived source/provider resource readbacks, negative app marker/foreign/immutable refusals, no extra write). The independent protected queue reaches **13 PASSED / 30 PENDING (43)**. Verified READY live remains `0a9577f25eb6ff307192a03694c448d8a9c3c64e` and original engineering main `84e188a17c3c05d215491df2e5c8143fb2c0ac4e` is ahead, 57/57 implemented. This does **not** certify W9 staged workflow, 17 original Events, actual Hub federation, owner Dashboard or future release of E-3/E-4/X features. Existing 31 original pending task revision pins are already in live ancestry; actual missing TEST fixtures/owner/Hub are separate from the release dependency of recently merged unexercised features. One masked input denial requires later source message correction.

## 2026-10-18 — current original acceptance queue after authentic deployed TEST inspection

The authoritative queue in `docs/STATUS.md` now has **43 protected original provider checks: 12 PASSED / 31 PENDING**. Only `STRIPE-V3-UNFINISHED-4` (#224 four original interrupted TEST fixture/provider cleanup-state inspections) and `STRIPE-V3-FAILURE-INDICATORS` (#228 genuine bounded failure diagnostics) were newly accepted on Vercel READY E-2 `live=0a9577f25eb6ff307192a03694c448d8a9c3c64e`. The full original source engineering roadmap is **57/57 MERGED** on main `57ecd5aa116c6e8b063f7a59b62cd7f7d0542f48`, newer than serving live. Four original V-3 ledgers remain running, only one cancelled-subscription original Event was separately retrieved, and all other failed Event/Checkout, owner browser, signed webhook, Hub and real/provider financial acceptance remain PENDING. This was TEST-only source inspection, not a provider write, release or overall V-3 acceptance. Earlier 10/33 observations below are historical checkpoints, not current state. Completion plan `docs/pr-cards/V-3.md` was frozen before queue-status changes at `38cb5c5eb22b83096fff4af599b85ae31419be52`; evidence commit `6d073e17efdb589aa66e449a4dc0a50e8c3bfb94` is its direct child, preserving `verifyFrozenPlan` ancestry.

## 2026-10-18 — original E-4/X-1/X-2 engineering complete as-if-merged, PR #276

**E-4, X-1 and X-2 implementation source complete as-if-merged in PR #276, not yet deployed.** After exact-head reviewed merge, the original engineering ledger becomes **57/57 MERGED** (currently main has 54/57). Protected real-provider acceptance is independent and remains **43 criteria: 10 PASSED / 33 PENDING**. Serving READY live is still E-2 at `0a9577f25eb6ff307192a03694c448d8a9c3c64e`; E-3 on main and this new branch have not been verified live.

Frozen acceptance in `pr-cards/E-4.md`: 12 Stripe Tax and 8 Quote operations; original audited undo with durable SQL claim and refusal; date-stamped 166-read inventory and real provider fixture gaps. Mandatory exact-head check, unit, local PostgreSQL, Stripe mock, RTC, private-core adoption, code review and reviewed merge are release gates. The audit is NOT an external provider PASS; production and owner actions stay unperformed.

## 2026-10-18 — E-3 complete engineering source (as-if-merged #274)

All original sixteen native Billing usage meters, events, alerts and credit grant/void tools authored, with persistent account-wide event deduplication and separate exact owner financial approvals. Exact-head CI/review and safe merge remain required; actual provider/deployed acceptance must be independently observed. E-4, X-1 and X-2 follow. Current protected ledger: 43 tasks, 10 passed, 33 pending.

# PLAN — remaining scope and acceptance

### 2026-10-18 — E-3 exact-head reviewed engineering and acceptance separation

**E-3 source complete as-if-merged (#274):** all sixteen native selected-account Stripe meter, asynchronous usage, billing alert and credit grant tools are implemented, registered and covered by unit tests, pinned Stripe mock, disposable PostgreSQL, RTC service/reference and private-core adopter CI on head `85c8eb07ab97777dd4509a3e2aed6c85e7477b5d`. Independent review identified and prompted repair of three real safety issues: owner-authorized single-use credit void, permanent account-scoped event identifier reservation before Stripe ingestion (including concurrent and retry checks), and filtered alert customer ownership. Exact-head `ci` and `PR target policy` were green on that revision. Safe reviewed merge still required; E-3 only becomes source-MERGED upon merge, yielding **54/57 original source subsections; E-4, X-1, X-2 remain**. The protected **43 independent real provider acceptance checks remain 10 PASSED / 33 PENDING**: no Stripe LIVE action, charge, real customer mutation, money-out, or manual release. Next scheduled checked promotion is distinct from source merge.

## 2026-10-18 — E-3 standalone selected-account metered billing engineering

E-3 native meter, usage event, alert and credit-grant source is in progress on its original approved scope. This is not a real-provider PASS: asynchronous usage-event acceptance is not the same as published summaries or final customer billing; a grant can affect future financial obligations and requires the existing durable owner money consent. The checked daily release promoted E-2 #273, and the 43 protected TEST acceptance rows stay **10 PASSED / 33 PENDING**. E-4/X-1/X-2 follow only after E-3 verification.

# PLAN — remaining scope and acceptance

## 2026-10-17 — E-2 20 native tools, as-if-merged count

After PR #273's exact-head checks and reviewed merge, source implementation reaches **53/57**, leaving E-3/E-4/X-1/X-2; 20 coupon/promo/feature/entitlement/manual tax original E-2 tools are newly implemented with provider-backfilled guards and distinct TEST/LIVE rights. Real provider/deployment acceptance is tracked separately (43 = **10 PASSED / 33 PENDING**, unchanged); no provider acceptance was inferred from mocks or source status. Previous 52/57 source summaries below are historical checkpoints.


## 2026-10-17 — reconciled implementation-only batch subsection register

**Authoritative source implementation count: 52/57 original IDs MERGED, zero source-IN_PROGRESS and five APPROVED**: E-2, E-3, E-4, X-1 and X-2. V-3's actual native original TEST Event triggers, failed payment/dispute/invoice flows and hosted Checkout Session code/independent verification are implemented and CI merged through PR #271. G-6's original native safe TEST administration, security, fees, account readbacks and 40-setting guided Dashboard map are merged through #151. H-1's original brand kit, upload, Checkout integration and guarded branding/catalog source are merged in #243. Missing *real provider* proof never changes the source merge status of these three.

**Acceptance separate:** 43 protected real-world criteria last recorded 10 PASSED / 33 PENDING. V-3 still requires genuine Stripe TEST failed-payment/dispute/invoice Events and hosted browser Checkout; G-6 requires signed-in owner Dashboard checks; H-1 requires real saved brand kit, deployed Checkout appearance and G-6 sign-in acceptance. Source PRs #264–#271 also need scheduled/authorized checked live promotion before new code is available on production. Existing specialist LIVE financial/payment/billing/report and per-user policy gaps are **additional product implementation**, not to be erased, relabeled passed as acceptance, or counted as original new subsections. The prior eight-open source wording below is an **obsolete checkpoint superseded by the user's explicit implementation-vs-acceptance distinction**. See [current audit](audits/2026-10-17-implementation-acceptance-separation.md). No real Stripe operation or owner grant is authorized by updating these documents.


## Reconciled 2026-10-17 original subsection register

The [authoritative work index](pr-cards/work-index.json) and [evidence-backed review](audits/2026-10-17-original-subsection-reconciliation.md) now record **49/57 source-MERGED**, **3 IN_PROGRESS** (V-3 real native TEST Events/Checkout acceptance; G-6 signed-in owner Dashboard verification; H-1 real hosted branding/owner provider acceptance with merged code #243), and **5 APPROVED** (E-2/E-3/E-4/X-1/X-2). This leaves **eight original subsection closures**, down from 14 outdated open index entries. Six entries were corrected from stale statuses after checking actual merged source/CI PRs: P-1/P-2 (#244), P-3 (#245), R-1/R-2/R-3 (#263). The initial audit plan projected seven closures; review identified H-1's explicit unfulfilled real acceptance gate, so H-1 intentionally remains open even though its source #243 merged. This is a documented plan variance, not new original subsection credit.

Old checkbox details below are acceptance lines, not separately countable subsection IDs. The protected real-world queue remains **43 total / 10 PASSED / 33 PENDING** until independently verified on the actual READY serving source. Later source PRs #264–#269 still need approved deployment and provider-backed acceptance. Further historically MERGED payment/billing/branding/report/financial policy user-authority engineering remains outside this eight-ID count. Developer TEST/no-spend/no-unscheduled-release gates are not end-user product prohibitions. This audit did not grant permissions, change a Stripe account or move money.

Written 2026-10-10 for an empty repository. Order is in [MASTER-ROADMAP](MASTER-ROADMAP.md); current head and blockers in
[STATUS](STATUS.md). AGENTS owns workflow rules. This file owns acceptance; designs own semantic decisions; cards own the
next bounded implementation.

## Rules that apply to every batch

- Every write tool passes the seven write-contract checks (`docs/designs/BATCH-B.md` §3) through every door that exists.
- Every Stripe request shape passes against `stripe-mock` at the pinned API version.
- Database code passes on throwaway Postgres; schema changes are additive and idempotent.
- `npm run check` green: secret scan, docs check, index validation, lint, write-safety, token budgets.
- No secret in code, docs, tests, logs, PR text or tool results (key-scan test).
- Developer-agent acceptance only: no unauthorized LIVE keys, Stripe writes, real money movement or purchases during implementation. This is NOT a restriction on authorized end users. User-issued LIVE passes require independent account activation, actual provider authorization and the original guarded finance controls (see END-USER-AUTHORITY.md).
- Owner inputs are inputs, not things to invent: build the mechanism, keep the dependent behavior off, list the `IN-xx`.
- Money shown in dollars and cents, stored in cents; times shown America/Denver, stored UTC.
- The PR description carries the card's acceptance checklist with evidence.

## Batch A — Foundation (`designs/BATCH-A.md`)
- [ ] CI runs check, unit, database and stripe-mock jobs on every PR; a failing test turns it red.
- [ ] Connector login with account, mode (test only until enabled), profile and listing; lockout after 5 tries in 15 minutes; tokens stored hashed.
- [ ] Keys stored only encrypted; added only on the setup page; previews refuse live keys; key-scan test passes.
- [ ] One Stripe client, pinned API version, idempotency key on every write, nested parameters correct (audit bug 4).
- [ ] One-time-secret page works (shown once, then gone).
- [ ] `docs/DEPLOY.md` followable by Chris.

## Batch B — Trust layer (`designs/BATCH-B.md`)
- [x] `defineWrite` with money spec, dollar preview, always-confirm money out, daily limit, read-back/verify, inverse (internal B-1 #18–#20; owner grant UI and live tools remain gated).
- [x] Live guard (internal two-step owner intent, no activation), app-owned guard (refund exception), plain-English errors, result shaping and profiles (#21–#26). IN-06 stays OFF.
- [x] `check-writes` fails on undeclared writes, missing `dryRun`, missing money spec (#27).
- [x] Server tools through #35: scoped reads, key re-probe, owner limit/default/revoke, LIVE disable and authenticated TEST money approval; LIVE activation still off (IN-06).

## Batch C — Cheap on context (`designs/BATCH-C.md`)
- [x] Summaries, `fields`, `detail`, handles, annotations, structured output (#36).
- [x] Catalog and compact listing; meta-tools route through guarded handlers (#36).
- [x] Budgets enforced in CI: compact <5,000 tokens, everyday catalog <20,000, descriptions ≤160 characters, results ≤8 KB or a handle (#36).

## Batch D — Everyday money (`designs/BATCH-D.md`)
- [x] D-1 customers (#37), D-2 payments/refunds/setup (#38), D-3 hosted Checkout/portal (#39), D-4 subscriptions/schedules (#40 + #42), D-5a invoice reads/drafts (#43), D-5b lifecycle (#45), and D-5c credit notes (#46; merge subject to exact-head green CI).
- [ ] No `client_secret` in any result; setup via hosted Checkout.
- [ ] Regression tests for audit bugs 1, 3, 4, 5. The historical toolkit audit is a feature-coverage checklist only; no legacy aliases or name map.

## Batch V — Developer tools (`designs/BATCH-V.md`)
- [ ] V-3c3d: native TEST checkout.session.completed via real Stripe hosted Checkout URL (dev_get_checkout_test_url), run-owned customer/product/price/Session, after interactive TEST browser payment independently retrieve completed paid Session, fully received linked PI and original Event. Genuine provider demonstration and V-3 completion gate pending; V-4 next.
- [ ] V-3c3c: actual native TEST invoice.payment_failed from $36 tracked invoice/item, finalized nonautomatically and one deliberate declined card collection, verified attempted unpaid invoice + matching original provider Event. V-3c3d genuine Checkout completion remains.
- [ ] V-3c3b: genuine TEST charge.dispute.created via tagged synthetic $36 payment, independently verified linked charge/dispute and exactly retrieved Event, durable immutable evidence and safe asynchronous retries. Remaining real invoice failures/Checkout V-3c3c.
- [ ] V-3c3a: genuine synthetic TEST payment_intent.payment_failed through separately recorded unconfirmed intent, actual declined card confirmation, zero received amount and independently verified original Stripe Event. V-3c3b invoices/disputes/Checkout remain.
- [ ] V-3c2 (#62): TEST-only real zero-amount invoice.created/updated/finalized events, tracked non-auto-advancing invoices, provider/Event read-back and metadata/source/status/zero-money verification. V-3c3 failures/disputes/Checkout remain.
- [ ] V-3c1 (#61): real seven-day TEST trial customer.subscription.created/deleted events; linked zero-paid invoice tagged and ledger-tracked; actual cancel + independently retrieved Stripe Event with exact source/price/status. Other billing/dispute/Checkout event paths V-3c2 remain.
- [ ] V-3b (#60): real TEST customer.updated, product.updated, price.updated and payment_intent.canceled events via idempotent native provider actions and exact event/read-back verification. More billing/dispute/Checkout types V-3c remain.
- [ ] V-3a (#59): real TEST event trigger actions for customer.created, product.created, price.created, payment_intent.succeeded; exact metadata/amount/account/event retrieval and durable event ID required. V-3b more genuine event types remain.
- [ ] V-2b (#58): independent zero-balance/inactive Connect seller and dependency-free TEST clock deletion, with exact provider deleted confirmation; V-2 closure after CI and V-3 next.
- [ ] V-2a (#57): account-scoped TEST cleanup, global exact provider ownership preflight, independently verified cancellation/archival/voiding, honest retained/uncertain results, and owner-only Dashboard test reset guidance. V-2b clock/Connect dependency cleanup remains.
- [ ] V-1b4f (#56): selected-account TEST Connect readiness, durable verified Express seller onboarding and buyer/catalog fixtures. No transfer or payout; only report observed capability state. V-1 complete acceptance and remaining live-Connect financial workflows are separate.
- [ ] V-1b4e (#55): guarded run-owned synthetic TEST ACH confirmation plus actual matching succeeded Stripe event checks; bank settlement never invented. V-1 next: Connect-capability-gated marketplace seed and complete acceptance.
- [ ] V-1b4d (#54): real clocked 7-day trial with attachable decline TEST method; provider-ready clock and observed past_due attempted unpaid renewal invoice are mandatory before durable completion. Remaining V-1: controlled ACH lifecycle and gated Connect marketplace.
- [ ] V-1b4c (#53): early, approved V-5 TEST clock create/list/advance prerequisite with provider verified ready state; destructive delete/full simulator remain under V-5. V-1b4d must now verify actual past_due subscription renewals and async ACH/Connect scenarios.
- [ ] V-1b4b1 (#52): verified paid active TEST subscription plus provider-linked paid invoice ID, no fabricated past-due status; V-1b4b2 test clock/renewal, ACH transitions and gated Connect still remain.
- [ ] V-1b4a (#51): account-scoped TEST provider verification of actual dispute-created events and ACH payment statuses, without inferring event absence, webhook delivery or settlement. V-1b4b still needs real active/past-due, ACH progression and gated Connect fixtures.
- [ ] V-1b3 (#50): tagged TEST dispute-triggering card payments and *unconfirmed* ACH-capable intents; do not report asynchronous dispute/ACH settlement before provider/event verification. V-1b4 real test-clock/active/past-due outcomes still remain.
- [ ] V-1b2 (#49): separate TEST store refund with provider-verified charge, owner-authenticated single-use money-out approval, daily account cap and durable ledger. V-1b3 dispute/ACH/overdue scenarios remain.
- [ ] V-1b1 (#48): TEST one-time store payment intents and trial/canceled subscription scenarios with exact read-back and durable ledger, natural description mapping, no automatic refund; V-1b2 remains for dispute/ACH/past-due/refund approval.
- [ ] V-1a (#47): account-scoped durable `dev_runs` and `dev_run_objects`, real TEST-only catalog-starter seeding and run listing implemented pending exact-head CI; V-1b full scenarios remain before V-1 acceptance.
- [ ] Seed scenarios with every created object recorded; cleanup touches only recorded objects.
- [ ] Real test events triggered; events forwarded to an app under development with valid signatures; private URLs refused.
- [ ] Test clocks and subscription simulation; test cards; every tool refuses live mode.

## Batch G — Money out, disputes, risk, events, account (`designs/BATCH-G.md`)
- [x] G-3 (#97–#102): TEST-only Radar/Identity reads and guarded lifecycle; Stripe Radar rules are Dashboard-only. Automated five-gate CI complete; external TEST account smoke remains unverified.
- [ ] Every listed tool built; Radar-rules question answered from Stripe's description.
- [ ] Webhook signing secrets only via the one-time page.
- [ ] Account settings: by API where Stripe allows (trial recorded), otherwise guided with read-back.
- [ ] Owner side complete: admin overview, requirements, security review, fees; every dashboard settings page in the map as structured guided steps (contract §11).

## Batch H — Branding and setup (`designs/BATCH-H.md`)
- [ ] Brand kit applied to every page this server creates; never to pages a profiled app creates.
- [ ] Account-wide branding, public details, descriptor, invoice defaults, portal look, payout schedule, card safety, dashboard time zone.

## Batch P — Project profiles (`designs/BATCH-P.md`)
- [ ] `known_apps` with the Appliance Desk profile, each item traceable to the app's code.
- [ ] App guard reads profiles and names the owning app.
- [ ] `workflow_app_readiness` covers all 21 rows of the example profile and works with an inline spec; fixes previewed and confirmed; never creates a profiled app's catalog.
- [ ] `workflow_project_setup` for new projects, idempotent; `project_draft_profile` from codebase findings.

## Batch W — Workflows (`designs/BATCH-W.md`)
- [ ] All 13 workflows; MRR correct per W3; webhook fix exact; all writes confirmed and logged.

## Batch U — Universal tools (`designs/BATCH-U.md`)
- [ ] Four `api_*` tools; requests validated against Stripe's description; money detection with safe default; hand-built tools win; same guards.

## Batch R — Hub-ready doors, RTC 1 (`designs/BATCH-R.md`)
- [ ] Passes per RTC §2; HTTPS tool API, manifest and OpenAPI per RTC §1/§7.
- [ ] Same seven write-contract checks through MCP, `stripe_call` and HTTPS.
- [ ] RTC 1 conformance green in CI.

## Batch E — Catalog, Stripe Tax, usage, quotes (`designs/BATCH-E.md`)
- [ ] Every listed tool built; profiled apps' catalogs never touched; no legacy usage records.

## Batch X — Undo and smoke test (`designs/BATCH-X.md`)
- [ ] Undo for every clean opposite; read-only smoke report on test mode. No toolkit compatibility or retirement decision.

## Maximum-authority acceptance (all open)

- [ ] **CAP-1:** Operation and credential coverage inventory; full criteria in MAXIMUM-AUTHORITY.
- [ ] **CAP-2:** Standard fullest authorization and effective-access recovery; full criteria in MAXIMUM-AUTHORITY.
- [ ] **CAP-3:** Guided additional authority lifecycle; full criteria in MAXIMUM-AUTHORITY.
- [ ] **CAP-4:** Advanced functional workflow gap closure; full criteria in MAXIMUM-AUTHORITY.
- [ ] **CAP-5:** Independent authority acceptance and coverage reporting; full criteria in MAXIMUM-AUTHORITY.
