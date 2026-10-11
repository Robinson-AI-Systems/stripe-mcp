# Decisions (dated)

One entry per design decision, newest last. Reasons live here; current rules live in AGENTS and the designs.

**2026-10-10 — Build a separate, hosted Stripe MCP in the Google Workspace MCP's style.** Chris asked for a robust Stripe
MCP "in the same (or better) form" as his Google Workspace MCP, after a review of the Stripe tools in Robinson's Toolkit
and older repos. The audit (`docs/audits/2026-10-10-existing-stripe-code.md`) found tools broken by Stripe's 2025 API
changes, a parameter encoder that breaks lists of objects, wrong "cancel at period end", miscomputed MRR, and no safety
layer on 35 money/destructive tools. Money needs preview/confirm/read-back/change-log discipline and a hosted server.

**2026-10-10 — Keys never pass through Claude; restricted keys; test mode by default.** Keys added only on a server page,
stored encrypted with no plain copy; live mode needs two steps; webhook secrets and sandbox passes shown once on the setup
page, never in chat.

**2026-10-10 — Cheap on agent context.** Chris: it must not "burn up an AI agent's context or usage tokens". Compact
listing (≈20 tools, <5,000 tokens) reaching everything, summaries by default, result handles, code mode, budgets as tests.

**2026-10-10 — Reach any agent wherever it runs, via a GitHub relay where only GitHub is reachable.** Chris: not
necessarily Vercel Sandbox; "come up with a solution". Most cloud agent workspaces only reach GitHub and package
registries, which is why his GitHub push/pull tool worked there; the `rstripe` CLI tries direct HTTPS and falls back to
an encrypted GitHub-issue relay. Keys stay on the server.

**2026-10-10 — "Almost everything": universal tools.** Chris: "let my AI agent do literally almost everything for me."
Four `api_*` tools reach every Stripe operation, validated against Stripe's published description, with the same guards;
unknown money-like operations are treated as money.

**2026-10-10 — Branding and setup tools.** Chris asked whether it can set up the dashboard and brand payment pages.
Added brand kits (per-page Checkout branding by API) and account-wide branding (API where Stripe allows it for his own
account, otherwise guided with read-back).

**2026-10-10 — General-purpose, with project profiles.** Chris: the server is "not strictly for Appliance Desk … used on
future projects as well." Apps that run their own Stripe billing get a data-only profile (owned records, webhook events,
key permissions, setup checks). Appliance Desk is the first; `workflow_project_setup` starts Stripe for new projects.

**2026-10-10 — Catalog/tax/usage tools come late (Batch E).** Appliance Desk creates its own products, prices and tax
rates in code; the MCP must not duplicate them. Those tools serve future projects; Batch U reaches them meanwhile.

**2026-10-10 — Plan rebuilt in the Appliance Desk planning system** (AGENTS, SESSION-START, PLAYBOOK, drift protocol,
designs, JIT cards, work index, owner inputs) so Sol 5.6 can implement it efficiently. First version archived in
`docs/archive/plan-v1/`.

**2026-10-10 — Plan approved; public repository; no automated review (IN-00, IN-01).** Chris approved the plan, chose to
keep the repository public (free CI, secret scanning on), and declined Codex reviews for this repo. Every PR carries a
written self-review of the full diff against AI-PR-READ-FIRST instead.

**2026-10-10 — One server per service, combined by Robinson's Toolkit (the hub).** Chris: build each toolset as its own
solid server (Workspace, Stripe, and later his own Vercel, Neon and others — official connectors give less functionality
and agents get different permissions with them), then make Robinson's Toolkit the single MCP/CLI/HTTPS front door. This
server therefore follows the Robinson Tool Contract (RTC 1, in the hub repo), keeps passes and HTTPS doors (Batch R), and
leaves the CLI, code SDK, local MCP, GitHub relay and agent recipes to the hub. Contract-generic code lives in
`src/core/` so the hub can extract it into `robinson-mcp-core` (Batch A amendment). First Batch R archived in
`docs/archive/batch-r-v1/`.

**2026-10-10 — Standalone first (Chris).** "I still need to be able to use the individual tool sets before the hub is
built." This server never depends on the hub: conformance joins CI only when available, and agents reach it through its
own connector and HTTPS API, or through `rtool`/the relay talking to it directly.

**2026-10-10 — A general development tool, not a business tool (Chris).** "This should be general, able to work freely
on any project … It is supposed to be a powerful development tool." Real projects (Appliance Desk) are completeness
checks only. Added Batch V (developer tools: seed scenarios, precise cleanup, real test events, signed event forwarding
into apps under development, test clocks and simulation, test cards) after Batch D; moved test clocks there from Batch E;
made project profiles explicitly optional and general (inline specs for readiness; `project_draft_profile` from codebase
findings).

**2026-10-10 — For account owners too (Chris).** "These toolsets should be great for both developers and end users of
each service, account management tools … everything." Added G-6 owner and administration (admin overview, requirements,
security review, fees and Stripe's own billing, guided settings for every dashboard-only setting with structured steps
and read-back, per hub contract §11). Tools are tagged by audience (builder / owner / operator).

**2026-10-10 — Two login/limit rules from the Workspace server's review.** An automated review of the Google Workspace
MCP plan (its PR #28) found two gaps that apply here too: (1) an OAuth refresh must copy every connection setting
(account, mode, profile, listing) from the issuing token, or a refreshed connection silently falls back to defaults —
added to A-3; (2) a per-pass rate limit kept in memory does nothing on Vercel, where each instance counts separately —
R-2 now uses a Postgres `rate_limits` table with an atomic upsert. Both are in AI-PR-READ-FIRST item 12.

**2026-10-10 — Owner-only set-once authentication.** Chris instructed that this service is exclusively for his projects and should not repeatedly demand authorizations or manually generated tokens. A-3b uses one-hour access credentials with automatically rotated, hashed refresh credentials that remain valid until revoked (or the account/connector is deliberately disconnected); expiry of the access credential does not terminate refresh authorization. No persistent plaintext key; Stripe API keys remain encrypted in the separate A-5 key store. This is a personal-use security/usability tradeoff, not a blanket authorization for live or money-moving operations. The hosting MCP client controls whether it supports seamless background refresh.


**2026-10-10 — IN-05 owner money policy approved, stronger than initial design.** Chris requires
a standard **$500 USD per Stripe account per America/Denver calendar day**, shared by all AI
connections (not $500 per connection). Every AI-initiated money-out transaction, regardless of
size, needs an independently authenticated owner approval for the exact transaction. Going
above the remaining daily allowance needs an additional explicit owner override for that
specific request; this does not permanently raise the daily limit. No `confirm: true`, AI
message, account selection or server-supplied boolean can substitute for the owner approval
record. Authorization is single-use, amount-bound, idempotency-key-bound, expires and is
consumed under the same serialized DB transaction as the money reservation. Until the
authenticated approval UI is wired in a later card, money writes stay unavailable. IN-06
live activation remains separately unapproved.

**2026-10-10 — No legacy toolkit compatibility; prior toolkits are completeness checklists (Chris).**
The older Robinson's Toolkit and related Stripe tool inventories were reviewed only to make sure this
standalone Stripe MCP includes as much **current** Stripe functionality as possible. Build the complete
modern toolset against the pinned official Stripe API and native security model; do **not** build old-agent
compatibility, old toolkit name aliases, adapters, deprecated APIs, migration shims or integrations whose
only purpose is keeping retired systems working. Removed the old-name map from D-1, the X-3 toolkit
retirement/relay decision note, and the IN-12 follow-up (answered **not needed**). Keep the historical
Stripe-code audit as provenance and a feature-completeness checklist, not as a list of legacy interfaces
to reproduce. This does not change the scope of the approved current tool catalog, RTC 1, any live-mode
or owner-money approval gate, or the standalone-first architecture.

**2026-10-10 — Stronger anti-stall rules (from the implementing agent's own diagnosis).** Sol stopped after opening a PR
with red CI although nothing blocked it. Its reasons: too much code before running tests; preventable CI errors (a wrong
API parameter, lint, outdated test expectations); no rule forcing a red PR to be finished first; and chat sessions that
end between actions. Added: SESSION-START §0 (finish open PRs first), §6 (problems vs real blockers, thin slices, a
no-shell path with draft PRs, an exact recovery point at every push) and AGENTS rule 14 (rules 11–13 are the agent's own, added the same day).

**2026-10-10 — CI cadence (from the implementing agent's review of its own CI use).** Every push runs the full CI on
purpose (the merge gate must be green at the exact head). The waste was pushing fixes while a run was still going, which
started overlapping full runs. Rule added to SESSION-START §6: never push while your PR's run is in progress; collect all
failures, fix them together, push once; run checks locally first; "re-run failed jobs" only for infrastructure hiccups.
CI cancels an obsolete PR run when a newer push arrives.

**2026-10-10 — Preserve exact provider evidence across asynchronous TEST subscription renewals (#54).** A failed initial charge is incomplete, not proof of past_due. For a recorded TEST clock trial with the attachable pm_card_chargeCustomerFail method, run completion is delayed until Stripe independently reports ready at the exact advancement time, a run-owned subscription is truly past_due, and the real linked renewal invoice is attempted, open and unpaid. Repeat calls with the same requestKey resume the original ledger without creating duplicates. Stripe's TestClock has no metadata: it is the sole exception to rtc_run, using an exact RTC DEV RUN name plus durably scoped provider ID. This does not relax any LIVE or financial controls. Reviewed in PR #54.

**2026-10-10 — Synthetic TEST ACH consent cannot substitute for real bank approval (#55).** The dev_confirm_seed_ach tool only uses an already run-owned pm_usBankAccount TEST fixture with explicit guarded confirmation and Stripe's TEST online mandate fields; no real consumer or live authorization is represented. The provider may report requires_action, processing, or succeeded; only independent read-back and exact matching TEST payment_intent.succeeded event can prove those separate Stripe states. Nothing here asserts live bank settlement. Every money-out remains independently owner-approved, including TEST transfers/refunds, and the per-account Denver-day cap is unchanged.

**2026-10-10 — TEST marketplace onboarding is not permission for AI money-out (#56).** Only after independently verifying that the selected TEST account has Connect API access may dev_seed create synthetic Express seller accounts, catalog, and buyer fixtures. Record actual seller capability status, which can remain pending onboarding; do not claim charge routing, transfer readiness or payout. Any AI-initiated money-out, even on a TEST marketplace, remains subject to single-use authenticated owner approval and the separate shared 500 USD/Denver-day policy. No old toolkit compatibility added.

**2026-10-10 — V-2 TEST cleanup never invents refunds or deletion (#57).** Exact account-scoped durable run IDs and independent Stripe rtc_run/TEST identity must match before any cleanup action. The provider and DB must both verify an archival, void, cancellation or deletion before a cleaned marker is set. Paid invoices, succeeded payments/refunds, Connect seller accounts and test clocks remain recorded with explicit retained/uncertain statuses until their own risk-aware cleanup can occur. No LIVE or owner money-out authorization rule is weakened.

**2026-10-10 — Risk-aware deletion of TEST Connect sellers and clocks (#58).** A synthetic Express seller is deletable only after Stripe verifies disabled charges/payouts, incomplete onboarding, inactive/pending transfers and zero available/pending/reserved balances. An RTC DEV RUN clock requires all recorded customer/subscription dependencies cleaned and an independently empty provider customer listing. A Stripe deletion receipt alone is insufficient: a separately observed deleted tombstone or exact 404 resource_missing must precede the durable cleaned flag. Unknown responses are retained, never reported as success. LIVE and all independent owner money-out controls remain unchanged.

**2026-10-10 — TEST events must originate in genuine Stripe API actions (#59).** A successful request cannot prove Stripe emitted the expected Event. Curated dev_trigger_event cases create precisely tagged TEST source records; only an exact type/account/run/object/amount match from events.list followed by independent events.retrieve may complete the durable run. Delayed or retained events remain unobserved/unknown, not fictional success. Event IDs have no writable rtc_run field and are recorded exactly; V-2 cleanup verifies their original data.object metadata and retains immutable Event records. No LIVE, bank settlement or owner money-out authorization rule is weakened.

**2026-10-10 — Native TEST event updates and cancellation remain idempotent (#60).** Only recorded run-owned synthetic customers/products/prices may receive narrow description/name/nickname updates, and only unconfirmed zero-received PaymentIntents may be canceled. Each Stripe mutation and updated provider object must independently verify; only an exact observed matching Event may complete dev_trigger_event. No charge reversal, refund, payout or LIVE action is authorized. Real money-out consent remains separately authenticated and single-use.

**2026-10-10 — TEST subscription lifecycle event evidence includes auto-linked invoice (#61).** A guarded seven-day trial subscription may automatically generate a Stripe invoice; require an actual provider-linked zero-paid invoice ID, independent read-back, rtc_run tag and durable ledger record before completing the seeded event run. Deleted requires a separate real no-proration/no-final-invoice cancellation, independent canceled-state verification, and the matching provider Event. No AI money-out approval is bypassed and no LIVE mode activation occurs.

**2026-10-10 — Zero-value TEST invoices are the only approved first billing-event triggers (#62).** Native invoice.created/updated/finalized events use precisely tagged, recorded TEST customer and $0 draft invoices, no automatic advancement or collection. A verified provider mutation never substitutes for the actual Event, which must independently match invoice ID, rtc_run metadata, customer, amount_due/amount_paid of zero and correct lifecycle state. Payment-failure, dispute and Checkout completion events require their own real provider-action path, not simulated success. LIVE and independent owner financial authorization rules remain unchanged.

**2026-10-10 — Failed TEST card confirmation is not a successful payment.** V-3c3a first records an unconfirmed synthetic USD PaymentIntent, then attempts only documented synthetic card decline. Card errors and API responses do not independently prove failure or event emission; observed zero-received requires_payment_method, card_declined and a separately listed/retrieved exact Event are mandatory. The money-in guard does not claim $36 collected on a failed attempt. No LIVE, refunds, transfers, payouts, app-owned records or relaxation of per-operation owner money-out consent.

**2026-10-10 — Asynchronous TEST disputes demand complete linked provider provenance.** A successful synthetic pm_card_createDispute payment does not prove that a real Stripe dispute or Event exists. The charge must link to exact run-tagged PaymentIntent/customer; a charge-filtered disputes.list result must be independently retrieved as provider du_ with exact charge, USD amount and optional PI; Stripe's generated dispute and Event may not carry rtc_run metadata. Event list AND retrieval must match the same selected-account dispute, with original source IDs and amount. Cleanup retains immutable charge/dispute/event evidence and validates linkage against ledger. No LIVE, transfers, payouts, refund or owner approval relaxation.

**2026-10-10 — Native failed-invoice TEST events require nonzero charge and evidence.** A zero-value invoice cannot produce a legitimate failed payment. V-3c3c records synthetic 3600-cent invoice item and source metadata first, finalizes without automatic collection, then attempts one explicitly declined TEST card via native invoices.pay. Neither an exception nor open invoice alone proves failed billing; independently retrieved attempted invoice with positive count, full unpaid balance and exact customer/run plus a separately listed/retrieved original invoice.payment_failed Event are required. No LIVE, refunds, payouts, transfers or relaxation of independently authenticated money-out approval. Preserve invoice/item as financial evidence during cleanup.

**2026-10-10 — Checkout completion cannot be server-generated.** Stripe Checkout Sessions support create/retrieve/expire, not an endpoint to complete/confirm their PaymentIntent. To avoid fictitious event success, V-3c3d provides a genuine TEST hosted Checkout URL only to the authorized developer of an exact run-owned Session; a browser/test operator must use Stripe's hosted flow with a test card. Only read-back of Session complete+paid, its Stripe-generated fully received run-tagged PaymentIntent and independently listed/retrieved original checkout.session.completed Event confirms the run. Pending Session is NOT successful; completed payments/Events are immutable, only open TEST sessions may be expired by cleanup. No LIVE or AI money-out permissions change. Real Stripe TEST provider demonstration remains an acceptance gate before declaring V-3 fully complete.
