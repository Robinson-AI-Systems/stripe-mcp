> **RETIRED DOCUMENT — reference only.** First version of this plan (2026-10-10), written in the Google Workspace MCP plan style before it was rebuilt in the Appliance Desk system. Nothing here is a current instruction. Use `AGENTS.md`, `docs/START-HERE.md`, `docs/designs/` and `docs/TOOL-CATALOG.md` instead.

# Tool catalog

Every tool this server will have, by area. The implementing model builds
exactly these; anything else goes under "Suggested follow-up" in a PR.

**Origin:** `C` carried over from the toolkit (port to the new conventions),
`F` carried over and **fixed** (FINDINGS.md), `R` restored from the older
TypeScript versions, `N` new.
**Safety:** `—` reads only · `P` preview available (dryRun) · `C` needs
`confirm: true` · `C*` needs confirm only for some uses (stated) · `$` moves
money (dollar preview, daily limit, always confirm).
**Profile:** `R` read_only and up · `E` everyday and up · `F` full only.
(Every read tool is in `R`; the column shows the lowest profile that has it.)

Toolkit name mapping: `stripe_list_customers` → `customer_list`, and so on.
P2-1 adds a table to the README mapping every old toolkit name to its new name.

## Server about itself (`stripe_*`) — 18

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `stripe_whoami` | Which Stripe account, mode (TEST/LIVE), profile, key type, key last 4, API version, daily money limit and how much is used today | — | N | R |
| `stripe_list_accounts` | Stripe accounts this server holds keys for, and which modes each has | — | N | R |
| `stripe_set_default_account` | Which account new connections pick first | P | N | F |
| `stripe_check_key_permissions` | Re-probe the key: which tool areas work and which are blocked, with the permission to add for each | — | N | R |
| `stripe_list_connections` | Which Claude connections exist, their account, mode, profile, last used | — | N | R |
| `stripe_revoke_connection` | Switch a connection off | C | N | F |
| `stripe_enable_live` / `stripe_disable_live` | Allow or stop live-mode connections for an account (enabling also needs the passphrase on the setup page) | C | N | F |
| `stripe_set_money_limit` | Change the daily money-out limit for an account | C | N | F |
| `stripe_recent_changes` | What was changed through this server (filter by tool, mode, customer, date; previews hidden unless asked) | — | N | R |
| `stripe_undo_change` | Undo one change-log entry when it has a clean opposite; says plainly when it does not | C | N | E |
| `stripe_search_tools` | Find tools by plain words; one line each with safety marks (compact mode's front door) | — | N | R |
| `stripe_describe_tool` | Full instructions and arguments for one tool | — | N | R |
| `stripe_call` | Run any tool in the profile by name, through the same guards | as the tool | N | R |
| `stripe_batch` | Up to 10 read calls in one round trip | — | N | R |
| `stripe_get_result` | Page through a big result kept on the server behind a handle | — | N | R |
| `stripe_create_sandbox_pass` | Make a short-lived pass for the HTTPS API / `rstripe` CLI (shown once; test, read-only, 24 h by default) | C | N | F |
| `stripe_where_is_setting` | Dashboard link and clicks for things Stripe has no API for (team members, two-step login, Radar rules, statement emails, resending a webhook) | — | N | R |

## Customers (`customer_*`) — 17

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `customer_list` | List customers (by email, created date) | — | C | R |
| `customer_get` | One customer, with default payment method summary and app record link if any | — | C | R |
| `customer_search` | Stripe search (`email:`, `name~:`, `metadata['agreementId']:`) | — | C | R |
| `customer_find` | Plain search: name, email, phone or app ID; tries the right search for you | — | N | R |
| `customer_create` | New customer | P | C | E |
| `customer_update` | Name, email, phone, address, description, metadata | P | C | E |
| `customer_delete` | Delete (cancels their subscriptions; cannot be undone) | C | C | F |
| `customer_list_payment_methods` | Saved cards and bank accounts (brand, last 4, expiry only) | — | C | R |
| `customer_get_payment_method` | One payment method | — | C | R |
| `customer_remove_payment_method` | Detach a saved card or bank account | C | C | E |
| `customer_set_default_payment_method` | Which saved method pays invoices | P | N | E |
| `customer_list_balance_transactions` | Account credit/debit history | — | C | R |
| `customer_add_balance_credit` | Add credit (or a debit) to a customer's balance | $ | F | E |
| `customer_list_tax_ids` / `customer_add_tax_id` / `customer_delete_tax_id` | Tax IDs | — / P / C | C | E |
| `customer_remove_discount` | End a customer-level coupon | C | R | E |

## Payments and refunds (`payment_*`) — 19

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `payment_list` / `payment_get` / `payment_search` | Payment intents | — | C/C/R | R |
| `payment_charge_saved_method` | Charge a customer's saved card/bank off-session for a one-off amount (description required) | $ | N | E |
| `payment_capture` | Capture an authorized payment (full or part) | $ | C | E |
| `payment_cancel` | Cancel an uncaptured payment | C | C | E |
| `payment_update` | Description, metadata, receipt email | P | R | E |
| `charge_list` / `charge_get` / `charge_search` | Charges, with outcome and decline reason in words | — | C/C/R | R |
| `charge_update` | Description, metadata, receipt email | P | C | E |
| `payment_create_refund` | Refund all or part of a charge or payment, with reason; checks refundable amount first | $ | C | E |
| `payment_list_refunds` / `payment_get_refund` | Refunds | — | C | R |
| `payment_update_refund` | Refund metadata | P | R | E |
| `payment_cancel_refund` | Cancel a refund still pending (bank refunds) | C | R | E |
| `setup_list` / `setup_get` | Setup intents (saving a payment method) | — | C | R |
| `setup_cancel` | Cancel a setup intent | C | C | E |

Removed on purpose: `stripe_create_payment_intent` / `stripe_confirm_payment_intent`
with raw payment method IDs and returned `client_secret` (replaced by
`payment_charge_saved_method` and hosted Checkout), `stripe_create_setup_intent`
(replaced by `checkout_create_setup_link`).

## Checkout, payment links and the customer portal (`checkout_*`) — 16

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `checkout_create_payment_link_for_customer` | A one-time hosted Checkout page for a customer and amount/prices, in the saved brand kit; returns the URL | P | F | E |
| `checkout_create_setup_link` | Hosted page where a customer saves a card or bank account (replaces `stripe_onboard_customer`'s secret) | P | N | E |
| `checkout_list` / `checkout_get` / `checkout_list_line_items` | Checkout sessions | — | C/C/N | R |
| `checkout_expire` | Kill an open Checkout link | C | C | E |
| `paylink_list` / `paylink_get` | Reusable payment links | — | C | R |
| `paylink_create` / `paylink_update` | Create or change a reusable payment link | P | C | E |
| `paylink_deactivate` / `paylink_activate` | Turn a link off or back on | P | C/N | E |
| `portal_create_session` | Customer portal link for one customer | P | C | E |
| `portal_list_configurations` / `portal_get_configuration` | What the portal lets customers do | — | C | R |
| `portal_update_configuration` | Change what the portal allows (cancel, switch plan, update payment method) | C | N | F |

## Subscriptions (`billing_*`) — 21

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `billing_list_subscriptions` / `billing_get_subscription` / `billing_search_subscriptions` | Subscriptions, with each item's current period (read from items, not the subscription) | — | F/F/R | R |
| `billing_create_subscription` | Start a subscription on a saved payment method; preview shows the first charge and date | $ | F | E |
| `billing_update_subscription` | Metadata, description, default payment method, billing anchor rules | P | C | E |
| `billing_preview_change` | Exact price difference of a plan or quantity change, using `invoices/create_preview` | — | F | R |
| `billing_change_plan` | Switch price or quantity with proration choice; preview is the exact amount | $ | F | E |
| `billing_cancel_subscription` | Cancel now (with optional final invoice/proration) or at period end (done correctly, by update) | C | F | E |
| `billing_undo_cancel` | Clear a scheduled cancel-at-period-end | P | N | E |
| `billing_pause_collection` / `billing_resume_collection` | Pause or resume payment collection | C / P | C | E |
| `billing_list_items` | Items on a subscription | — | C | R |
| `billing_add_item` / `billing_update_item` / `billing_remove_item` | Item changes, each with proration preview | $ / $ / C | R/C/R | E |
| `billing_list_schedules` / `billing_get_schedule` | Subscription schedules | — | C | R |
| `billing_create_schedule` / `billing_update_schedule` | Future plan changes | P | C | F |
| `billing_release_schedule` / `billing_cancel_schedule` | End a schedule | C | C | F |

## Usage billing (`meter_*`) — 16

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `meter_list` / `meter_get` | Billing meters | — | C | R |
| `meter_create` / `meter_update` | Create or rename a meter | P | C/N | F |
| `meter_deactivate` / `meter_reactivate` | Turn a meter off or on | C / P | C | F |
| `meter_record_usage` | Send a usage event (idempotent by event identifier) | P | C | E |
| `meter_list_usage_summaries` | Usage per customer per period | — | C | R |
| `alert_list` / `alert_create` / `alert_activate` / `alert_deactivate` / `alert_archive` | Billing usage alerts | — / P / P / P / C | C | F |
| `credit_list_grants` / `credit_create_grant` / `credit_void_grant` | Billing credit grants | — / $ / C | N | F |

Removed on purpose: `stripe_create_usage_record`, `stripe_list_usage_record_summaries`
(Stripe removed legacy usage records; meters replace them).

## Invoices, credit notes and quotes (`invoice_*`, `creditnote_*`, `quote_*`) — 30

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `invoice_list` / `invoice_get` / `invoice_search` | Invoices, with hosted link and PDF link | — | C/C/N | R |
| `invoice_list_payments` | Payments applied to an invoice (the app reads these) | — | N | R |
| `invoice_preview` | What a customer's next invoice will be (`create_preview`) | — | F | R |
| `invoice_create_draft` | New draft invoice | P | C | E |
| `invoice_update_draft` | Due date, memo, footer, custom fields, metadata | P | R | E |
| `invoice_add_line` / `invoice_update_line` / `invoice_remove_line` | Draft invoice lines | P / P / C | C/N/N | E |
| `invoice_delete_draft` | Delete a draft | C | R | E |
| `invoice_finalize` | Lock a draft so it can be paid or sent | C | C | E |
| `invoice_send` | Email the invoice from Stripe | C | C | E |
| `invoice_charge_now` | Try to collect an open invoice now (Stripe's "pay") | $ | C | E |
| `invoice_mark_paid_outside_stripe` | Record a check/cash payment (`paid_out_of_band`) | C | N | E |
| `invoice_void` | Void an open invoice | C | C | E |
| `invoice_mark_uncollectible` | Write off | C | N | E |
| `creditnote_list` / `creditnote_get` | Credit notes | — | C | R |
| `creditnote_preview` | Exact effect of a credit note before issuing | — | N | R |
| `creditnote_create` | Issue (refund, credit balance, or reduce amount due) | $ | C | E |
| `creditnote_void` | Void a credit note | C | C | E |
| `quote_list` / `quote_get` | Quotes | — | C | R |
| `quote_create` / `quote_update` | Draft quotes | P | C | F |
| `quote_finalize` / `quote_accept` / `quote_cancel` | Quote lifecycle | C | C | F |
| `quote_get_pdf_link` | Link to the quote PDF | — | N | R |

## Catalog (`product_*`, `price_*`, `coupon_*`, `promo_*`, `feature_*`, `taxrate_*`) — 33

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `product_list` / `product_get` / `product_search` | Products | — | C/C/R | R |
| `product_create` / `product_update` | Products | P | C | E |
| `product_archive` / `product_unarchive` | Hide or bring back a product | P | C/N | E |
| `product_delete` | Delete a product with no prices | C | R | F |
| `price_list` / `price_get` / `price_search` | Prices (by product, lookup key) | — | C/C/R | R |
| `price_create` | One-time or recurring price (with `lookup_key`) | P | C | E |
| `price_update` | Nickname, lookup key, metadata, active (prices are otherwise unchangeable; says so) | P | C | E |
| `coupon_list` / `coupon_get` | Coupons | — | C | R |
| `coupon_create` / `coupon_update` | Coupons | P | C/R | E |
| `coupon_delete` | Delete a coupon | C | C | E |
| `promo_list` / `promo_get` / `promo_find_by_code` | Promotion codes | — | C/C/R | R |
| `promo_create` / `promo_update` | Codes customers type | P | C | E |
| `feature_list` / `feature_create` | Entitlement features | — / P | C | F |
| `feature_attach_to_product` / `feature_detach_from_product` / `feature_list_for_product` | Product features | P / C / — | C/N/C | F |
| `entitlement_list_active` | What a customer is entitled to | — | C | R |
| `taxrate_list` / `taxrate_get` / `taxrate_create` / `taxrate_update` | Manual tax rates (the app uses these) | — / — / P / P | C | E |

## Stripe Tax (`tax_*`) — 12

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `tax_get_settings` / `tax_update_settings` | Stripe Tax head office and defaults | — / C | C | F |
| `tax_calculate` | Tax on a basket for an address | — | C | R |
| `tax_list_registrations` / `tax_add_registration` / `tax_end_registration` | Where you are registered to collect | — / C / C | N | F |
| `tax_list_transactions` / `tax_get_transaction` | Recorded tax transactions | — | C | R |
| `tax_record_transaction` / `tax_reverse_transaction` | Record from a calculation, or reverse | C | N | F |
| `tax_list_codes` / `tax_get_code` | Tax codes | — | C | R |

## Money out: balance, payouts, bank accounts (`money_*`) — 17

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `money_get_balance` | Available and pending, per currency, in dollars | — | C | R |
| `money_list_balance_transactions` / `money_get_balance_transaction` | Every money movement with fees | — | C/R | R |
| `money_list_payouts` / `money_get_payout` | Payouts and arrival dates | — | C | R |
| `money_list_payout_transactions` | What made up one payout (for matching to the bank statement) | — | N | R |
| `money_create_payout` / `money_cancel_payout` / `money_reverse_payout` | Manual payouts | $ / C / C | C | F |
| `money_update_payout` | Payout metadata | P | C | F |
| `money_get_payout_schedule` / `money_set_payout_schedule` | Daily/weekly/monthly, delay days | — / C | N | F |
| `money_list_bank_accounts` | Bank accounts payouts go to (last 4 only) | — | C | R |
| `money_list_topups` / `money_get_topup` | Top-ups | — | C | F |
| `money_create_topup` / `money_cancel_topup` | Top-ups | $ / C | C | F |

Removed on purpose: `stripe_create_bank_account`, `stripe_verify_bank_account`,
`stripe_delete_bank_account` (bank numbers never pass through chat; adding or
removing a payout bank account is done in the dashboard, which
`stripe_where_is_setting` links to).

## Disputes (`dispute_*`, `file_*`) — 9

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `dispute_list` / `dispute_get` | Disputes, with evidence deadline in Colorado time and days left | — | C | R |
| `dispute_save_evidence` | Save draft evidence (not submitted) | P | F | E |
| `dispute_submit_evidence` | Submit evidence (final; Stripe allows one submission) | C | R | E |
| `dispute_accept` | Accept (lose) the dispute | C | C | E |
| `file_upload_evidence` | Upload a document from a Google Drive link or a public URL as dispute evidence | P | R | E |
| `file_list` / `file_get` / `file_create_link` | Files | — / — / P | C | R |

## Risk and identity (`radar_*`, `identity_*`) — 16

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `radar_list_fraud_warnings` / `radar_get_fraud_warning` | Early fraud warnings | — | N | R |
| `radar_list_reviews` / `radar_get_review` / `radar_approve_review` | Payments Radar held for review | — / — / C | N | F |
| `radar_list_value_lists` / `radar_create_value_list` / `radar_delete_value_list` | Block/allow lists | — / P / C | C | F |
| `radar_list_list_items` / `radar_add_list_item` / `radar_remove_list_item` | List entries (block an email, card fingerprint, IP) | — / P / C | C | F |
| `identity_list_sessions` / `identity_get_session` | ID verification sessions | — | C | F |
| `identity_create_session` / `identity_cancel_session` | Start or cancel a verification (returns the hosted URL) | P / C | C | F |
| `identity_redact_session` | Erase a verification's personal data | C | C | F |

Removed pending check: `stripe_list/get/create/delete_radar_rule` (FINDINGS bug 9).

## Events and webhooks (`event_*`, `webhook_*`, `testclock_*`) — 15

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `event_list` / `event_get` | Recent events (type, object, related app record) | — | C | R |
| `event_list_undelivered` | Events whose webhook delivery has not succeeded | — | N | R |
| `webhook_list` / `webhook_get` | Endpoints and the events each sends | — | C | R |
| `webhook_create` | New endpoint; its signing secret is shown **once**, in the result only, with a warning to put it straight into Vercel | C | C | F |
| `webhook_update` | URL, description, enabled/disabled | C | C | F |
| `webhook_add_events` / `webhook_remove_events` | Add or remove event types without retyping the list | P / C | N | E |
| `webhook_delete` | Delete an endpoint | C | C | F |
| `webhook_check_signature` | Check a pasted test payload + signature header against an endpoint (paste the secret on the setup page, never in chat) | — | R | F |
| `testclock_list` / `testclock_create` / `testclock_advance` / `testclock_delete` | Test clocks: run a test customer's subscription months ahead in minutes (test mode only) | — / P / P / C | N | F |

## Reports and account (`report_*`, `account_*`) — 10

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `report_list_types` | Available financial reports | — | C | R |
| `report_run` / `report_get_run` / `report_list_runs` | Run a report (balance summary, payout reconciliation, itemized fees) and get its download link | P / — / — | C | R |
| `account_get` | Business profile, branding, statement descriptor, charges/payouts enabled, what Stripe still needs and by when | — | C | R |
| `account_list_capabilities` | Payment method capabilities | — | C | R |
| `account_list_payment_method_settings` / `account_update_payment_method_settings` | Which payment methods Checkout offers (for example turning ACH on) | — / C | N | F |
| `account_list_apple_pay_domains` / `account_add_apple_pay_domain` | Apple Pay domains | — / P | N | F |

## Branding and setup (`brand_*`, `setup_*`) — 16

How customers see the business on every Stripe page (Checkout, payment links,
invoices, receipts, the customer portal), and the account settings a new
business needs. Two levels exist in Stripe, and the tools say which one they
touch:

- **Account-wide branding** (logo, icon, two colors, used on receipts,
  invoices, Checkout and the portal). Stripe's API exposes these as
  `settings.branding`, but documents that endpoint for *connected* accounts.
  Card P4-7 tests whether Stripe accepts the change for Chris's own account;
  if it refuses, `brand_set_account_branding` uploads the files, then hands
  Chris the one dashboard link and exact clicks, and checks afterwards that
  the change took (never pretends it did it).
- **Per-page branding** on each Checkout page and payment link
  (`branding_settings`: logo, icon, background and button colors, corner
  style, one of Stripe's ~25 fonts, the business name shown at the top),
  plus custom text around the pay button and terms. Fully supported by the
  API, so the server keeps a saved **brand kit** per business and applies it
  to every Checkout and payment link it creates.

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `brand_get` | Current account branding (logo, icon, colors), the saved brand kit, and how a sample Checkout page will look (preview link in test mode) | — | N | R |
| `brand_upload_image` | Upload a logo or icon from a public URL or shared Google Drive link (checks size, square for icons) | P | N | E |
| `brand_set_account_branding` | Logo, icon, primary and secondary color for receipts, invoices, Checkout and portal (API if Stripe allows it for this account, otherwise guided dashboard step plus check) | C | N | F |
| `brand_save_kit` | Save the per-page brand kit (colors, corners, font, display name, logo/icon, button wording, terms text) used for every Checkout and payment link this server makes | P | N | E |
| `brand_preview_checkout` | Make a test-mode Checkout page with the kit so Chris can look at it on his phone | P | N | E |
| `brand_set_statement_descriptor` | What shows on customers' card and bank statements (22-character limit checked; short prefix for cards) | C | N | F |
| `brand_set_public_details` | Business name, support email, phone, website, support address shown on receipts and Checkout | C | F | F |
| `brand_set_invoice_defaults` | Invoice footer, memo, custom fields, payment terms, default tax IDs; numbering shown as a dashboard step if the API does not allow it | C | N | F |
| `brand_list_invoice_templates` / `brand_get_invoice_template` | Saved invoice templates | — | N | R |
| `brand_archive_invoice_template` / `brand_unarchive_invoice_template` | Retire or bring back an invoice template | P | N | F |
| `brand_set_portal_look` | Customer portal headline, privacy and terms links, default return URL | C | N | F |
| `setup_set_payout_schedule` | Daily / weekly / monthly payouts and delay (same API caveat as account branding; same fallback) | C | N | F |
| `setup_set_card_safety` | Decline on wrong ZIP or wrong CVC | C | N | F |
| `setup_set_dashboard_timezone` | The time zone the Stripe dashboard uses (America/Denver) | C | N | F |

Removed from `account_*` to avoid two tools doing one job:
`account_update_profile` (now `brand_set_public_details` and
`brand_set_statement_descriptor`).

## Workflows (`workflow_*`) — 13

Each runs several Stripe calls and answers in plain English. Read-only ones
are marked `R`; the rest preview first and confirm before money moves.

| Tool | What it does | Safety | Profile |
| --- | --- | --- | --- |
| `workflow_money_snapshot` | Balance, next payouts, money in and out in a window (paged, per currency), correct MRR/ARR (quantity, interval count, discounts; trialing shown separately), churn in the window, past-due count, failed payments, open disputes with deadlines | — | R |
| `workflow_failed_payments` | Who failed, how much, why in words, when Stripe retries next, the hosted invoice link to send them, and whether it is an app record | — | R |
| `workflow_customer_overview` | Everything about one customer: payment methods (last 4), subscriptions, open and recent invoices, refunds, balance, disputes, app record links | — | R |
| `workflow_refund_customer` | Find the right charge from a plain description ("their deposit from last month"), show refundable amount, refund with reason, read back | $ | E |
| `workflow_cancel_customer` | Cancel subscriptions (now or period end), optional prorated or full refund, optional void open invoices; one preview of everything first | $ | E |
| `workflow_change_plan` | Find the subscription, show the exact price difference, apply, read back | $ | E |
| `workflow_dispute_kit` | Gather what the dispute needs (customer, receipt, invoice, signed agreement from app metadata, refund policy), draft evidence, save it, and list what Chris must add before the deadline. Submitting stays a separate confirmed step | P | E |
| `workflow_webhook_health` | For each endpoint: enabled events vs what each of Chris's apps needs, undelivered events in the last 3 days, test/live parity; offers the exact fix (calls `webhook_add_events`) | C* (only when applying the fix) | E |
| `workflow_go_live_checklist` | Compares test and live: account activated, what Stripe still needs, products and prices by lookup key, tax rates, webhook endpoint and events, portal configuration, ACH enabled, statement descriptor, branding. Lists exactly what to do and offers to copy catalog items to live (confirm, live) | C* | F |
| `workflow_month_end_close` | For a calendar month: gross, refunds, disputes, fees, net, payouts and what each contained, tax collected, plus a report-run download link for the accountant | — | R |
| `workflow_set_up_catalog` | Create products and prices from a plain list ("washer/dryer pair, $65 a month"), using lookup keys so running it twice changes nothing | P | E |
| `workflow_brand_business` | One sentence sets up how a business looks and reads everywhere on Stripe: uploads logo/icon, sets colors (account-wide where allowed), saves the brand kit, statement descriptor, public support details, invoice footer, portal links; previews all of it first and finishes with a test Checkout link to look at. The Stripe version of the Workspace server's `workflow_brand_mailbox` | C | F |
| `workflow_find` | One search box: an email, name, last 4, amount, app ID or Stripe ID → what it is and the matching records | — | R |

## Connect (`connect_*`) — optional, P9-1 — 16

Accounts list/get/create/update/reject/delete, account links, login links,
capabilities list/update, transfers create/list/get/reverse, application fees
list/get/refund. Built only when YardSync or Cortiware actually needs to take
payments on behalf of other businesses. Carried over from the toolkit, with
`$` on transfers and fee refunds and `C` on reject/delete.

## Everything else in Stripe: the universal tools (`api_*`) — 4

Goal: an agent can do almost anything in Stripe for Chris. The hand-built
tools above are the comfortable, plain-English way to do the common jobs. For
everything else, these four reach **every operation in Stripe's API** (well
over 500), including Terminal, Issuing, Treasury, Financial Connections,
Climate, shipping rates, Checkout custom fields and anything Stripe adds
later, without waiting for a new card. Because the server uses compact mode,
this costs no extra context until it is used.

They are driven by **Stripe's own published API description** (the OpenAPI
file Stripe publishes for each API version, pinned to the same version as the
client). The server never guesses an endpoint or a parameter: it checks the
request against that file first and refuses anything that is not in it.

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `api_search` | Find Stripe operations by plain words ("terminal reader", "issuing card freeze"): method, path, one-line summary, and whether it reads, changes or moves money | — | N | R |
| `api_describe` | Parameters for one operation, trimmed to what matters, from Stripe's own description | — | N | R |
| `api_read` | Any GET operation. Same summaries, `fields`, size cap and handles as every other read | — | N | R |
| `api_write` | Any POST or DELETE operation, through the full safety layer (below) | C (always) | N | F |

How `api_write` stays safe:

- **Always needs `confirm: true`**, in test mode too, and supports `dryRun`.
  The preview shows the operation in plain words, the exact parameters, and
  the object as it is now (read first when the path has an ID).
- **Money detection.** A table (`src/stripe/money-operations.js`) marks every
  operation that moves money (refunds, payouts, transfers, captures,
  confirming payments, paying invoices, credit notes, top-ups, Issuing
  authorizations, Treasury outbound payments and transfers, and so on). Those
  get the dollar preview and count against the daily money limit. **Any
  operation not in the table that the description says creates, confirms,
  captures, pays, sends or transfers is treated as money-moving until someone
  adds it to the table** — the safe default.
- **Hand-built tools win.** If a hand-built tool exists for the operation,
  `api_write` refuses and names that tool, so the curated safety (exact
  refundable amount, app guard specifics, read-back checks) is never bypassed.
- **App guard and live guard apply** exactly as for every other write.
- **Read-back** by fetching the object again when the operation returns one
  with an ID; otherwise `confirmed: null` (nothing claimed).
- Change log row, idempotency key, undo when the change has a clean opposite
  (metadata, active/inactive flags).
- Only in the `full` profile, and passes need `allow_writes`.

When a pattern of `api_*` calls keeps coming up (for example if Chris starts
using card readers), that is the signal to build hand-made tools and a
workflow for it, in its own card.

## Things Stripe has no API for

Handled by `stripe_where_is_setting`, never faked: team members and roles,
two-step login, which emails Stripe sends customers (receipts, failed-payment
and renewal reminders), Radar rules, a custom domain for Checkout, invoice
numbering, resending a webhook, dashboard home-screen widgets. For each it
returns the exact dashboard link and numbered clicks **as structured steps**,
so an agent that has a browser (Claude in Chrome, Claude's own browser) can
carry them out with Chris watching and approving, and then the server checks
the result where Stripe lets it read the setting back.

## Totals

282 tools without Connect (298 with it), plus the four `api_*` tools reach every other Stripe operation. The `everyday` profile
has about 125; `read_only` about 115 (P1-6 prints the exact numbers). In compact mode (CONTEXT-AND-ACCESS.md)
an agent loads only about 20 of them up front and reaches the rest through
`stripe_search_tools` / `stripe_call`.
