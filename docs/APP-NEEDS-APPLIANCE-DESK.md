# What Appliance Desk needs from Stripe, and which tool handles each

Audited 2026-10-10 against `christcr2012/appliance-desk` `main` (code in `src/lib/stripe.ts`,
`src/domains/billing/*`, `src/domains/tax/stripe-rates.ts`, `src/app/api/webhooks/stripe/route.ts`; docs
`docs/ARCHITECTURE.md` "Payments (Stripe)", `docs/BUSINESS-RULES.md` "Billing rules",
`docs/GO-LIVE-CHECKLIST.md` §1 Money, `docs/designs/BATCH-W-AMENDMENT-B.md` §6.2, §6.4, §6.7, §6.8, §6.6,
`docs/designs/BATCH-K.md` D-K4, `docs/designs/BATCH-M.md` M-3).

This is an **example project profile**, and the completeness check used to prove the Stripe MCP can do everything a
real app needs. The server itself is a general development tool; profiles are optional and any app Chris builds can
have one (Batch P, `docs/designs/BATCH-P.md`; `project_draft_profile` drafts one from a codebase). This file is also the
template for future profiles.

**Rule for this file:** every row names the tool or workflow that covers it, or says plainly that Stripe has
no API for it and how the server guides Chris instead. Batch P (`docs/designs/BATCH-P.md`) turns this table
into data (`known_apps`) and into one check, `workflow_app_readiness`. When the app's Stripe use changes,
this file and the `known_apps` seed change in the same PR (P-1 owns the seed).

## What the app does in Stripe by itself (the MCP must not duplicate or fight it)

| The app… | Evidence | What the MCP does |
|---|---|---|
| Creates a Stripe customer per desk customer | `stripe.customers.create` (billing) | Reads freely; changes refused without `outsideApp` (app guard) |
| Creates **its own products and prices** (inline `price_data`; products tagged `kind`, `rentalLineId`, `agreementId`) | `checkout.ts` ~587, `subscription-line.ts` ~104 | **Never builds a separate catalog for the app.** `workflow_go_live_checklist` skips "copy catalog to live" for apps marked `ownsCatalog` |
| Creates **its own tax rates** (`metadata.rateVersionId`, Colorado, exclusive) | `src/domains/tax/stripe-rates.ts` | Never creates tax rates for the app; Stripe Tax is not used by the app |
| Starts subscriptions at delivery (`billing_mode: flexible`, `backdate_start_date`, `metadata.agreementId`, `firstDeliveredOn`), changes them with `proration_behavior: none`, sets `cancel_at` for term ends | `checkout.ts` ~621, `subscription-line.ts`, `subscription-end.ts`, `rate-changes.ts` | App guard blocks plan changes, cancels and pauses on these unless `outsideApp: true` |
| Takes payments with **hosted Checkout** in `payment` and `setup` modes, **card + US bank account (ACH)** | `checkout.ts` 251/278/311 | Readiness checks ACH is enabled in both modes |
| Credits customer balances, refunds, reads payment intents, charges, invoices, invoice payments, setup intents | billing domain | Refunds allowed with confirm (the app recognises refunds made in Stripe); balance credits on app customers need `outsideApp` |
| Opens the **Billing Portal** with `return_url` `/account` | `src/domains/billing/index.ts` 75 | Readiness checks the portal configuration (below) |
| Verifies webhooks with `STRIPE_WEBHOOK_SECRET` and handles 7 event types | `webhooks.ts`, route | Webhook health compares endpoint events with this list |
| Uses idempotency keys and a `ProviderOperation` ledger; a drift workbench compares app and Stripe | BUSINESS-RULES "Provider operations" | MCP changes appear in Stripe's event log, so the app's drift workbench sees them; the app guard prevents most drift in the first place |

**Metadata keys that mark a Stripe record as the app's:** `agreementId`, `estimateId`, `depositId`, `invoiceId`,
`refundId`, `creditId`, `rentalLineId`, `customerId`, `sessionId`, `kind`, `rdf_record_id`, `rdf_payload_hash`,
`rateVersionId`, `firstDeliveredOn`.

**Webhook events the app needs (test and live):** `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`,
`invoice.payment_failed`, `charge.refunded`, `customer.subscription.deleted`.

**Stripe API areas the app's own key must be allowed to use** (for a restricted key, P-3): customers (write),
customer balance transactions (write), Checkout sessions (write), subscriptions (write), products (write),
prices (write, via inline price data), tax rates (write), refunds (write), payment intents (read), setup intents
(read), charges (read), invoices (read), invoice payments (read), billing portal sessions (write), webhook signature
check (no permission; uses the signing secret). Batch K adds balance transactions (read) and balance (read); Batch M-3
adds nothing new.

## Everything to set up in Stripe for the app, and who does it

| # | Need (source) | Test mode today | Covered by | API or guided? |
|---|---|---|---|---|
| S1 | Account verified for live payments: business details, bank account (GO-LIVE §1) | n/a | `account_get` shows what Stripe still needs and by when; `workflow_app_readiness` lists it | **Guided**: Stripe's own onboarding pages (no API for your own account); `stripe_where_is_setting` gives the link and steps |
| S2 | Payment pages branded: name, logo, icon, brand color (GO-LIVE §1; W-24 "pages carry the business's branding") | Not set | `brand_set_account_branding`, `workflow_brand_business` (logo files already in the app repo `docs/brand/01_Logos/`, `02_Icons/`) | API if Stripe accepts it for Chris's own account (H-1 first step tests this), otherwise guided + read-back |
| S3 | Public details: support phone and email on receipts and Checkout (GO-LIVE §1) | Not set | `brand_set_public_details` | Same as S2 |
| S4 | Card-statement name customers recognise (e.g. ROBINSON APPLIANCE) (GO-LIVE §1, W-5 phone payments) | Not set | `brand_set_statement_descriptor` (22-character and character rules checked) | Same as S2 |
| S5 | Branded **receipt emails on** (GO-LIVE §1; W-5 "Stripe's branded receipt email goes to the customer") | Not set | `stripe_where_is_setting` + readiness reminder | **Guided only**: Stripe has no API for which customer emails it sends |
| S6 | Which other Stripe customer emails are on (failed-payment, upcoming renewal, card expiring) so customers do not get two messages from Stripe and the app | Not decided | Readiness lists current choice as unknown and asks; IN-09 | **Guided only**; owner decision |
| S7 | **What Stripe does when all retries of a subscription payment fail** (cancel the subscription, mark the invoice uncollectible, or leave it past due). If Stripe cancels, the app receives `customer.subscription.deleted` for a rental it still considers active | Not checked | Readiness flags it as a required decision with the recommended value (**leave the subscription past due and the invoice open**, because the app owns delinquency, late fees and the To do list: W-0C, W-5); IN-08 | **Guided only** (Billing → Revenue recovery). High importance |
| S8 | Smart Retries schedule (how often Stripe retries a failed automatic charge) | Stripe default | Readiness shows the recommended value and link; IN-08 | **Guided only** |
| S9 | **ACH (US bank account)** enabled for Checkout `payment` and `setup` modes and for the hosted invoice page (BUSINESS-RULES billing rules; W-5 payment links) | Unknown | `account_list_payment_method_settings`, `account_update_payment_method_settings`; readiness checks it | API |
| S10 | **Customer portal configuration**: allow updating payment methods and viewing invoices; **do not** allow cancelling subscriptions or switching plans (the app owns agreements and terms); business headline, privacy and terms links, default return URL | Unknown | `portal_get_configuration`, `portal_update_configuration`, `brand_set_portal_look`; readiness fails if cancel or plan-switch is allowed | API |
| S11 | Webhook endpoint at `https://robinsonappliancerentals.com/api/webhooks/stripe` with all **seven** events (test: five registered 2026-09-27, the two `async_payment_*` events still missing) | 5 of 7 | `webhook_add_events` (one confirmed call fixes test mode today); `workflow_webhook_health` | API |
| S12 | Live webhook endpoint with the same seven events, signing secret into Vercel `STRIPE_WEBHOOK_SECRET` (Production) | n/a | `webhook_create` in live mode; the secret is shown **once on the server's setup page** (never in chat), then Chris pastes it into Vercel | API + one paste by Chris |
| S13 | Live **restricted** key for the app, put into Vercel `STRIPE_SECRET_KEY` (Production) | Test secret key | `workflow_app_readiness` prints the exact permission list (above) to tick when creating it; Chris creates and pastes it | **Guided**: Stripe has no API to create keys |
| S14 | Phone (card-not-present) payments allowed on the live account (GO-LIVE §1, W-5 §6.8) | Not asked | Readiness lists it as an open owner step with Stripe's guidance link | **Guided only** (Stripe support) |
| S15 | Payout bank account and payout schedule | n/a | `money_list_bank_accounts`, `setup_set_payout_schedule` | Bank account: guided (no bank numbers through chat). Schedule: API if allowed, else guided |
| S16 | Two-step login on the Stripe account; team members | Unknown | `stripe_where_is_setting` | **Guided only** |
| S17 | Optional, costs money: custom payment domain (pay.<domain>) | Not chosen | `stripe_where_is_setting`; never bought by a tool | Guided; purchase gate |
| S18 | Spanish for customers (W-26): Stripe pages and receipts in Spanish follow the Checkout `locale` and each customer's `preferred_locales` | Not built in app | `customer_update` can set `preferred_locales` on non-app customers; for app customers the app sets it (W-26). Readiness reports how many app customers have it | API (app-side) |
| S19 | Disputes on phone payments (more risk) | n/a | `dispute_*`, `workflow_dispute_kit` (pulls the signed agreement via app metadata) | API |
| S20 | Batch K books: balance transactions and payouts readable by the app's key | n/a | Permission list in S13 includes them once K is scheduled | Guided (key) |
| S21 | Test mode cleanup before live: none needed — live mode is a separate, empty data set; nothing is copied for the app | n/a | Readiness says so explicitly | — |

## The one-sentence checks Chris will use

- *"Is Stripe ready for Appliance Desk?"* → `workflow_app_readiness(app: "appliance-desk", mode: "test" | "live")`:
  every row above as done / needs you (with link and clicks) / needs a decision (IN-xx), and the exact fixes it can
  make for him (each previewed, each needing confirm).
- *"Fix the webhook"* → `workflow_webhook_health` adds the two missing events.
- *"Brand my payment pages"* → `workflow_brand_business` with the logo from the app repo.
