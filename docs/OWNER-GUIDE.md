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
