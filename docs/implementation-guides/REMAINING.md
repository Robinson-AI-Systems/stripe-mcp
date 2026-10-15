# Remaining approved work — routes for JIT packets

Baseline #93; this is **guidance**, not a reordered queue or executable future cards. Reconcile against STATUS,
`work-index.json`, PLAN acceptance and each design's §0 before starting. Existing paths below are code; all new module,
table or test names are **proposed** until a JIT card inspects real predecessors. Split large units by PLAYBOOK size/risk.
Use RECIPES for shared validation; add the area's unit, stripe-mock and DB files when its card makes them real.

## G — finish account operations

| Unit / design heading | Existing integration and proposed work | Mapping / fixtures / inheritance |
| --- | --- | --- |
| G-2d / G4 disputes | Existing `dispute-evidence-draft.js`, `dispute-reads.js`, `money.js`, DB owner grants. Proposed `dispute-finalize.js`. Detailed packet: G-2d-WORKED-EXAMPLE | Submission → disputes.update `{submit:true}`; acceptance → disputes.close. Distinct previews, independent retrieve, irreversible/no inverse. Acceptance grant binds dispute ID and disputed amount. Draft never submits; successor inherits tested terminal operations |
| G-3 / G-3 Radar and Identity | Native module pattern, `client`, projections, `defineWrite`; proposed `risk.js`/writes split and `identity.js` | Verify exact Radar review/value-list and Identity SDK methods first; rules have no assumed endpoint. Fixtures: open/closed review, value list pagination, missing permissions, Identity secret sentinel. Read summaries only, never verification client_secret or identity document bytes. Gate any financial effect through existing money rules; G-4 inherits registry/safety metadata |
| G-4 / G2–G3 + G-4 | `dev-forward-events.js`, `dev-forwarders.js`, `core/one-time-secrets.js`, private setup and `meta.js`; proposed native event/webhook modules | endpoint URL/events → pinned SDK payload; add/remove events = read current → union/difference → update → retrieve exact set. Fixture `[invoice.paid] + customer.updated` retains existing event; removing absent event is safe. Create secret only to private one-time handoff; result/audit never raw secret. Signed original TEST replay remains distinct from native webhook administration |
| G-5 / G5 and G-5 | `money-schedule-write.js`, `money-bank-reads.js`, `server.js` setting map; proposed account-settings module | Argument → exact nested settings/config field, preserve unrelated values. TEST own-account refusal → `done:false` + guided steps; later read proves change, not owner assertion alone. ACH/config/domain fixtures allowed/denied/unreadable; bank numbers never arguments. H inherits per-setting API-vs-guided evidence |
| G-6 / G6 and G-6 | `server.js` (`stripe_where_is_setting`), permission/connection readers, existing projections; proposed admin module | Map observed setting → ok/needs_attention/not_readable + `{setting,url,steps,expected,verifyWith?}`. Every verifyWith must name registered real reader. No API for key creation/team/closing assumed; closing steps only. Fixture permission refusal is unreadable, never healthy. Complete PLAN evidence and drift C before H |

## H and P — branding and project knowledge

| Unit / design heading | Existing integration and proposed work | Mapping / fixtures / inheritance |
| --- | --- | --- |
| H-1 / H1–H4, §2/§4 | Existing `checkout-writes.js`, `file-links-write.js`, `evidence-upload.js` network pattern, `src/db.js`. Proposed brand modules and `brand_kits` | Account/mode → brand_kits PK; named kit settings → verified `branding_settings` for server-created pages, explicit call overrides win. Purpose must change to verified logo/icon, not reuse evidence upload unchanged. Non-square icon/invalid descriptor denied before upload/update; refusal returns guidance. Existing app-created pages untouched. Test kit + override + repeat run; P/W inherit applied-kit helper and exact ownership boundary |
| P-1 / P1–P3, §2 | Existing `app-guard.js`, `src/db.js`, APP-NEEDS-APPLIANCE-DESK. Proposed known_apps accessors/profile seed | `metadata_keys`, stripe_accounts and active status → per-account ownership resolver. Two profiles/account, unrelated account, inactive/no profile, parent-only marker. Trace each seed key/event to source file; no real account IDs committed. Guard semantics drift needs reviewed amendment; P-2/3 inherit schema/resolver |
| P-2 / P-2 | Existing result shaping + P-1 real resolver; proposed record-link helper | metadata key/value → profile record_links template and base_url. Encode identifier, bounded URL, no arbitrary secret value substitution. Fixture missing key yields no link; two profiles use correct owner link. P-3 inherits safe link projection |
| P-3 / P4 | Existing guarded dispatcher + shipped G/H modules; proposed readiness workflow | Each of 21 profile rows → observed/fixed/needs-you/decision. Missing 2 webhook events → union only after confirm + read-back; portal cancellation enabled → exact fix; owns_catalog → 0 product/price/tax mutations. Unknown/unreadable ≠ passed. No inline Stripe writes; P-4 inherits per-row observations and guarded fixes |
| P-4 / P5–P6 | P-3 readiness + actual catalog primitive coverage (check before coding); proposed draft/setup workflow | Findings → draft profile and APP-NEEDS text, never fetch or commit other repos. Project without owns_catalog → lookup-key reuse; second run 0 duplicates. Unknown event type reported. **Dependency to reconcile JIT:** native E catalog is later; use a shipped approved primitive or deliver approved area prerequisite first per W stop rule, never secretly inline provider writes |

## W — workflow packets (design §4)

All workflows call **wrapped registry handlers**, not Stripe directly. Existing dispatcher/meta tools are the reuse
point. A time-budget helper is **not established by the target design**: inspect shipped code, then propose its path
in the first W card. 50-second budget returns partial observations plus continuation, not completed claims.

| Units | Mapping and deterministic fixtures | Completion / inherited facts |
| --- | --- | --- |
| W-1 money snapshot | Balance transactions by Denver calendar window, separate currency sums. MRR fixture: quarterly USD 3000 cents × quantity 2 × 80% = 1600 cents/month; yearly EUR 12000 = 1000 EUR cents/month, never combine. Trials separate; metered/tiered excluded and explained | Empty, 2 pages, interval_count, discount duration, DST boundary and budget exhaustion. Subsequent workflows inherit time/paging/currency conventions |
| W-2 failed payments/customer overview | Existing invoice/payment/customer projections → readable decline/retry + verified hosted invoice link + P record link | No inferred retries from absent provider data; empty/declined/app-owned/2-page fixtures |
| W-3–W-5 refund/cancel/change | Existing payment_create_refund, subscription cancellation and billing_preview_change → plan of exact IDs/cents/prorations | Ambiguous customer match refuses; no confirm → 0 writes. Each optional refund still independent owner grant. Partial multi-action result records only verified children; not one blanket money approval |
| W-6 dispute kit | P metadata links + G-2 verified draft tools → receipt/agreement references and missing evidence list | 0 submit/accept from assembling kit; deadline shown, inaccessible agreement reported. Inherits G-2 no-private-evidence output rules |
| W-7–W-8 webhook health/go-live | G webhook readers + P readiness → per-profile required event sets / TEST-LIVE comparison | Missing 2 events repaired exactly; unknown account unreadable, no implicit live writes/catalog copy for owns_catalog. IN-06 still owner gate |
| W-9 month close/catalog/find | Existing reports/export + eligible catalog primitives → private browser export handoff and lookup-key plan | Existing G-1 export streams only to owner browser; never invent CSV URL. Reconcile older W design's “download link” wording to this security boundary. Find pagination and multi-currency close fixtures |
| W-10 brand business | H kit/settings/page tools → per-item observed/fixed/needs-you | Second run changes nothing, finishes with verified TEST Checkout link; no changes to pages the app owns |

## U, R, E, X — complete coverage and doors

| Unit / design heading | Existing integration and proposed work | Mapping / fixtures / inheritance |
| --- | --- | --- |
| U-1 / U1–U6 | Existing `scripts/stripe-openapi.mjs`, SDK client, `meta.js`, guards/money. Proposed `src/tools/universal.js`, `src/stripe/openapi-index.js`, money-operations and hand-built-map | operationId → exact pinned method/path/schema → rawRequest only after version/idempotency proof. Unknown params/money-like unclassified operation refused or gated per design; known native refund redirects to payment_create_refund. Store fixture operation set/seed for deterministic 25 GET/10 POST mock tests; don't use nondeterministic random coverage. Exact guard/read-back mapping required per allowed write |
| R-1 / R1, §2 | Existing core OAuth/hash/revoke/one-time secrets and DB; proposed pass handlers | kind/pass fields → hashed token row, defaults TEST/read_only/24h/$0/no writes. 365 days only for_hub choice. One-time secret, expiry/revoke and indirect-write refusal tests. No hub runtime dependency; R-2 inherits token-to-connection resolver |
| R-2 / R2, §2 | Existing registry/dispatcher/result store; proposed api/tools, results, whoami, contract endpoints and shared rate_limits | Pass row → mode/profile/areas/allow_writes; connector bearer not a pass. 150 concurrent requests on 2 instances → exactly 120 pass/30 rate_limited with Retry-After; configured 5 → sixth denied. SQL atomic increment, never read/update or memory counter. Envelope/≤30 OpenAPI ops/counts real-registry fixtures |
| R-3 / R3 | Existing full CI and door tests once R-2 ships; external hub conformance package only if available | Contract version/package verified at start. Local fake-provider conformance participates in ci; absence recorded and local equivalent coverage retained, never blocks standalone server per approved R3 |
| E-1–E-2 / E1–E3 | Existing dev-seed SDK catalog patterns + P ownership resolver; proposed catalog/promotion modules | Price lookup_key reuse; update only mutable nickname/key/metadata/active. Provider read-back exact fields; app-owned catalog/tax changes refused; nonowned warning. Coupon amounts/currency, entitlement paging and duplicate lookup fixtures |
| E-3–E-4 / E4, §4 | Existing U validation/native write pattern; proposed meters/tax/quotes modules | Published meter events only, no legacy usage records. Credit grants/financial quote actions require provider-derived classification, not name-based “non-money”. Missing entitlement/permissions → unavailable, never invented tax total. Fixtures duplicate meter event, wrong currency, immutable field, quote lifecycle; exact pinned mock request per method |
| X-1 / X1 | Existing change_log/inverse and dispatcher; proposed undo tool | change ID → stored inverse → wrapped handler with preview/confirm. Irreversible money/deletion/submission refuses; no direct SDK bypass. Metadata restore fixture and undo-of-undo verify exact read-back |
| X-2 / X2 | Existing registry/read schemas and TEST guard; proposed scripts/smoke-readonly.mjs | Required args need account-specific owner-supplied TEST fixtures; do not guess IDs or invoke writes. Reject LIVE before requests. Audit names every read tool, passed/gap + reason; real smoke requires connected TEST account, simulation cannot replace it |

At each batch closure reconcile PLAN item by item, then run drift C. Carry exact exports, fixture paths, unresolved
provider restrictions and owner smoke evidence into CHANGES-SINCE-DESIGN or the eligible successor card. Future paths
in this table are suggestions; only actual shipped code becomes an inheritance guarantee.


## Concrete implementation contracts — owner-requested review, October 14, 2026

The owner requested the same implementation detail across all six active MCP
repositories, specifically for Sol 5.6. This section fills routine design details
inside the approved roadmap. It is a design supplement, not another roadmap,
process, new countable subsection or claim that code/acceptance is complete.
Existing cards/public schemas and later owner decisions win over historical
recipes; reconcile mechanical drift with current main before coding. Do not
replace working code simply because a proposed filename below differs.

### Shared input, state and result contract

- Freeze the existing subsection IDs and complete scope first. In the current
  card, list each public tool from TOOL-CATALOG, its exact schema, the existing
  wrapped handler/client export and the corresponding provider operation. A
  future path below is proposed until it exists. Build the complete coherent
  outcome; do not publish one helper as a completed subsection.
- Keep public ABI compatibility. For new compound implementations use an internal
  plan `{operation, account, mode, target, steps}`. Each ordered step has a stable
  `id`, exact wrapped `tool`, validated `args`, before-state requirements,
  intended after predicate and inverse-or-reason. Account/mode come from trusted
  context, never caller-supplied credentials. Translate these internal records
  into the existing public tool schema; do not invent a second external envelope.
- Explicit IDs beat free-text guesses. Resolve friendly names with authorized
  reads; zero matches is missing, multiple matches requires disambiguation.
  Reject unknown fields/enums and conflicting targets before dispatch. Omitted
  means retain; explicit empty/false/null clears only where the provider supports
  that operation. Whitelist path/query/body fields; never forward local safety,
  pagination/presentation or request-key arguments into provider payloads.
- A new workflow's observable details use ordered per-step rows with stable IDs,
  target, outcome, safe reason and provider/audit references when actually known.
  Outcomes distinguish `planned`, `refused`, `confirmed`, `unverified`, `failed`,
  `unknown` and `not_attempted`. Aggregate success requires every required step
  to be confirmed; optional unavailable items remain explicitly unavailable.
  An HTTP 200/202/204 or an outer `done:true` alone is never provider confirmation.
- Preview validates the entire plan and uses child `dryRun:true`; provider writes
  are zero. Existing preview audit logging is allowed. Execution requires the
  original operation-specific confirmation/owner authority; a single workflow
  confirm never creates financial, access or production authority. Recheck
  mutable target/protection/account state before each dependent write.
- Execute dependent steps in order. Persist existing run/replay checkpoints
  before/after ambiguous effects where the approved design requires durability.
  A failed dependent step stops its descendants; untouched rows are
  `not_attempted`. Independent read sections can continue and return partial
  coverage. No blind retry after an uncertain POST, no automatic rollback and
  no new background scheduler merely to finish a synchronous workflow.
- If a request times out after dispatch, mark its outcome unknown and reconcile
  the original target/request key before resuming. Reuse the service's replay
  mechanism; a second generic UUID is not recovery. Explicit undo only follows
  recorded, still-valid inverses through wrapped tools and fresh guards.
- Bound existing time/page/byte budgets, return an explicit continuation where
  supported and use connection-owned result handles. A cursor/handle is bound
  to account, connection/grant and query; expired/revoked/foreign ones refuse.
  Do not silently truncate and label the result complete.

### Build and prove one complete outcome

1. Read the exact provider operation in the pinned SDK/OpenAPI/GraphQL fixture;
   capture argument → path/query/body → response selector and credential type in
   the current card. Research genuinely changed provider behavior in official
   primary documentation. The owner is not the source for API facts or pricing.
2. Implement normalization/planning, then wrapped apply/readback/intent comparison,
   then all callers, registry, profile/area metadata, summary/output schema and
   documentation. Reuse existing shared guards, clients, secrets and run stores.
   Add SQL only when the existing design actually needs durable new state.
3. Arrange stateful realistic fakes and capture the actual outbound request.
   Required cases: normal/empty/two pages; denied scope/profile/account; omitted
   versus explicit clearing; preview and missing confirmation with zero writes;
   mismatch/unreadable readback; ambiguous timeout and same-key retry; partial
   failure plus untouched descendants; foreign run/handle; budget exhaustion.
   Add the domain-specific cases below. Do not weaken fakes to fit a guessed API.
4. Validate the assembled outcome through every existing direct/broker/HTTP door
   with shared write-contract and provider-shape tests; use disposable Postgres
   for persistence, atomic claims, refresh/revocation and concurrent reservations.
   Run focused checks at meaningful seams, then the full mandatory gates once
   the coherent tree is ready. Record real command results, never assumed green.
5. Keep implementation, automated verification, deployed exact revision and real
   custom-service/provider acceptance separate. Update the existing card/status/
   queue with precise remaining proof. These design documents close no feature
   status and authorize no real account writes, spending or release.

Answered decisions do not require another approval. Missing credentials, actual
tenant/resource identity, independent financial consent and production activation
are still real gates. Build configurable/synthetic paths where permitted; keep
only their dependent execution closed and continue eligible roadmap work.


### Stripe: concrete contracts by remaining approved subsection

Inspected baseline: `e2f443f` (#241). Existing seams: `src/tools/index.js`,
`src/tools/write.js`, `src/core/write.js`, `src/stripe/client.js`, `src/money.js`,
`src/tools/app-guard.js`, `src/tools/result-rules.js`, `src/keys.js`,
`src/acceptance/` and the private owner setup/one-time-secret flow. Keep SDK
idempotency and independently authenticated money approval in these layers.
New workflow/profile/branding files are proposed under `src/tools/`/`src/`;
do not copy historical toolkit handlers or bypass the current registry.

| Subsection | Exact input/result and implementation sequence | Required domain regression |
| --- | --- | --- |
| V-3 | Finish the existing scenario/hosted-Checkout acceptance contract, using original TEST run IDs, owned Event/webhook receipts and existing acceptance runners; pending browser completion is not a new trigger API. Report per scenario created/replayed/provider-verified/cleaned and unresolved exact stage. | Lost response followed by same-key recovery; real signed original Event versus invented event JSON; incomplete browser journey stays pending. |
| G-6 | Compose `admin-overview` and guided settings from exact account/mode reads. One item carries observed value or unreadable reason, expected value and matching real readback tool. Keep operator assertions dated and distinct from API proof. | Denied settings remain unreadable; no broad manual Dashboard checklist replacing the approved exception-based report; account mismatch and incomplete pages. |
| H-1 | Validate kit fields/logo source, preview account versus server-created-page effects separately, persist kit by account+mode, apply only when this server creates Checkout/payment links. Use existing upload/client and public-source restrictions; request exact pinned branding fields, not guessed nested keys. | Non-square icon/invalid descriptor; override beats kit; profiled-app pages untouched; unsupported own-account write returns guided steps with no claimed application. |
| P-1 | Store the approved profile structure from BATCH-P, keyed by project ID with explicit status/account bindings; seed metadata/event facts from APP-NEEDS, private account IDs only via setup. Extend the existing app guard to inspect every active matching profile. | Two apps on one account; no matching profile; draft/inactive profile cannot silently weaken existing ownership guards. |
| P-2 | Build record links only from verified profile base URL/templates and an exact ownership metadata match. Encode substituted identifiers; return link metadata without fetching the app or writing its repo. | Unknown metadata key, missing ID, hostile URL/template or cross-app match produces no invented link. |
| P-3 | `app` or validated inline `spec` plus mode → ordered evidence rows for every required event/payment/portal/key/branding/guided setting. Read first; fixes invoke exact wrapped children, re-read and compare. Independent read-only assessment must work with missing owner decisions. | Fixture covers all 21 existing Appliance Desk requirements, two missing webhook events, inaccessible settings, owns_catalog, partial fix and zero product/tax creation for app-owned catalog. |
| P-4 | Structured project requirements/findings → deterministic setup plan, draft profile and APP-NEEDS text. Resolve lookup keys before create, record exact IDs, create only server-owned catalog and return draft artifacts for the project's agent. Do not let prose infer payment methods or ownership. | Run twice creates nothing new; ambiguous lookup fails; unknown event flagged; draft never auto-activates or commits elsewhere. |
| W-1 | Explicit Denver start/end dates → bounded balance transactions plus active subscription items, separated by currency. Calculate interval_count/quantity/discount-duration-aware MRR; return trials and unsupported usage/tiered components separately. | Quarterly 3000 cents ×2 ×80% =1600 cents/month; yearly EUR 12000=1000 EUR cents/month; DST windows and no cross-currency sum. |
| W-2 | Explicit customer/filter → exact authorized customer/invoice/payment reads, decline reason, observed next-retry date, trusted hosted invoice and P-2 app links. A missing retry timestamp stays unknown. | Duplicate customer names refuse auto-selection; paid versus failed invoice, two pages, permission-denied child leaves other observations. |
| W-3 | Customer/charge selector and amount → disambiguated refundable charge and provider-derived refundable balance → preview → existing refund tool. Record exact grant/account/charge/cents/request key. | Every AI money-out requires distinct owner approval even below $500; exceeding the shared Denver-day limit needs its separate override. Race/refund-already-applied cannot double refund. |
| W-4 | Customer/subscription, now-or-period-end and explicit optional refund/void flags → ordered cancellation/invoice/refund plan. Each refund is independently approved; app-owned constraints still apply. | Failure after cancellation reports actual state and does not repeat it; optional refund absent means zero refund calls. |
| W-5 | Exact subscription/item/new price/quantity/proration choice → existing create_preview result with cents/currency and proposed timing, then guarded update and provider readback. | Changed price/state after preview requires reconciliation; quantity omitted preserved; no inferred refund authority. |
| W-6 | Exact dispute → customer/receipt/invoice/profile agreement references and evidence draft only. Missing evidence is a named checklist; never auto-submit or accept. | Past deadline/inaccessible agreement, secret-bearing Identity data, draft creation with zero submit calls. |
| W-7 | Exact account/mode/profile set → endpoint event coverage and bounded three-day undelivered-event observations. A fix adds only the missing set via existing webhook tools, then retrieves exact membership. | Existing unrelated events survive; wildcard coverage handled as provider specifies; permission failure is not healthy delivery. |
| W-8 | Authorized TEST/LIVE read comparison and per-profile readiness → checklist of observed/missing/unreadable/needs-owner items. Catalog copy only where profile explicitly does not own it. | LIVE gate stays off; no cross-mode copy/write caused by read-only inspection; no production key inferred from TEST credentials. |
| W-9 | Month close: explicit Denver month and per-currency totals, provider report lifecycle and private owner-browser export. Catalog setup: lookup-key plan. Find: bounded authorized type/query selection. | No public export URL or report bytes in tool output; report pending stays pending; rerun reuses lookup keys; two-page find. |
| W-10 | Exact account/mode and kit/profile → ordered per-item branding/settings plan, then guarded changes and verified TEST Checkout link. Unsupported account settings remain needs-you. | Second run makes zero redundant changes; failed setting does not imply kit/profile rollback; app-created pages untouched. |
| U-1 | Exact pinned operationId, path/query/body allowlists and account/mode → known native handler where mapped, otherwise universal operation policy with before/apply/readback. New/unclassified money-like writes fail closed. | Deterministic 25 GET/10 POST shape fixture; unknown parameter, hidden secret, money and app-ownership bypass attempts through universal door. |
| R-1 | Extend existing `rtc-passes`/OAuth/owner flow, preserving current deployed restrictions until separately authorized. Any planned broader profile/lifetime remains a narrowed explicit choice, hash-only storage and one-time display. | Refresh keeps every setting; expired/revoked/foreign account/area refuses; no token bytes in results. |
| R-2 | Reconcile existing RTC routes/client to actual registry aliases, shared SQL rate limit and owned result pages. The old recipe's proposed routes already exist; finish exact missing parity instead of recreating them. | Two instances/150 overlapping requests at120:120 admitted,30 rate-limited; per-pass5 denies sixth; connector token not accepted as pass. |
| R-3 | Current pinned conformance probes against this service's local real HTTP handlers with fake Stripe. Separate reference-runner, service-level, deployed/provider and actual Hub routes. | Deliberately broken auth/result/refresh/rate boundary fails the appropriate probe; no reference-only PASS credited to hosted service. |
| E-1 | Product/price IDs and lookup keys → supported mutable fields only; read existing matches, apply through guarded SDK, retrieve exact state. | Duplicate key, immutable amount/currency change, app-owned catalog refusal; no replacement price guessed. |
| E-2 | Typed coupon/promotion/feature/tax parameters → pinned resource-specific handlers; amount-off requires matching currency and provider constraints. | Expired coupon, missing entitlement, two-page list, conflicting coupon forms; app-owned tax/catalog preserved. |
| E-3 | Exact meter/event/credit-grant inputs → published meter APIs with event identifier/idempotency. Classify financial credits from provider semantics, never from tool name. | Duplicate meter event, unknown meter, monetary grant requires applicable approval; no deprecated usage-record fallback. |
| E-4 | Exact Tax/quote resource and explicit lifecycle action → draft/preview then supported finalization; incomplete provider tax calculation is not a fabricated total. | Missing permission, wrong currency, stale quote and partial lifecycle; every request accepted by pinned stripe-mock contract. |
| X-1 | Owned change ID → stored inverse and current-state comparison → existing wrapped opposite tool. Reject irreversible money/sends/deletes and changed-after-write state. | Undo-of-undo, foreign log ID, lost current state; no direct SDK bypass or automatic compensation. |
| X-2 | Existing read-only TEST identity plus consented exact fixture IDs → inventory every read tool with pass/gap/reason and original source/deployment evidence. | Reject LIVE before any provider request; no invented IDs or mutation; omitted scope is recorded coverage gap. |

### Stripe decisions that remain external

IN-00 approves the plan; the owner delegated this design elaboration. Do not ask
again to implement H/P/W/U/R/E/X. IN-08 retry exhaustion, IN-09 customer email
policy and IN-10 portal policy remain owner-specific Appliance Desk choices in
OWNER-INPUTS. Build all configurable checks and previews, but do not apply those
real account settings by assuming the recommendations were approved. LIVE
activation (IN-06), each exact money-out grant/limit override and paid custom
domain (IN-11) remain independently gated. No new owner input is invented here.
