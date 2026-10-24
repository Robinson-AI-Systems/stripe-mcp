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

## October 23, 2026 — simpler login and optional advanced authority (approved design)

The planned default connection for **Stripe by Robinson AI Systems** is:
add remote MCP to ChatGPT/Claude → verify the person → visit Stripe's owned
App OAuth installation/consent → approve one clear, account-scoped final
client page → return automatically. The existing owner-only key setup
continues to work while the new system is built. The [full specification](designs/STRIPE-CONNECTION-GOD-MODE.md) distinguishes the Stripe App account
grant from the human identity and explains TEST/LIVE and consent guards.

**God Mode is optional**: connect additional verified account/organization
credentials only if the desired operation genuinely needs them. Stripe does
not have GitHub's one all-scopes classic master token. Credentials are never
pasted in ChatGPT; if manual key creation is unavoidable, use a protected
one-use server form. Users can manage owned accounts, per-client permissions,
read-only setting, disconnect and credential revocation in the proposed My
Connection area. This is planned, **not already live**; the source-only
CAP-1 inventory cannot attest real provider permission or Stripe App install.

## October 19, 2026 — Hub is optional to finishing Stripe MCP

Hub must discover and authorize this independent MCP server using the common contract. Stripe must retain direct MCP access, truthful manifest, scoped bearer/OAuth, bounded paginated search/describe/call, explicit provider account grants, refusal/revocation, financial approval and standalone selected-account acceptance. Stripe does not need to enroll with Hub, install a bespoke adapter or prove Hub direct/relay/Sandbox operation before Stripe is complete. The old external Hub test remains PENDING for historical integrity, is marked HUB_OWNED_OPTIONAL, and is not counted as a Stripe completion requirement. Do not mistake a forced TEST grant for live onboarding. Other actual owner sign-in, browser, webhook and Stripe TEST source fixtures remain separate legitimate acceptance work.

## E-1 independent TEST catalog verification — 2026-10-18

Existing disposable TEST native products/prices were independently re-read and found archived with one unique price per stable lookup, despite two same-lookup confirmed original log entries. Preview and app-marker/foreign/invalid denials did not create resources; the original E-1 protected provider acceptance moved to PASSED. No live-mode Stripe write, payment or customer contact occurred. One error wording for invalid catalog input still generically advises checking server setup; this is a separate follow-up UX issue. All 30 other protected checks remain pending with their actual owner, fixture, Hub or external acceptance prerequisites. This already-deployed TEST acceptance is **not** proof newer E-3/E-4/X capabilities are deployed.

## Current original Stripe TEST acceptance — 2026-10-18

**12 of 43** original protected real-provider checks are now passed; **31 remain pending**. The only new passes are a verified read-only inspection of four earlier incomplete TEST trigger fixtures and truthful finite diagnostic indicators. The events themselves were **not** completed; the old durable runs still say `running`. The next release is needed to test newer source additions, but previously deployed safe reads and separately approved TEST fixtures can be examined before that release. Original engineering is merged 57/57; this is not production readiness. The queue and exact evidence are in `docs/STATUS.md` and the V-3 completion card.

## Native Stripe Tax, Quotes, safe undo and TEST smoke — E-4/X-1/X-2 engineering preview

Once PR #276 is reviewed, merged and deployed, native Tax and Quote tools honor the owner's selected Stripe account, delegated permissions and existing preview/confirmation. Tax registration records an existing legal registration in Stripe; it does not register with tax authorities. A Tax reversal adjusts the tax ledger, not the payment or refund. Quote acceptance can create an invoice/subscription or incoming collection; payment success must be separately verified. Quote PDF requires an authorized GET to the private `files.stripe.com/v1/quotes/{id}/pdf` endpoint with a protected Authorization header, never a public or secret-bearing URL. Verified reversible changes may be undone through `stripe_undo_change`, with separate explicit confirmation and independent readback; irreversible changes require a new corrective workflow. The 166 read-labelled-tool smoke audit still has zero actual TEST provider passes, all other protected acceptance remains 10 PASS / 33 PENDING, and source CI does not replace actual owner acceptance.

## Usage metering and credit grants (E-3, after checked deployment)

Use a stable unique identifier for each real usage event and require preview/confirmation. Stripe's response proves initial ingestion acceptance, not an updated customer invoice or final usage sum. Never automatically retry an uncertain event identifier; the service retains it in a durable owner/account ledger to avoid duplicate charges. Creating a credit grant needs a separate signed-in owner approval for the exact selected Stripe account, customer and financial amount. Voiding it needs its own signed-in owner approval, but does not count as money paid out. An AI request/confirmation cannot approve either action on the owner's behalf; product permissions ultimately follow the connected owner's chosen policy and Stripe requirements.

## E-2 original catalog capabilities — source checkpoint, 2026-10-17

PR [#273](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/273) adds all 20 provider-native coupon, promotion code, entitlement feature and manually configured tax-rate tools. Once reviewed and exact-head CI-green, source totals move to **53 of 57**, with **E-3/E-4/X-1/X-2** remaining. This is not deployment or owner-visible Stripe acceptance: the 43 protected criteria remain last observed **10 PASSED / 33 PENDING**. Read-only consumers may inspect, while user-selected profiles, account credentials, permissions and separate LIVE consent govern guarded changes. Owner-specific development no-spend/no-live restrictions do not permanently limit other end users.

## Implementation versus real-world acceptance — 2026-10-17 clarification

The original batch roadmap tracks **source implementation only**: 52 of 57 original subsections are implemented/tested/merged; the remaining five awaiting implementation are E-2, E-3, E-4, X-1 and X-2. The original V-3 TEST Event/Checkout tools, G-6 safe owner Dashboard administration guide, and H-1 branding kit/hosted Checkout integration are already built and merged. **This does not mean they passed live-provider, owner Dashboard or browser acceptance.**

The independent protected acceptance queue currently has 43 checks, last verified **10 passed / 33 pending**. The TEST failed-payment/dispute/invoice Event and browser Checkout proof, signed-in owner Dashboard review, and actual saved TEST brand kit/hosted appearance proof stay pending. The main branch can be newer than the serving READY live deployment; reconnecting or waiting for a verified release may be required before using newly implemented native tools. No sign-in, branding selection, money approval, payment or LIVE activation is inferred from a source-merged status. Additional specialist provider LIVE financial/billing/admin parity remains real engineering outside the five original unimplemented roadmap IDs.

See `docs/audits/2026-10-17-implementation-acceptance-separation.md`, `docs/pr-cards/work-index.json` and `docs/STATUS.md` for the two ledgers and exact evidence.

# Owner guide — what you can ask for

Plain-English things to say to Claude once each part is built. Each line names the batch that delivers it; until then
it does not work yet. This file is updated as features ship.

| Say something like… | What happens | Batch |
|---|---|---|
| "Give me realistic test data for a subscription app." | Customers, products, subscriptions in every state (including past-due), recorded so they can be removed later | V |
| "Clean up the test data from that run." | Removes exactly what was created, nothing else | V |
| "Send my app a failed-payment webhook." | Makes Stripe produce a real test event and, if your app is under development, forwards it correctly signed | V |
| "What happens to this subscription over 6 months?" | Runs it on a test clock and shows every invoice and event | V |
| "Review my Stripe account." | Business details, what Stripe still needs from you, payouts, branding, security, fees — ok or needs attention | G |
| "Add Sam to my Stripe team." / "Turn off Stripe's failed-payment emails." | Stripe has no API for these, so you get exact steps (or a browser walk-through with `rtool guide`), then it checks the result where it can | G |
| "Who am I connected to in Stripe?" | After test setup, reports selected account, mode, profile, masked key and actual shared daily money-out budget/usage | A/B-8a |
| "Which Stripe test accounts have I connected?" | Lists account labels and connection status without revealing keys | A-5 |
| "Which AI connections exist for this Stripe account?" | Lists account-scoped connection metadata, not credentials | B-8a |
| "Disconnect this specific AI connection." | After the owner-only server is deployed, use its private setup page to preview and explicitly confirm revocation of that account/client ID; not an AI-action tool yet | B-8b2a |
| "Immediately block LIVE connections for this Stripe account." | When the server is deployed, the private owner setup page can preview and independently confirm emergency LIVE disable. This cannot enable LIVE or send payments | B-8b2b1 |
| "Make this my default Stripe account for new connections." | The private owner setup page previews the change and requires independent confirmation. Existing AI connection scopes do not change | B-8b2b2 |
| "Change this account’s daily AI money-out limit." | A private owner setup page shows the old/new dollar cap and current daily spending, then requires separate owner confirmation. This NEVER authorizes an individual payment | B-8b2b3 |
| "Show pending AI money-out requests for this account." | In the private owner setup page, re-enter your passphrase to see account-scoped TEST requests with exact targets, amounts and expiry. Viewing **never** approves or pays anything | B-8c1 |
| "Approve this exact outgoing TEST request." | Once deployed, preview the request in the private page, verify the Stripe-derived target, account and cents, then re-enter your password and explicitly confirm one transaction. Above the daily limit, repeat with a **separate** over-limit confirmation. The page itself never sends funds | B-8c2 |
| "Where do I set up Stripe receipt emails?" | Gives guided Dashboard steps, never pretends to change a setting | B-8a |
| "Check my TEST Stripe key permissions again." | Safely re-probes restricted TEST-key read permissions only after a key is configured; credentials are never shown | B-8b1 / #29 |
| "How's the money looking this month?" | Balance, payouts coming, money in and out, monthly recurring revenue, failed payments, disputes | W |
| "Who didn't pay this week and why?" | Each failed payment, the reason in plain words, when Stripe retries, the link to send them | W |
| "Refund the Hendersons' deposit." | Finds the right charge, shows the exact amount, asks you, refunds, confirms | W |
| "Cancel Jim's subscription at the end of the month." | Previews, asks, does it the right way, confirms | D/W |
| "Brand my payment pages for Robinson Appliance Rentals." | Logo, colors, statement name, support details, invoice footer; shows you a test page | H/W |
| "Is Stripe ready for Appliance Desk?" | Every item the app needs: done, fixed with your OK, or exactly what you need to click | P |
| "Fix the Appliance Desk webhook." | Adds the two missing ACH events, after you confirm | P/W |
| "Set up Stripe for my new project." | Webhook, portal, payment methods, branding, products if needed — previewed first | P |
| "Help me fight this dispute." | Gathers the evidence, drafts it, lists what you must add before the deadline | W |
| "Find the Stripe tool that can check customer subscriptions." | Uses compact tool search to discover the right safe tool without loading hundreds of tool schemas | C-2 / #36 |
| "Check my account and recent changes together." | Runs a short batch of up to ten read-only requests with the same connection restrictions as direct calls | C-2 / #36 |
| "Find this TEST customer by name or email." | Current native customer finder with pagination and safe summaries, without legacy aliases | D-1 / #37 |
| "Show saved cards and banks for this customer." | Only masked payment method details; no card numbers or secrets | D-1 / #37 |
| "Update this customer's TEST contact details." | Protected preview, explicit confirm and app-owned-record restriction | D-1 / #37 |
| "Give this customer a TEST credit." | Independent exact owner confirmation and shared daily money guard are required | D-1 / #37 |
| "Find a TEST payment and show why its charge failed." | Safe status, outcome and decline summaries, with no card or client secrets | D-2 |
| "Refund the remaining amount of this TEST charge." | Provider amount verified before separate exact owner approval; extra override above daily cap | D-2 |
| "Cancel a TEST refund that requires customer action." | Only refunds in requires_action can be canceled, after guarded preview and confirmation | D-2 |
| "Send a TEST customer a hosted payment or card-setup page." | Owner-configured HTTPS return addresses, Stripe-hosted card/bank entry, no client secrets in tool results | D-3 / #39 |
| "Deactivate this reusable TEST payment link." | Protected preview, explicit confirm and verified provider read-back | D-3 / #39 |
| "Inspect or change the TEST customer portal policy." | Safe reads, owner-full profile plus confirmation for policy changes | D-3 / #39 |
| "Get the next page of that large Stripe result." | When a read exceeds 8 KB, the server gives a private result handle; this tool retrieves short pages through the same authenticated connection, never another agent’s connection | C-1 / #36 |
| "What changed in Stripe through Claude recently?" | Read the authenticated account's safely paged, TEST-mode change summaries (no raw snapshots); advanced filtering is still planned | B-8a |
| "Undo that." | Reverses the last change when it has a clean opposite; says plainly when it doesn't | X |
| "Make a 24-hour read-only pass for Codex." | A pass shown once on your setup page; the agent uses it through Robinson's Toolkit (`rtool`) or the HTTPS API | R |
| Anything else in Stripe | The universal tools find the right Stripe operation and run it with the same safety | U |

### D-4 TEST subscriptions and schedules (PRs #40 + #42)

After the code is merged and a TEST Stripe account is connected, ask to list and inspect subscriptions, preview plan/quantity changes, or create, update, cancel, undo cancellation, and pause/resume collection. Destructive changes require explicit preview/confirmation; any credit producing a money-out action separately needs authenticated owner approval. This is **not** LIVE access. You can also add/update/remove subscription items, create future schedules, update their future phases, release schedules or cancel them. An active schedule's current phase cannot be silently modified; replacing existing future phases requires an explicit choice. Changes remain TEST-only and require provider previews/read-back.


### D-5a TEST invoice drafts (PR #43)

After connecting a TEST Stripe account, you can inspect and search invoices, list payments allocated to an invoice, preview the next customer invoice, create a manual unfinalized invoice, change its description/metadata and add/update/remove positive USD draft items. Draft operations never finalize, send or collect money. Invoices with taxes, discounts, credits or subscription/app ownership require their native Stripe or owning-application workflows; the server refuses ambiguous changes. LIVE remains OFF. Invoice finalization/payment and credit notes come in D-5b/c.

### D-5b — TEST invoice lifecycle (#45)

With a securely connected TEST Stripe account, ask to finalize a manually controlled draft, generate a TEST `invoice.sent` event, charge a saved method for the exact verified balance, record an externally received payment, void/write off an unpaid invoice, or permanently delete a draft. Each requires a preview and explicit confirmation. **TEST-mode invoice sends do not deliver an actual email**, and test charges do not move real funds. Changes on app-owned invoices are refused unless deliberately authorized outside the app. LIVE stays OFF; the service is not deployed. Credit notes follow in D-5c.

### D-5c — TEST credit notes (#46)

Once securely connected to a TEST Stripe account, you can inspect credit notes, preview an exact reduction of an unpaid invoice or a credit/refund for a paid invoice, and request issuing or voiding a credit note. The server must compare the allocation to Stripe's official preview. Issuance always requires **a separate owner-authenticated, single-use approval for that exact credit amount**, even if the AI sets `confirm:true`. Above the account's shared $500 daily outgoing cap, the owner must separately override the limit. App-owned and subscription invoices default to their own workflows; refunded notes cannot be voided. LIVE remains OFF and no real credits can be created through this unprovisioned service.

### V-1a — safely seed TEST catalog records (#47)

After connecting a TEST Stripe account and setting up the database, use `dev_seed` with `scenario: catalog-starter`, `size: 1..5`, and your own stable `requestKey`. First dry-run the plan, then confirm; the server creates that many synthetic test customers, mock products and matching recurring USD prices. Their IDs and `rtc_run` metadata are preserved by account in the durable run ledger for precise future cleanup; `dev_list_runs` lists only that selected account's runs. Reuse the identical `requestKey` to avoid duplicates. This slice **does not** create payments, refunds, disputes, or subscriptions: full named scenarios follow in V-1b. LIVE is refused. Never seed a real business account with these synthetic records.

### V-1b1 — TEST store sales and safe subscription trials (#48)

Select `dev_seed` with `scenario: basic-store` to generate synthetic customers, one-time prices and simulated card payments. Each payment is a **TEST incoming charge** (no real funds) with provider-verified amount/customer/status, and its exact payment-intent ID is recorded. `subscription-trial` and `subscription-canceled` create and verify 7-day trial subscriptions, with canceled tests using no invoice or proration. You may instead give one bounded unambiguous description. Reusing the exact scenario/description, size and `requestKey` safely reuses the immutable run; changing a plan with the same key is refused. For actual refunds, disputes, ACH settlement, and overdue billing scenarios, the remaining V-1b2 work must be completed; agents cannot silently approve outgoing payments. LIVE is OFF.

### V-1b2 — separately approve a synthetic TEST refund (#49)

After a `basic-store` TEST run creates a simulated successful card payment, call `dev_seed_refund` with the run ID and its `payment_N` step (e.g. `payment_1`). It verifies the original TEST Stripe payment and refundable charge, shows the exact dollar amount and asks you to confirm the requested operation. **Confirming in the AI does not authorize the refund:** your independent authenticated owner approval on the setup page is mandatory for this exact charge and amount, and amounts above your shared $500 daily outgoing allowance require a second owner override. Once Stripe's refund is independently verified, its `re_` ID is recorded on the run for inspection. No real Stripe money is moved because LIVE is still disabled. A run may be refunded only once per tracked payment in this initial tool. Disputes and ACH settlement scenarios remain to be built.

### V-1b3 — TEST dispute-trigger cards and pending ACH setups (#50)

`dev_seed` accepts the TEST-only scenarios `dispute-trigger` (synthetic charge using Stripe's dispute-triggering test payment method) and `ach-awaiting-confirmation` (an unconfirmed bank-capable payment intent). They are tagged and tracked by run, with exact Stripe read-back. A dispute-triggered charge is **not proof a later dispute event has arrived**, and an ACH intent requiring confirmation is **not a bank debit or settlement**. Inspect actual Stripe events/settlements once the later V-1b4 and V-3/V-5 workflows are implemented. Neither scenario moves real funds or bypasses owner refunds/overrides. LIVE is disabled.

## Owner-only TEST report CSV downloads

Find a completed TEST report using `report_list_runs`, `report_get_run` and `report_get_result_file`. These MCP tools expose safe metadata, never private URLs or CSV bytes. Open `/api/stripe/setup` directly in your own browser, then fill in the connected TEST Stripe account ID, report run ID (`frr_...`) and your administrator passphrase under **Download a verified TEST report CSV**. Same-origin CSRF, password lockout, account and file verification protect this browser-only attachment. Maximum file size: 5 MiB. Download larger or unavailable reports directly in your authenticated Stripe Dashboard. Never paste financial CSVs or administrator secrets into an AI chat. LIVE stays off.

## View safe TEST Stripe file information

Use `file_list` with an explicit `purpose` of `dispute_evidence`,
`finance_report_run`, `business_logo` or `business_icon`, or call
`file_get` with one exact file ID. Only file metadata is provided; no private
file contents or Stripe authorization URLs are returned. `file_create_link`
requires a full-profile preview and confirmation, expires within 24 hours and
only works for public brand logos/icons. It **cannot** share dispute evidence,
finance reports or identity documents. G-2 evidence upload/submission follows.

## Import private dispute evidence from a public HTTPS source (TEST)

Use `file_upload_evidence` with `sourceUrl` (a publicly downloadable
`https://` file or public Google Drive share link) and a safe `filename`
ending in `.pdf`, `.png`, `.jpg` or `.jpeg`. Preview first, then
explicitly confirm; the server downloads a verified file of no more than
10 MiB and uploads it privately to the connected TEST Stripe account.
Only the Stripe file ID is returned, not file bytes, a sensitive download URL,
or the source's possibly signed query. Private Drive links that require
login and Drive confirmation pages are not accessible and fail closed.
**Uploading does not attach or submit evidence to a dispute.**
Avoid importing personal data unless you have the right to provide it.

## Stage TEST dispute evidence without submitting it

Call `dispute_get` for the exact `du_...` ID, amount, status and
Colorado evidence deadline. Upload any PDF/PNG/JPEG using
`file_upload_evidence` and retain its private `file_...` ID. To stage draft
evidence, call `dispute_save_evidence` with the dispute ID and selected fields
(such as `productDescription`, `uncategorizedText` or `receiptFileId`).
Review the preview, then independently confirm the TEST write. The API is
called with **`submit:false`**; saving a draft never sends evidence to the bank.
The result confirms only field names, verified submission count and staged
state; sensitive evidence text is not echoed. An already submitted or past-due
dispute cannot be staged. Actual evidence submission and accepting a loss are
separate tools yet to be implemented, and accepting a loss will require
independent owner money-out authorization.

### G-3 — TEST-only Radar and Identity (#97–#102)

When a TEST Stripe account is securely connected with the necessary key permissions, the server can read safe fraud warnings, reviews and Radar value-list identifiers without exposing IP/email/card values; approving reviews or changing lists requires full-profile write confirmation and provider read-back. It can list verification session states, issue a Stripe-hosted Identity verification URL, cancel input-pending sessions and **request irreversible redaction** separately. Only the verified Stripe-hosted link is returned, never Identity reports, documents or client secrets. Redaction may process for several days and must not be described as completed until Stripe confirms `redacted`. These features have automated CI evidence, **not** connected TEST-account smoke evidence. LIVE is disabled.

### G-4b — Inspect TEST webhook endpoints (#104)

Once a TEST Stripe account is connected, ask which webhook endpoints are enabled and which event types each subscribes to. The reads provide status, a safe destination origin and bounded event names/count; they never reveal a signing secret, full destination path/query or other private endpoint configuration. They cannot create, modify or delete endpoints. Real connected TEST-account evidence remains pending; LIVE is OFF.

### G-4c — Add/remove TEST webhook event subscriptions (#105)

With a connected TEST account and write-capable profile, ask to add or remove one to eight named webhook event types. Preview/confirm is mandatory; the tools preserve unrelated subscriptions, refuse wildcard/Connect or protected application endpoints, and independently verify Stripe’s final complete event set. Endpoint paths and signing secrets never appear in tool output or audit. These tests have CI evidence only; no account-connected TEST smoke has been performed. LIVE remains disabled.


## Owner TEST Setup & Readiness Report (October 12, 2026)
On the existing private setup page, run a focused custom MCP TEST group for your enrolled
account. The report separates actual native observations from partial, unreadable,
and failed reads and shows only relevant exceptions. It never assumes the Sandbox
uses a particular default, that a working listing means webhook events were
delivered, or that visible receipt settings prove receipt sending. No automatic
Stripe setting changes occur. No general-purpose manual Dashboard tour is needed;
only inspect an unknown setting when you have a specific workflow requirement.
G-6 Dashboard comparison, OAuth, signed webhook delivery, H-1 and LIVE remain
separate gates. Do not enter credentials in chat.


## Short-lived RTC read-only pass (PR #154)
Use the private Stripe MCP setup page, select your enrolled TEST account and
supply the administrator passphrase. It issues a 24-hour, TEST-only, read-only
pass with no money authority. Open the returned one-time reveal link and re-enter
the passphrase; the bearer is never printed in AI output or stored in plain
text. The pass has a separate connection ID for owner revocation. The upcoming
HTTPS RTC routes must be finished and tested before using it for Toolkit D-4.


## Toolkit HTTPS TEST reads (PR #155)
The service now provides public `/api/contract` and `/api/openapi.json`, plus
pass-only `/api/whoami`, `/api/tools`, `/api/tools/{name}` (GET metadata/POST
read), `/api/tools/_batch`, and `/api/results/{handle}`. Only owner-created
24-hour TEST read-only passes work. The API cannot execute Stripe writes or
move money, and the underlying `/api/mcp` remains separate. No pass goes in
chat, URL or logs. The hub's real three-route D-4 verification and complete RTC
write conformance remain pending. Revoke temporary passes by connection ID.


## Daily Production deployments (PR #166)

The custom Stripe MCP continues developing on `main`. Vercel Production
should track a dedicated `live` branch. GitHub proposes one checked
fast-forward each Colorado day around 4 AM daylight / 3 AM standard time.
Check the deployment and actual Vercel `live` branch setting before treating
this as fully activated. Stripe LIVE payments remain explicitly disabled.
See `docs/DAILY-PRODUCTION-PROMOTION.md`.

## Temporary one-hour Toolkit passes (PR #163)
The protected owner setup page can issue a one-hour, area-scoped TEST read-only pass for genuine Hub D-4 acceptance. The existing 24-hour default is unchanged. The bearer remains visible only through the one-time owner reveal; revoke the connection after the real test. Selecting one hour does not itself prove any external route was tested.

## Owner TEST signed webhook receipt lookup (PR #160)
The private setup page can read whether a single known TEST webhook event was
recorded by the signed receiver. Enter your enrolled TEST account, native endpoint
ID, event ID, and owner passphrase; the page checks origin and CSRF. It displays
only event type and receipt UTC time, not event contents or the signing secret.
A successful receipt proves this service's signed-validation storage, not that
an externally delivered Stripe event reached Vercel: confirm the actual Stripe
TEST delivery and permitted ingress separately before declaring G-4 accepted.

## Coding-agent development access (2026-10-13)

The implementing agent uses a renewable native OAuth connection, not a new copied RTC
pass for every retest. `rtool developer-connect ALIAS --profile full` prepares one mobile
link using the custom service. Choose the intended account/resources and authorize once;
return to chat without copying secrets. The agent reruns the command to finish privately,
then uses developer-check, developer-tools and developer-call. Existing original service
write previews, owner approvals and resource guards still apply. This developer workflow
does not reduce the finished product's tool capabilities.

On a managed POSIX cloud runner, configure RTOOL_DEVELOPER_VAULT_DIR to an absolute private
folder outside every Git checkout. The CLI creates a separate 0600 encryption key and
AES-GCM encrypted connection files in a 0700 folder; keep that private runner state for
resumes. OS credential managers remain the desktop default. Neither option places secrets
in chats, prompts, Git or shared artifacts. Initial provider consent or an expired/revoked
underlying authorization can still require a new owner sign-in. Source/tests are not
proof that the new deployed workflow has been exercised against the real provider.

## Owner-issued RTC agent passes — development branch PR #263, not deployed (October 17)

After the R-1–R-3 branch is fully accepted and merged, the existing private
`/api/stripe/setup` page offers **Create owner-delegated TEST agent pass**.
Choose an enrolled TEST Stripe account, profile, 1–6 specific tool areas,
write delegation, an independent delegated money ceiling, per-minute request
budget and expiration. The default is TEST/read_only, 24 hours, 120 reads/minute,
no writes and zero money. Passes up to 30 days are supported; a personally
selected Hub pass may be up to 365 days. The owner must submit the original
passphrase, same-origin CSRF and explicit scope checkbox; a generated bearer is
shown once on a second private password-authenticated page, never through an
AI tool, README, log or PR. Revoke only the specified selected account/client
through the existing owner preview/confirm revoke form. The existing
`stripe_list_connections` tool shows selected metadata, not credentials.

A positive delegated money ceiling is **not permission to send a payment**:
original operation-specific owner approval, idempotency, confirmation, Stripe
amount lookup, account-wide $500/day policy and separate over-limit owner
approval all remain required. Existing LIVE is OFF; this branch currently
issues TEST passes only and is **not ready for use on deployed Production**.


## Authorized end-user capability versus developer TEST rules — 2026-10-17

Development restrictions never become restrictions on a properly entitled end user. The protected private setup page can issue individual RTC passes with owner-chosen account, TEST/LIVE mode, profile, areas, write permission, expiry, rate and daily delegated financial ceiling. LIVE requires separately enrolled matching LIVE credentials, independent account enablement and explicit LIVE pass/write consent. A money ceiling is not permission to move money: original individual owner-approved exact transactions, daily policy, idempotency and provider verification remain enforced.

Native discovery now includes already-guarded TEST money, account, webhook, branding, catalog and report write tools. A full-profile LIVE RTC pass can invoke only the provider operations with complete LIVE-aware native protection; some existing specialist provider implementations still enforce TEST themselves. Pinned universal read and verified nonfinancial writes can use LIVE after independent account and production authorization. Standard MCP OAuth remains TEST-only pending a reviewed owner-delegation upgrade. Generic universal financial actions remain an implementation gap until operation-specific amounts, access and verifiable outcomes exist. These are not permanent owner-selected restrictions. Read-only passes still cannot mutate resources. No deployment or real Stripe acceptance is implied by the source change.

## OAuth account selector and LIVE delegation — 2026-10-17 source correction

For ordinary connected AI clients (not only standalone RTC passes), the browser OAuth approval page now supports an owner-selected TEST or LIVE account/mode. TEST is the default. LIVE is offered only in the production service when the exact selected account has separately verified LIVE credentials and was independently enabled. The owner must supply the private administrative passphrase and may check a **separate** LIVE write consent for a non-read-only profile. Leaving that box unchecked makes LIVE strictly read-only even when the selected profile is otherwise full. The protected OAuth token stores the exact original account/mode/profile/listing/write grant; clients cannot widen them with later tool arguments or refresh. Disabling the account or disconnecting LIVE credentials immediately denies LIVE operations and refresh.

No financial money-out permission is created by ordinary OAuth LIVE write consent: it grants no delegated money budget, and the original independently authenticated exact transaction approval plus owner daily cap remain necessary. A LIVE connection can execute the already-classified nonfinancial universal operations after preview and explicit confirmation; not every specialist native tool has been migrated from original TEST-only implementation. This source change and synthetic evidence are not proof that deployed LIVE Stripe interactions have been attempted or approved.

## Verified account payment settings and payment-method domains — pending production acceptance

Owner-authorized TEST and (after separate activation and LIVE delegation) LIVE connections can list direct Stripe payment-method configurations and registered payment-method domains, change a named direct configuration's method preference, and register an exact public payment domain using Stripe's API. Both changes require preview, explicit confirmation, stable request key, original audit and an independently observed provider readback. LIVE writes remain separately scoped and cannot be activated by tool arguments or an ordinary read-only OAuth connection. The selected Stripe account and environment are independently validated with the provider. Child/Connect-managed configuration writes are not permitted; Stripe documents parent configurations as Dashboard-managed. A method preference or registered domain does not guarantee a given method is enabled in Checkout; inspect Stripe's effective preference/domain readiness and complete any external verification steps. A change may affect future real customer payment options and downstream processing costs. No actual LIVE account calls were made by this engineering.

## Webhook endpoint management in an owner-selected LIVE Stripe connection

A separately activated, owner-consented LIVE connection can list and inspect redacted webhook endpoints and, with a separately granted LIVE write permission and appropriate profile, create endpoints, update their destination or description, add/remove named events and delete an endpoint. All actual changes require explicit preview and confirmation. In LIVE, a webhook configuration can immediately alter real event delivery, cause downstream automation, expose externally reachable receivers, or permanently stop existing notifications if deleted; review the event list and receiver before approving. Managed application/Connect endpoints stay protected; no new capability to edit another owner's endpoints is granted. Stripe's real account identity, second LIVE balance and endpoint `livemode` are verified independently. Creation's one-time signing secret is **not** provided in chat or MCP response, only through the password-protected private owner page; it cannot be retrieved again. Repeating the same request key after an uncertain provider outcome does not send another create. LIVE results remain source-implemented but unverified against actual Stripe until authorized deployment and protected real-account acceptance. Developer TEST-only rules and no-unauthorized-spend/release restrictions never substitute for the end user's actual grant.

## End-user LIVE product and price catalog — implementation pending deployment proof

A separately enrolled and activated LIVE Stripe account may be selected for six product/price list, exact retrieval and search tools. With full or otherwise authorized delegated profile and an independently chosen LIVE write grant, native `product_create`, `product_update`, `product_archive`, `product_unarchive`, `product_delete`, `price_create` and `price_update` can execute through original preview, explicit confirmation, stable request keys and independent Stripe readback. LIVE mode requires actual selected account identity and an independent LIVE balance. Catalog prices are financial terms offered to customers, not provider spending charged by the coding agent. **A LIVE price may affect future real customer charges and checkout flows**; check amount, interval, currency, applicable tax and app ownership before approval. Stripe price amount/product/cadence are immutable; make a new price with a new lookup key to change those terms, do not silently rewrite an existing price. Application-owned products/prices, app-reserved metadata and unknown ownership remain protected; `outsideApp` does not grant a bypass for these catalog tools. Source and synthetic tests do not imply real LIVE deployment or activated customer operations. Real-world acceptance must follow the original authorized production release process.

## Customer account LIVE operations — source-only before accepted deployment

Properly activated, owner-consented LIVE connections can list/search/get own-account customers, masked saved payment methods, signed customer balance history and tax IDs, and—with separate LIVE write authorization—create/update/delete customers, detach or select their default saved payment method, add/delete customer tax IDs, and remove a discount. All write actions preserve preview, explicit confirmation and verified provider readback, and never return raw payment credentials. Changing customer records, default billing methods, removing discounts or deleting customers can affect real charges, invoices, payment retries and tax reporting; review the identified customer and consequences before approving. App-owned customer/contract metadata is protected, foreign and mismatched provider modes are refused. The end-user's credentials and selected policies determine capability, not the coding agent's TEST-only rule.

Customer **balance adjustments** remain a distinct unfinished financial implementation: ordinary LIVE approval does not yet permit `customer_add_balance_credit`, which requires provider-verified money direction and exact independent owner approval, audit and concurrent money-limit proof before deployment. This is not a permanent customer opt-out or Stripe-imposed prohibition. No real customer data or money was changed to implement this source correction. External acceptance requires a separate authorized release and actual provider verification.
