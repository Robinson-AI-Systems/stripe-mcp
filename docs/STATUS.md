# STATUS — current work, blockers and next action

Updated 2026-10-11. Repository created by Chris; plan written by Claude (Opus 5.5) in the Appliance Desk planning system.
**Batch A implemented (#9–#17):** tested foundation, durable OAuth, pinned Stripe API reference, encrypted keys, secure setup code and owner's deployment guide. No Stripe account has been connected; none of this is deployed or live.

## Next

- **G-3e (#101 as-if-merged; exact-head CI/review pending):** distinct guarded TEST Identity cancellation and irreversible redaction request, with provider state preflights, idempotency, private data withheld and independently re-read outcome. Stripe redaction may remain processing up to four days; no premature completed-erasure claim. **Next:** G-3 batch closure (DRIFT C), then G-4 events/webhooks JIT. LIVE disabled; genuine Stripe TEST smoke remains pending.


- **G-3d private TEST Identity reads/creation (#100 as-if-merged; exact-head CI pending):** two full-only safe Identity session readers and guarded TEST session creation, explicit confirm/idempotency, provider identity/status/URL read-back, only Stripe verified hosted URL returned; no client_secret, reports or document data in MCP/audit. Next **G-3e** cancel/redact session and G-3 acceptance closure. No LIVE or real TEST account smoke. Session limit: 6 merged this chat only, then resume recurring five-PR handoffs.


- **G-3c TEST Radar list lifecycle (#99 as-if-merged; exact-head CI pending):** full-only guarded empty-list deletion, item add and item removal with selected-account TEST preflight, private item value redaction, stable idempotency and deletion tombstones. No silent deletion of nonempty lists. Next **G-3d Identity session reads and guarded creation**, then cancel/redact. No LIVE.


- **G-3b first guarded Radar mutations (#98 as-if-merged; exact-head CI pending):** full-profile TEST review approval and new value-list creation now use distinct defineWrite preview/confirm/idempotency/independent read-back, app-owned payment guard and safe alias preflight. Next **G-3c** list/item lifecycle deletions/additions; then Identity. No LIVE.


- **G-3a Radar safe TEST reads (#97 as-if-merged; exact-head CI pending):** warning/review/status and value-list/item IDs now use six SDK read paths with strict TEST identity/pagination and no IP, email, card, secret or sensitive list values in results. Radar rule endpoint remains intentionally absent. Next **G-3b** guarded Radar review and value-list mutations, then Identity. No LIVE.


- **G-2d2 acceptance (#96 as-if-merged; exact-head CI pending):** ordinary USD TEST dispute acceptance now requires independently authenticated owner money-out consent bound to exact du_ dispute and provider-derived cents, shared $500/account/Denver-day cap and distinct owner override above it. Uses irreversible disputes.close, no refund, with lost read-back; unapproved, uncertain or app-owned targets fail closed. G-2 code-complete pending real Stripe TEST evidence; **next G-3 Radar and Identity**. LIVE remains OFF.


- **G-2d1 submission (#95 as-if-merged, exact-head CI pending):** independently confirmed TEST-only irreversible staged evidence submission uses a complete field inventory, verifies file purpose and dispute deadline, protects app-owned charge/customer, and re-reads provider submission count/status. No private evidence enters previews/results/audit. Next **G-2d2** separately owner-approved dispute acceptance with dispute-ID money-target validation, shared $500/day cap and independent above-cap override. No LIVE or real TEST account smoke.


- **Verified planning checkpoint (2026-10-11):** main `2a71f8a03845ad3bf8c8de9de4207a72596ace78`, #93 merged,
  no open PRs at inspection. Next implementation is **G-2d** (separate irreversible submission/owner-approved acceptance).
  [Implementation guides](implementation-guides/README.md) now provide inspected helper recipes, remaining-scope routes
  and a proposed G-2d packet, including the missing `du_` money-target validator integration. No product code, owner
  permissions or CI gates changed. Older as-if-merged entries below are historical checkpoints, not pending PR claims.

- **G-2c secure TEST dispute evidence drafts (#93 as-if-merged, exact-head CI pending):** dispute_save_evidence stages validated draft fields with explicit submit:false; verifies same-account evidence files, protects app-owned charges and deadlines, then confirms exact provider read-back with no customer text leaked into the result. Next G-2d distinct irreversible submit_evidence and dispute_accept tools; dispute acceptance is money-out and must use independent owner approval, $500/day shared cap, and second override above cap. G-2b2 evidence import #92 merged green. No LIVE or actual money moved.

- **G-2b2 secure public-source TEST dispute evidence import (#92 as-if-merged; exact-head CI pending):** file_upload_evidence uses the write preview/confirm/audit contract, pinned public IPv4 DNS, HTTPS only, verified redirects, 10 MiB cap and content signature. It creates only a verified Stripe dispute_evidence file; never attaches or submits evidence. G-2c guarded draft evidence save is next, G-2d explicit submit/accept after that. G-2b1 file metadata/link #91 merged green. LIVE and independent money-out approval unchanged.

- **G-2b1 guarded TEST file metadata and public-brand links (#91 as-if-merged, exact-head CI pending):** file_list/get return purpose-allowlisted metadata with no provider URLs; file_create_link is full-only guarded, expiring, and restricted to brand icons/logos (never dispute evidence). G-2b2 remote evidence import next, followed by drafting and submitting evidence. G-2a dispute reads #90 merged green; G-1 closed #89. LIVE and owner money-out policy unchanged.

- **G-2a TEST dispute list/get (#90 as-if-merged, exact-head CI pending):** New read_only summaries of validated disputes, money in minor units, Colorado evidence deadlines and days left, submission count, safe status; no raw evidence or cardholder details. New G-2 index/card and downstream G-2b secure evidence handling next. G-1g secure browser CSV merged #89 (five checks green). LIVE remains off; owner approval/limit unchanged.

- **G-1g owner-authenticated TEST CSV export (#89 as-if-merged; exact-head CI pending):** The private setup page now requires owner passphrase, origin/CSRF and a valid connected TEST account before streaming a strictly verified report CSV (5 MiB limit) directly to the browser. MCP never sees contents, provider URLs or keys. G-1 is implementation-complete pending required CI and owner-connected TEST verification. **Next G-2 dispute read tools and separate evidence handling.** No LIVE or actual account activity. Session limit: 5 merged PRs then recursive handoff.


- **G-1e TEST payout schedule setter with guided refusal (#87 as-if-merged, CI pending):** full-only guarded attempt for own account, pending/denied results include TEST dashboard steps; no claims without read-back. Weekly/monthly anchors validated. Next G-1f report export evidence and G-1 completion, then G-2 disputes.

- **G-1d2 guarded TEST report-run creation (#86 as-if-merged, CI pending):** full-only preview/confirm/audit/idempotency, provider type-availability/interval validation, asynchronous create/read-back and exact job ID/status, no fabricated completed report or CSV URL. Next G-1e payout schedule setter; then report export and G-1 completion/G-2.

- **G-1d1 TEST report types and runs (#85 as-if-merged; CI pending):** read-only provider report catalog (bounded sorted cursor), run history/status and exact result file ID; explicitly no fictitious signed download URL. Next G-1d2 guarded report generation and download guidance, then G-1 completion/G-2.

- **G-1c4 TEST synthetic-bank top-up create/pending cancel (#84 as-if-merged; CI pending):** no default/unverified real bank; fixed Stripe `btok_us_verified` TEST token, independently authenticated owner approval for bank-debit nature, shared daily cap and separate override, idempotent native SDK and read-back. Any non-synthetic source remains unavailable until separate design and owner authorization. Next G-1d reports.

- **G-1c3 independently owner-approved TEST payout reversal (#83 as-if-merged, CI pending):** eligible paid manual US bank payout reverse only, exact bank-target and Stripe amount from provider, B-8 owner grant, shared $500/day cap/second override, idempotency, independently verified reverse and original payout records. Bank debit, not equivalent to cancel; no LIVE or actual banking. Next G-1c4 top-up lifecycle, G-1d reports.

- **G-1c2 TEST owner-approved manual payout creation (#82 as-if-merged; CI pending):** exact account and verified bank identity, checked USD source-type balance, full-only guarded write, independent authenticated owner grant, shared $500/day limit and override, idempotency and post-write payout read-back. No live payout or bank debit. Next G-1c3 bank-debit reversal, G-1c4 top-ups and G-1d reports.

- **G-1c1 payout metadata and pending manual cancellation (#81 as-if-merged, exact-head CI pending):** TEST-only full-profile writes with defineWrite, confirmation, idempotency, app protection and provider read-back. No payout created, bank debited or money-out made. Next G-1c2 independent owner-approved payout creation/reversal, then G-1c3 top-ups and G-1d reports.

- **G-1b bank-account masking and payout schedule reads PR #80 (as-if-merged; exact-head CI pending):** two new TEST-only safe account-scoped readers. Stripe's external account endpoint is Connect-oriented; if own account lacks API access, report unavailable and point to dashboard rather than inventing empty bank results. Last4-only bank outputs, no routing/account numbers. **After #80 merge: stop for new chat as owner requested. Next G-1c** owner-approved payout/topup money-out writes; preserve independent owner intent for every amount and shared $500/day threshold/override.

- **G-1a account financial read-only tools PR #79 (as-if-merged; exact-head CI/review pending):** eight TEST-only tools provide provider-verified balance, balance transactions, payouts, automatic payout reconciliation, and top-ups, no raw bank data. Current main e5a22828 is V-5 complete. **Next G-1b** payout bank account safe listing and payout schedule reads, then G-1c owner-approved money writes and G-1d reporting. No money-out attempted.

- **V-5 automated three-month acceptance PR #78 (as-if-merged; exact-head CI/review pending):** one stateful fake Stripe provider runs 3 monthly clock advances, 3 independently retrieved paid invoices/PI and original Events, validates exact timelines, at-most-once retries and delayed/declined branches. Prior V-5a–V-5c code #72–#77 remains. **Next G-1:** balance, payouts and financial reports, subject to mandatory independent owner consent for any money out.
- **External evidence still pending (not coding blockers):** real Stripe TEST-hosted Checkout (#V-3) and public signed webhook target (#V-4), and actual provider three-month renewal. No genuine account smoke results have been invented; LIVE stays OFF.

- **V-5c3 TEST monthly billing reconciliation PR #77 (as-if-merged; exact-head CI pending):** guarded dev_simulate_subscription action=observe verifies exact TEST clock, recurring price/subscription, unique paid/open invoice, invoice-payment allocation, linked PaymentIntent and independently retrieved original Event. Only complete evidence makes the month observed, allowing the next month; missing evidence stays uncertain. Next: V-5 sequential three-month acceptance and Batch V documentation.
- **External TEST smoke still pending:** no enrolled Stripe TEST account or owned public HTTPS webhook target for real provider-to-app demonstration. No LIVE or money-out requested.

- **V-5c2 guarded TEST clock advance PR #76 (as-if-merged; exact-head CI pending):** dev_simulate_subscription supports action=advance/inspect for one monthly cycle with exact selected-account provider readback and SQL at-most-once protection. No invoice/paid claim from clock state. **Next V-5c3** monthly invoice/payment and event reconciliation so cycle 2/3 can be unlocked.

- **V-5b restoration correction #75 (as-if-merged; exact-head CI pending):** PR #74's tree accidentally omitted the previously merged #73 simulation setup implementation, tests, and catalog. Restoring those exact reviewed #73 files and registry/count expectations. The V-5c1 monthly ledger remains untouched. Next V-5c2 guarded advance, after exact-head CI. No provider/money action.
- **V-5c1 durable month advancement intent PR #74 (as-if-merged; CI pending):** additive selected-account dev_simulation_cycles table reserves only sequential 1–3 monthly intents for completed TEST simulation runs, records 'uncertain' before any future Stripe clock advance, and accepts only precise provider-ready clock/invoice/PI evidence to mark observed. Same key cannot authorize a second clock movement. **V-5c2 next:** connect this ledger to guarded dev_simulate_subscription phase actions and independently inspect actual invoices/payments/events.
- **Pending external TEST acceptance:** real hosted Checkout and owned HTTPS webhook require enrollment; neither claimed.

- **V-5b clocked TEST subscription setup PR #73 (as-if-merged, exact-head CI pending):** dev_simulate_subscription now creates only isolated synthetic TEST clock, product, recurring price, clocked customer and free-trial subscription, each independently verified and durably run-tracked for V-2 cleanup. 1–3 months, amount and synthetic card explicitly selected. No actual invoice charge/renewal claimed. **Next V-5c:** advance one month at a time, verify READY state and exact invoices, payment and event timeline.
- **Still pending external acceptance evidence:** hosted real TEST Checkout completion and genuine target HTTP smoke require TEST enrollment. Neither has been claimed completed.

- **V-5a TEST fixture catalog #72 (as-if-merged, exact-head CI pending):** read-only dev_test_cards exposes current Stripe-published TEST PaymentMethod IDs for success, card declines, 3DS and ACH scenarios, no PAN, no SDK writes, no LIVE. Existing native testclock tools #53 are reused. **Next V-5b:** guarded 3-month synthetic TEST subscription simulation.
- **Acceptance evidence pending, NOT a coding blocker:** V-4 automated validation passed in PRs #67–#71, but no enrolled Stripe TEST account and owned HTTPS endpoint have been provided for a real provider-to-webhook smoke. V-3 genuine hosted Checkout completion also awaits TEST browser action. Do not claim either was demonstrated. docs/pr-cards/V-4-acceptance.md.

## Historical implementation checkpoints (not the current queue)

- **V-4c2 durable guarded original TEST event replay (PR #71 as-if-merged; CI pending):** adds account-scoped atomic replay and per-event reservation tables. dev_forward_events requires preview, confirm and exact retry key, only TEST originals and active selected-account forwarder, TLS/DNS checks on EACH POST, no redirects, and durable per-event accepted/rejected/uncertain receipts. A retry of an attempted requestKey cannot resend; application processing is never inferred from HTTP receipt. Next V-4 acceptance mapping, then V-5. No LIVE, money-out, app-owned provider mutation or spend.

- **V-4c1 genuine TEST Event replay primitives (as-if-merged; exact-head CI/review pending):** original Stripe v1 Events selected by explicit event IDs or bounded since/type cursor; independently retrieve and verify exact TEST Event, account, type and timestamp. Each outbound HTTPS request freshly verifies all DNS answers are globally public, pins the chosen address in TLS while keeping original hostname/SNI, signs exact bytes with Stripe HMAC and never follows redirects. HTTP 2xx means target accepted, NOT that its app processed it. No public MCP delivery tool yet: V-4c2 adds guarded dev_forward_events and durable replay receipts. LIVE and money-out stay OFF.

- **V-4b2 TEST forwarding management PR #69 (as-if-merged, CI/review pending):** guarded create/delete and account-scoped read-only list tools use V-4b1 encrypted forwarder storage and V-4a public-DNS preflight. Secret handoff is a ten-minute one-time URL, revealed ONLY after owner password/CSRF/origin checks on existing private setup page, never in MCP/audit. Replays retain original secret and cannot reissue the setup link. Next **V-4c**: real TEST Event retrieval and pinned TLS delivery, no redirects. LIVE remains OFF; no money out or production connections used.

- **V-4b1 encrypted TEST forwarder store (as-if-merged):** additive dev_forwarders Postgres table, per-account encrypted-only signing-secret envelope, immutable retry key/config digest, safe list/get projections without secrets and soft deletion so removed targets cannot deliver. One migration only; no public tool or actual outbound request in this slice. V-4b2 next: guarded TEST registration/list/deletion plus owner-authenticated setup-page one-time secret; V-4c: actual original Stripe Event forwarding over pinned TLS with no redirects. V-3 Checkout manual TEST completion remains acceptance evidence to collect; no LIVE/money-out changes.

- **V-4a forwarding security (as-if-merged):** bounded TEST-only Stripe webhook signing helper uses raw original event JSON bytes, timestamped HMAC-SHA256 verified by official Stripe SDK; outbound target preflight rejects non-HTTPS, private/loopback/metadata, query/auth/fragment, untrusted ports and DNS with **any** non-global IPv4/IPv6; resolves once to a pinned TLS destination. No network requests, persistence, tools, LIVE or money-out changes in this slice. Next V-4b durable account-scoped encrypted forwarder CRUD and owner-authenticated one-time setup-page signing secret, then V-4c bounded actual signed delivery with no redirects or DNS re-resolution.

- **V-3c3d actual Stripe-hosted TEST Checkout (as-if-merged):** real checkout.session.completed now uses a synthetic TEST $36 one-time price and customer plus native Checkout Session. Stripe has no Session.complete endpoint: dev_get_checkout_test_url returns the exact run-owned TEST hosted URL, a human/test browser submits a test card, and dev_trigger_event retry verifies Stripe's paid/complete session, original succeeded fully paid PI and independently listed/retrieved original Event before completion. Until real hosted checkout action, run is pending. Cleanup may expire only open run-owned sessions. V-3 feature coverage checkpoint requires genuine TEST manual checkout demonstration; V-4 next after review. LIVE and money-out unchanged.

- **V-3c3c genuinely failed TEST invoice (as-if-merged):** invoice.payment_failed uses a run-owned synthetic customer, non-auto-advancing charge_automatically draft and one independently read/recorded 3600-cent USD invoice item. After native no-auto finalization it attempts one payment via pm_card_chargeCustomerFail; only retrieved open/attempted unpaid $36 invoice and independently observed/retrieved Stripe Event can complete, delayed events remain running. Item/failure evidence retained by V-2 cleanup. Next V-3c3d genuine Checkout completion lifecycle then V-4. No LIVE/money-out changes.

- **V-3c3b real TEST dispute event (as-if-merged):** charge.dispute.created from a genuine pm_card_createDispute TEST $36 payment. Exact run-owned customer/PaymentIntent and provider-linked charge independently verified; async dispute discovered only through Stripe disputes.list filtered by charge and disputes.retrieve, retained in scoped ledger with immutable charge/evidence. Independently list/retrieve matching Event with real du_ object, charge/PI, amount, TEST and account. Missing dispute/event stays running, no fake success; next V-3c3c real invoice.payment_failed and Checkout completion. No LIVE or money-out controls changed.

- **V-3c3a genuine declined TEST payment intent event (as-if-merged):** guarded native payment_intent.payment_failed performs an idempotent synthetic TEST decline only after creating, independently reading and durably recording the exact unconfirmed $36 PaymentIntent. A Stripe decline error alone never proves failure; requires_payment_method, card_declined, zero received amount, customer/account/run provenance and matching list/retrieve Event evidence must be independently observed. Next V-3c3b real failed invoices/disputes and genuine Checkout completion path; V-3 remains in progress. No LIVE, money-out or owner-policy changes.

- **V-3c2 real zero-value TEST invoice event PR #62 (as-if-merged; exact-head CI/review pending):** invoice.created, invoice.updated and invoice.finalized are emitted by real current-native TEST invoice creation, safe description edit and non-auto-advancing finalization. Tracked customer and 0 USD invoice must be independently verified and metadata owned; Event list and retrieve must confirm exact type, ID, run, selected account, 0 amount and valid status. No card/bank collection, no emails, no payout/refund. V-3c3 genuine failed billing/dispute/Checkout next; LIVE off and owner financial controls unchanged.


- **V-3c1 native TEST subscription lifecycle events PR #61 (as-if-merged; exact-head CI/review pending):** Real customer.subscription.created and customer.subscription.deleted events from 7-day trial subscriptions using verified recurring TEST price/customer and durably tagged provider-generated zero-dollar invoice. Only independently observed Stripe Event with matching subscription/account/run/customer/price and correct trialing/canceled state completes. Cancellation creates no final invoice, charge, refund or payout. V-3c2 billing/dispute/Checkout events remain; V-4 follows V-3. LIVE OFF, $500/day and independent owner money-out approval unchanged.


- **V-3b genuine TEST update/cancel event PR #60 (as-if-merged; exact-head CI/review pending):** Added customer.updated, product.updated, price.updated and payment_intent.canceled by actual native Stripe TEST mutations on tagged, run-owned source objects. Mutations are idempotent and independently read back, and emitted Events must match actual post-mutation attributes, selected account, rtc_run and exact provider IDs. Unconfirmed synthetic TEST PI cancellation never cancels processing or paid intents. V-3c harder subscription/billing/dispute/Checkout event flows remain; V-3 stays IN_PROGRESS. LIVE OFF, independent money-out approvals unchanged.


- **V-3a genuine TEST event triggers PR #59 (as-if-merged, exact-head CI/review pending):** Native dev_list_triggers and guarded dev_trigger_event expose only four implemented real Stripe event actions: customer.created, product.created, price.created and payment_intent.succeeded. Each source object is created and independently read, tagged and durably run-tracked; Stripe Event must be independently listed and retrieved with matching TEST account/object/run/amount before marking completed. Delayed event means an incomplete resumable run, never fake success. V-2 cleanup recognizes immutable event ledger IDs and retains them. V-3b additional genuine billing/dispute/Checkout events follows; V-4 only after V-3 completion. LIVE OFF; money-out controls unchanged.


- **V-2b safe TEST seller/clock cleanup #58 (as-if-merged, CI/review pending):** TEST Express seller deletion requires verified inactive charges/payouts, incomplete onboarding and zero connected-account balances. TEST clock deletion requires all run-owned customer/subscription rows cleaned plus no attached customers on Stripe. A delete receipt is not enough; require independent tombstone or exact 404 resource_missing before marking ledger cleaned. V-2 closure pending; V-3 event triggers next. LIVE off; owner-approved money-out limit unchanged.


- **V-2a TEST cleanup PR #57 (as-if-merged; exact-head CI/review outstanding):** dev_cleanup uses only account-scoped ledger IDs, verifies every TEST provider object and run provenance before mutation, then independently verifies eligible cancellation/void/archive/delete actions and marks only exact DB rows cleaned. Per-object retained/uncertain results protect paid invoices, refunds, succeeded payments, TEST clocks and Connect sellers. dev_reset_test_data supplies owner-guided Stripe Dashboard steps, not a false reset. V-2b dependency-aware cleanup follows; LIVE off and independent owner approval rules untouched.


- **V-1b4f TEST Connect onboarding PR #56 (as-if-merged, exact-head CI/review outstanding):** Native TEST-only dev_connect_readiness independently probes selected platform identity and Connect account listing. New marketplace-onboarding seed creates real tagged TEST buyer/catalog and Express seller account records only when Connect is available, verifies all objects/transfer capability state, tracks every provider ID for future cleanup, and creates no charges, transfers, payouts or application fees. Seller onboarding is NOT declared complete; money-out still requires independent owner authorization. Next: V-1 acceptance/remaining gaps, then V-2 cleanup, V-3/V-4/V-5.


- **V-1b4e guarded synthetic ACH confirmation PR #55 (as-if-merged; exact-head CI/review pending):** Added TEST-only dev_confirm_seed_ach for precisely run-owned unconfirmed bank intents, with audited preview/confirm, Stripe-native idempotent confirmation, independent status/cents/customer checks, and bounded exact payment_intent.succeeded event matching in dev_verify_outcomes. No bank settlement claimed, no LIVE, owner-approved money-out rules unchanged. V-1 remaining: capability-gated TEST Connect marketplace, then acceptance/cleanup.


- **V-1b4d real TEST past-due subscription seed PR #54 (as-if-merged, exact-head CI/review pending):** New resumable clocked 7-day trial and failing-card renewal scenario. An advancing clock or merely chosen decline card NEVER completes a run; it finishes only after true provider past_due and attempted unpaid latest invoice, tagged and durably recorded. Exact RTC DEV RUN clock names replace unavailable TestClock metadata; all other objects use rtc_run. Still required before V-1 acceptance: real controlled ACH transition evidence and Connect capability-gated marketplace. V-1 IN_PROGRESS, LIVE OFF.


- **V-1b4c TEST clock prerequisite PR #53 (as-if-merged; exact-head CI/review pending):** TEST-only testclock_list/create/advance now use actual Stripe clock API; a clock advance is NOT declared completed until independent provider read-back says ready at the exact target. Guarded writes, RTC DEV clock provenance and a bounded read showing advancing target are included. This brings only a required V-5 dependency forward, not full V-5 completion. Next V-1b4d real subscription past_due renewal, ACH progression and Connect-gated marketplace; V-1 remains IN_PROGRESS, LIVE OFF.


- **V-1b4b1 paid active TEST subscription PR #52 (as-if-merged, exact-head CI/review pending):** dev_seed adds tagged monthly paid active subscriptions with synthetic saved TEST Visa and a real, independently provider-verified first paid invoice, recorded by ID in the account-scoped ledger. Stripe's initial-payment failure does not prove past_due; V-1b4b2 still needs actual later failed renewals via supported TEST clocks, ACH progression and Connect-gated marketplace. V-1 remains **IN_PROGRESS**; LIVE OFF; no real payments.


- **V-1b4a outcome verification PR #51 (as-if-merged; exact-head CI and review pending):** New TEST-only read `dev_verify_outcomes` independently compares account-bound recorded dispute/ACH payments with Stripe intents/charges and, for disputes, matching actual TEST event records. It cannot claim a missing event never occurred or a PaymentIntent success proves bank settlement/webhook delivery. V-1b4b still requires real active/past-due subscriptions and supported ACH/clock/event progression, plus Connect-gated marketplace. V-1 remains **IN_PROGRESS**; do not start V-2 as completed V-1. LIVE OFF, financial approval/limits unchanged.

- **V-1b3 dispute/ACH test fixtures PR #50 (as-if-merged; exact-head CI pending):** `dev_seed` can create a documented dispute-triggering TEST card payment and an unconfirmed ACH-capable test intent, each tagged `rtc_run`, provider-checked and saved by account. An asynchronous dispute event or bank settlement is explicitly **NOT** declared complete; V-1b4 requires verification and realistic active/past-due subscription flows before V-1 acceptance. LIVE remains OFF.

- **V-1b2 TEST store refund companion PR #49 merged (exact-head green c9bb77a; merge 0986362):** new `dev_seed_refund` resolves a completed synthetic store run's exact charge and remaining cents from Stripe; never refunds automatically. Every refund requires independently authenticated one-use owner approval even below $500, shared per-account Colorado-day cap, extra owner override if over limit, idempotent native refund, and independently verified run ledger entry. Remaining V-1b3: dispute, ACH, active/past-due subscription scenarios. LIVE OFF, no real account activity.

- **V-1b1 TEST scenario expansion PR #48 merged (exact-head green 3eabdf9; merge 83d5a80):** tracked `basic-store` TEST one-time USD payment intents and two free-trial subscription outcomes (trialing/canceled). Exact type/customer/amount/status/rtc_run provider read-back and account-scoped ID ledger; descriptions limited to safe named plans; no automatic refunds or LIVE use. Existing V-1a catalog plan hash preserved. Next V-1b2 handles remaining refunds (separate owner money-out approval), dispute, ACH and past-due simulations. V-1 is **not** yet complete.

- **V-1a tracked TEST seed runs PR #47 merged (exact-head green 60aa96d; merge 53fddc7):** `dev_seed` TEST `catalog-starter` creates tagged products, USD recurring prices, and synthetic customers; every Stripe object receives an independent read-back and durable `dev_run_objects` ledger entry. `dev_list_runs` is account-scoped, with two additive DB tables and stable idempotency. V-1b must finish payment/refund/subscription/dispute/ACH scenarios before V-1 is complete; later V-2 cleanup will only use recorded IDs. LIVE remains OFF. No remote account used.

- **D-5c credit notes PR #46 merged (exact-head green bcd22f8; merge 4aecc99):** native TEST credit note list/get/preview, guarded create and void, exact preview allocation and invoice/customer verification, authenticated single-use owner approval for EVERY credit note issuance (including customer-balance credits and unpaid-invoice reductions), account-shared $500/Denver-day limit and independent over-limit override. The tool refuses unverified refunds and voiding refunded notes. Next **Batch V: V-1 developer TEST seeding and tracked runs** after #46 green and merged. IN-06 LIVE stays OFF.

- **D-5b invoice lifecycle PR #45 merged (exact-head green 979ca48; merge db4b7b2):** seven TEST native lifecycle writes (delete draft, finalize, send test event, charge open invoice, mark paid outside Stripe, void, mark uncollectible). Each uses verified Stripe state/balances, guarded preview/confirm, stable idempotency, app ownership restriction and independent read-back; incoming charges use a money-in spec and cannot spend the owner's outgoing allowance. TEST invoice.sent does not deliver real email. Next **D-5c** credit notes. LIVE remains OFF; no real account is deployed.

- **D-5a #43 merged (exact-head green c893d78; merge 90a49c0):** five native TEST invoice reads and five guarded manual draft workflows; all five have real-handler seven-case contract tests, pinned SDK stripe-mock, and conservative draft accounting gates. Next: **D-5b** invoice lifecycle, then **D-5c** credit notes. LIVE remains OFF.

- **D-4 merged in implementation PRs #40 and #42:** all 21 current-native TEST subscription, item and schedule tools. Seven D-4b guarded writes now have real-handler contract tests, pinned Stripe SDK mock coverage, current-phase preservation, app ownership enforcement and per-transaction owner consent for credit outcomes. **Next: D-5** invoices/credit notes after green #42 merge. LIVE remains OFF.

- **D-4b PR #42:** all seven guarded item/schedule writes validated, with exact-head CI, app ownership and owner-consent regression evidence, and a self-review. Next D-5 invoices and credit notes.


- **Owner decision (IN-12 answered):** old toolkits are *only* historical feature-completeness references. Build the full current native Stripe MCP, **without** legacy names, aliases, adapters, old-agent integration or retirement/relay work. X-3 and the legacy name-map deliverable are removed from Batch X, the plan and work index; decision is recorded in `docs/DECISIONS.md`. No reduction to current feature coverage.

- **Batch C / C-1 + C-2 (#36 merged):** compact Stripe-object summaries, safe dotted fields (including list items), stable refresh-safe private 24-hour result handles, 8 KB output cap, actual tokenizer-based listing/schema budgets, progressive tool search/describe/call, read-only batch execution, and compact/catalog profiles. Unit, isolated PostgreSQL, mock and full CI passed at prior head 35c4275; exact-head checks required for final docs/pagination commit. No Stripe provider writes or LIVE activation.

- **B-8c2 merged (#35):** carries B-8c1 (#34 merged), adds private two-stage owner consent for each exact TEST transaction and a separate password-authenticated owner over-limit override. New one-use decision intents bind Stripe-derived request identity. No LIVE money-moving tool is exposed; TEST refunds are guarded by the owner grant and account-wide limit. Unit, disposable PostgreSQL, mock and repository CI passed at reviewed head 27fd5de; owner-authenticated transaction consent is now code-complete, but provider money tools and LIVE remain OFF.
- **Last merged:** #39 D-3 hosted Checkout and portal, #38 D-2 TEST payments/refunds, #37 D-1 native TEST customer tools, #36 complete Batch C, #35 independent TEST owner consent, #34 provider-bound private money inbox (`d7df84f`), #33 owner money cap, #32 default
  account, #31 OFF-only LIVE disable, #30 revoke, #29 TEST permission
  re-probe, #28 scoped reads; B-1–B-7 completed.
- **D-1 merged (#37):** 17 current-native TEST customer tools, approved and tested, with no old-toolkit compatibility.
- **D-2 merged (#38):** 19 TEST-native payment/refund/setup tools; money approval and full CI verified.
- **D-3 merged (#39):** 16 native TEST hosted Checkout/payment-link/portal tools (7 safe reads, 9 guarded writes), server-approved redirects, no client secrets; nine-write contract suite, mock and full exact-head CI passed. Portal create verified through returned session and read-back of portal configuration. **Next D-4 subscriptions and schedules.**
- **IN-05:** $500 USD/account/Colorado day shared across AI connections,
  all money-out separately owner-approved, above limit a second override.
  **IN-06 remains OFF.** 27 guarded TEST-only customer/payment/hosted write tools exist in code, including exact-owner-approved refund operations. No LIVE credentials, real provider money movement, paid infrastructure or operational deployment.
- **Ordered batches:** A → B → C → D → V → G → H → P → W → U → R → E → X.

## Superseded historical branches

- `ai/gpt6/b-8c2a-owner-money-consent` at `6c5d868` is an unmerged duplicate of the older owner-consent implementation (no PR). It was compared to merged B-8c2 #35: **do not merge**; #35 implements a stronger per-request grant plus separate over-cap confirmation. GitHub branch deletion is still pending because the connected GitHub tools do not expose delete-ref. The branch is not a prerequisite for D-1.

## Environment

- Repo: `Robinson-AI-Systems/stripe-mcp`, default branch `main`. CI validates docs, secrets, tests with throwaway PostgreSQL and stripe-mock (PR #9). The first commit (this plan) went straight to `main`
  because the repository was empty; every later change goes through an `ai/*` branch and a PR.
- Vercel project, Neon database and Stripe test keys: not created yet (IN-02, IN-03, IN-04).

## Recent merges (newest first)

**2026-10-10 — CI cadence (docs + CI config PR, by Claude):** SESSION-START §6 rule "one complete CI run per fix batch"
(never push while the PR's run is in progress); CI now cancels an obsolete PR run when a newer push arrives. Next action
unchanged.

**2026-10-10 — #30 B-8b2a private connection revoke:** protected owner
preview and final consent, expiring one-time intent, atomic account/client
token revocation and audit. Does not expose a public AI write operation.



**2026-10-10 — B-8b1 TEST-only permission re-probe (PR #29, pending final merge):**
 server-owned lazy encrypted TEST-key use, safe Stripe read list probes, stored
 verified permission results; no credential disclosure or LIVE access.

**2026-10-10 — B-8a read-only account tools (#28):** scoped audit and
 connection summaries, daily shared budget status and Dashboard guidance;
 8 KB response ceiling and paged result tests verified.

**2026-10-10 — B-7 write declarations (#27):** CI checks explicit read/write
 classification, confirmations and provider-derived money-spec metadata.

**2026-10-10 — B-6 profiles (#26):** filtered discovery and direct-call
 authorization; read_only and all current exposed tools remain non-writable.

**2026-10-10 — B-5 result shaping (#25):** additive dollar/currency formatting,
 Denver-local timestamps, redaction and explicit LIVE labeling.

**2026-10-10 — B-4 readable errors (#24):** safe Stripe SDK error explanations.

**2026-10-10 — B-3 app record guard (#23):** metadata ownership, missing parent
 records fail closed, refund exception does not bypass monetary owner approval.

**2026-10-10 — B-2b/B-2a LIVE guard (#22/#21):** default-deny LIVE boundary,
 expiring owner intent, protected setup form, atomic audit; live mode remains OFF.


**2026-10-10 — B-1b2 owner-approved policy and guarded write foundation (PR #20):** internal seven-case write contract and Stripe-derived USD preview; account-wide, cross-connection $500 cap; owner-approved one-use request required for every money-out; separate auditable over-limit owner action; atomic PostgreSQL reservation; rejected-versus-uncertain outcomes. Exact-head CI verified; no money-moving tool exposed. Owner browser approval B-8 and live enable IN-06 remain off.

**2026-10-10 — B-1b1 money reservation ledger (PR #19):** one additive table and database-serialized account lock for per-connection money-out reservation in America/Denver days. Conservative uncertain/confirmed statuses count against usage; no money operations exposed. B-1b2 follows.

**2026-10-10 — B-1a guarded write engine (PR #18):** internal-only, TEST-mode preview/confirm/idempotency/read-back audit, denial for missing audit or unsafe connection. No money write allowed. B-1b still needs concurrency-safe money rule and IN-05.

**2026-10-10 — A-6 deployment guide (PR #17):** docs/DEPLOY.md explains private Vercel/Neon setup, personal credential handling, restricted key templates, test-only setup page, OAuth connection and verification. No environment or Stripe account modified.

**2026-10-10 — A-5b owner setup (PR #16):** protected key-entry page, 15-minute login lockout, CSRF and origin checks, Stripe permission probes, single-view secret page and first two guarded read-only MCP account tools. No real key has been entered or live mode enabled.

**2026-10-10 — A-5a encrypted credential primitives (PR #15):** AES-256-GCM encryption with no plaintext fallback, verified test-key persistence and atomically single-use secret records, with fake and real isolated Postgres tests. The authenticated setup page is still A-5b; nothing deployed.

**2026-10-10 — A-4b OpenAPI source (PR #14):** byte-exact Stripe v2556 SDK OpenAPI, pinned and verified against published Git blob SHA-1, bounded operation lookup and unit tests; stored as 23 immutable parts due provider API upload size. Next A-5.

**2026-10-10 — A-4a Stripe client (PR #13):** official SDK at API 2026-09-30.endive, stable scoped idempotency, bounded paging and preview live-key refusal. A-4b still owns vendored operation description.

**2026-10-10 — A-3b OAuth connector (PR #12):** personal persistent refresh, authorization page, MCP endpoint and metadata; full login behavior tested in unit and PostgreSQL. No live Stripe credentials configured.

**2026-10-10 — A-3b connector (PR #12):** auth page, OAuth registration/code/refresh, metadata, MCP bearer guard, personal persistent refresh authorization. No live keys, no money movement. Next A-4.

**2026-10-10 — A-3a primitives (PR #11):** core token-hashing, PKCE, IP/login lockout and hashed OAuth database methods, real-PG rotation tests. The connector endpoints are deliberately A-3b; do not claim A-3 complete.

**2026-10-10 — A-2 database schema (PR #10):** seven foundation tables and six indexes defined additively in code, tested only on throwaway PostgreSQL; no Neon database created and no Stripe records touched. Next A-3.

**2026-10-10 — A-1 foundation (PR #9):** Node ESM registry, test-only Stripe fake, disposable Postgres adapter, secret scan, docs and budget checks, four CI gates and single `ci` merger. No Stripe requests against real accounts.

**2026-10-10 — Review fixes (docs PR #8):** two gaps found by an automated review of the Workspace server's plan,
applied here: a login refresh keeps account, mode, profile and listing (A-3); the per-pass rate limit is stored per pass
and counted in a shared Postgres table with an atomic update, tested with overlapping requests across two instances
(R-2). Next action unchanged: A-1.

**2026-10-10 — For account owners too (docs PR):** G-6 owner and administration; every dashboard setting covered as a
real tool or a guided setting; audience tags.

**2026-10-10 — General development tool (docs PR):** Batch V developer tools added; test clocks moved from E; project
profiles made optional and general; Appliance Desk framed as an example and completeness check.

**2026-10-10 — Hub architecture (docs PR):** Batch R now provides only the Robinson Tool Contract doors (passes, HTTPS
API, manifest, conformance); CLI, relay and recipes moved to Robinson's Toolkit. Contract-generic code goes in `src/core/`.

**2026-10-10 — Owner answers recorded (docs PR):** IN-00 approved, IN-01 public / no automated review; designs
marked APPROVED; A-1 READY; review rule changed to self-review in AGENTS and PLAYBOOK.

**2026-10-10 — Plan written (initial commit):** AGENTS, START-HERE, SESSION-START, PLAYBOOK, drift protocol, PLAN,
MASTER-ROADMAP, 12 batch designs, TOOL-CATALOG (283 hand-built tools + 4 universal), Appliance Desk project profile,
owner inputs, go-live checklist, decisions, roadmap, work index with validator, first card A-1. The earlier plan version
is archived in `docs/archive/plan-v1/`.

## Blocked

Engineering can continue B-8b2/B-8c with TEST fixtures. Deployment needs IN-02–IN-04; live activation IN-06 is not approved. The owner-approved money policy IN-05 does not activate money movement. Other owner inputs remain scheduled for their applicable batches.
