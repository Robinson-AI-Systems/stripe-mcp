# Tool catalog

**Current implementation (2026-10-10):** Protected account tools and
private owner money consent completed through #35; complete Batch C result
handles and compact discovery merged #36; all 17 native TEST customer tools
merged #37 (eight reads, nine `defineWrite-v1` guarded writes). Mutations
require explicit confirmation, app-owned protection, idempotency, audit and
read-back. Customer balance credits and debits require separately authenticated
exact owner approval, even for $0.01. **LIVE remains OFF (IN-06)**. No Stripe
account, hosted production infrastructure or real provider money action has
been activated. Remaining catalog rows are planned; legacy compatibility is
not required. The D-2 set (19 native payment, charge, refund and setup operations) merged in #38, with full exact-head CI and security self-review passing. Incoming charges/captures require explicit confirmation, and outgoing refunds separately require owner approval. D-3's 16 hosted tools merged in PR #39 after full exact-head CI; no LIVE use or client-secret exposure.

Every tool this server will have, by area — the product scope. Tools serve three audiences (tagged per tool when built,
Robinson Tool Contract §3): developers building for others, developers building for themselves, and the account owner
running the account. The implementing model builds exactly these;
anything else goes in `docs/ROADMAP.md` and the PR report. Which batch builds each area: Server tools B-8/C-2/R-1/X-1,
Customers…Invoices D, Catalog/Tax/Usage/quotes E, Developer tools and test clocks V, Money out…Reports G, Branding H, Universal U,
Project profiles P, Workflows W. When a tool merges, its Origin cell gains `built #<PR>`.

**Origin:** `C`, `F`, and `R` record where a capability was first identified in the historical
completeness audit (`docs/audits/2026-10-10-existing-stripe-code.md`); `F` also flags a known defect to avoid.
`N` is newly identified. Origins do **not** require legacy implementations, aliases, or compatibility.
Build current tools against the pinned official Stripe API.
**Safety:** `—` reads only · `P` preview available (dryRun) · `C` needs
`confirm: true` · `C*` needs confirm only for some uses (stated) · `$` moves
money (dollar preview, daily limit, always confirm).
**Profile:** `R` read_only and up · `E` everyday and up · `F` full only.
(Every read tool is in `R`; the column shows the lowest profile that has it.)

## Server about itself (`stripe_*`) — 18

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `stripe_whoami` | Selected account, TEST mode, profile, masked key, actual shared USD daily limit/used amount | — | built #16, amount status #28 | R |
| `stripe_list_accounts` | Stripe accounts this server holds keys for, and which modes each has | — | built #16 | R |
| `stripe_set_default_account` | Set the default account shown to NEW AI connections; private owner page only, public MCP tool gated | P | private owner action #32; MCP planned | F |
| `stripe_check_key_permissions` | Re-probe encrypted server-only TEST key; compact/full output and optional fields | — | built #29 | R |
| `stripe_list_connections` | Selected-account AI connection metadata, never credentials | — | built B-8a | R |
| `stripe_revoke_connection` | Revoke a particular connection; owner-only private setup flow in B-8b2a, AI-callable tool still gated | C | planned MCP; private owner flow B-8b2a | F |
| `stripe_enable_live` / `stripe_disable_live` | Enabling remains OFF (IN-06); private owner page can emergency-disable LIVE only (B-8b2b1). Neither is AI-callable yet | C | private disable #31; MCP tools planned | F |
| `stripe_set_money_limit` | Private owner-only per-account USD cap change; no AI-callable tool yet, every money-out still requires owner consent | C | private owner flow #33; MCP planned | F |
| `stripe_recent_changes` | Account-scoped audit summaries without raw snapshots (advanced filters later) | — | built B-8a | R |
| `stripe_undo_change` | Undo one change-log entry when it has a clean opposite; says plainly when it does not | C | N | E |
| `stripe_search_tools` | Find tools by plain words; one line each with safety marks (compact mode's front door) | — | built #36 | R |
| `stripe_describe_tool` | Full instructions and arguments for one tool | — | built #36 | R |
| `stripe_call` | Run any tool in the profile by name, through the same guards | as the tool | built #36 | R |
| `stripe_batch` | Up to 10 read calls in one round trip | — | built #36 | R |
| `stripe_get_result` | Page through a big redacted result restricted to the same OAuth connection for 24 hours | — | built #36 | R |
| `stripe_create_pass` | Make a short-lived pass for the HTTPS API and Robinson's Toolkit (shown once on the setup page; test, read-only, 24 h, $0 by default; RTC §2) | C | N | F |
| `stripe_where_is_setting` | Common dashboard-only setting guidance, no API write | — | built B-8a | R |

## Customers (`customer_*`) — 17

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `customer_list` | List customers (by email, created date) | — | built #37 | R |
| `customer_get` | One customer, with default payment method summary and app record link if any | — | built #37 | R |
| `customer_search` | Stripe search (`email:`, `name~:`, `metadata['agreementId']:`) | — | built #37 | R |
| `customer_find` | Plain search: name, email, phone or app ID; tries the right search for you | — | built #37 | R |
| `customer_create` | New customer | P | built #37 | E |
| `customer_update` | Name, email, phone, address, description, metadata | P | built #37 | E |
| `customer_delete` | Delete (cancels their subscriptions; cannot be undone) | C | built #37 | F |
| `customer_list_payment_methods` | Saved cards and bank accounts (brand, last 4, expiry only) | — | built #37 | R |
| `customer_get_payment_method` | One payment method | — | built #37 | R |
| `customer_remove_payment_method` | Detach a saved card or bank account | C | built #37 | E |
| `customer_set_default_payment_method` | Which saved method pays invoices | P | built #37 | E |
| `customer_list_balance_transactions` | Account credit/debit history | — | built #37 | R |
| `customer_add_balance_credit` | Add credit (or a debit) to a customer's balance | $ | built #37 | E |
| `customer_list_tax_ids` / `customer_add_tax_id` / `customer_delete_tax_id` | Tax IDs | — / P / C | built #37 | E |
| `customer_remove_discount` | End a customer-level coupon | C | built #37 | E |

## Payments and refunds (`payment_*`) — 19

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `payment_list` / `payment_get` / `payment_search` | Payment intents | — | built #38 | R |
| `payment_charge_saved_method` | Charge a customer's saved card/bank off-session for a one-off amount (description required) | $ | built #38 | E |
| `payment_capture` | Capture an authorized payment (full or part) | $ | built #38 | E |
| `payment_cancel` | Cancel an uncaptured payment | C | built #38 | E |
| `payment_update` | Description, metadata, receipt email | P | built #38 | E |
| `charge_list` / `charge_get` / `charge_search` | Charges, with outcome and decline reason in words | — | built #38 | R |
| `charge_update` | Description, metadata, receipt email | P | built #38 | E |
| `payment_create_refund` | Refund all or part of a charge or payment, with reason; checks refundable amount first | $ | built #38 | E |
| `payment_list_refunds` / `payment_get_refund` | Refunds | — | built #38 | R |
| `payment_update_refund` | Refund metadata | P | built #38 | E |
| `payment_cancel_refund` | Cancel a refund still pending (bank refunds) | C | built #38 | E |
| `setup_list` / `setup_get` | Setup intents (saving a payment method) | — | built #38 | R |
| `setup_cancel` | Cancel a setup intent | C | built #38 | E |

Removed on purpose: `stripe_create_payment_intent` / `stripe_confirm_payment_intent`
with raw payment method IDs and returned `client_secret` (replaced by
`payment_charge_saved_method` and hosted Checkout), `stripe_create_setup_intent`
(replaced by `checkout_create_setup_link`).

## Checkout, payment links and the customer portal (`checkout_*`) — 16

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `checkout_create_payment_link_for_customer` | A one-time hosted Checkout page for a customer and amount/prices, in the saved brand kit; returns the URL | P | built #39 | E |
| `checkout_create_setup_link` | Hosted page where a customer saves a card or bank account (replaces `stripe_onboard_customer`'s secret) | P | built #39 | E |
| `checkout_list` / `checkout_get` / `checkout_list_line_items` | Checkout sessions | — | built #39 | R |
| `checkout_expire` | Kill an open Checkout link | C | built #39 | E |
| `paylink_list` / `paylink_get` | Reusable payment links | — | built #39 | R |
| `paylink_create` / `paylink_update` | Create or change a reusable payment link | P | built #39 | E |
| `paylink_deactivate` / `paylink_activate` | Turn a link off or back on | P | built #39 | E |
| `portal_create_session` | Customer portal link for one customer | P | built #39 | E |
| `portal_list_configurations` / `portal_get_configuration` | What the portal lets customers do | — | built #39 | R |
| `portal_update_configuration` | Change what the portal allows (cancel, switch plan, update payment method) | C | built #39 | F |

## Subscriptions (`billing_*`) — 21

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `billing_list_subscriptions` / `billing_get_subscription` / `billing_search_subscriptions` | Subscriptions, with each item's current period (read from items, not the subscription) | — | built #40 | R |
| `billing_create_subscription` | Start a subscription on a saved payment method; preview shows the first charge and date | $ | built #40 | E |
| `billing_update_subscription` | Metadata, description, default payment method, billing anchor rules | P | built #40 | E |
| `billing_preview_change` | Exact price difference of a plan or quantity change, using `invoices/create_preview` | — | built #40 | R |
| `billing_change_plan` | Switch price or quantity with proration choice; preview is the exact amount | $ | built #40 | E |
| `billing_cancel_subscription` | Cancel now (with optional final invoice/proration) or at period end (done correctly, by update) | C | built #40 | E |
| `billing_undo_cancel` | Clear a scheduled cancel-at-period-end | P | built #40 | E |
| `billing_pause_collection` / `billing_resume_collection` | Pause or resume payment collection | C / P | built #40 | E |
| `billing_list_items` | Items on a subscription | — | built #40 | R |
| `billing_add_item` / `billing_update_item` / `billing_remove_item` | Item changes, each with proration preview | $ / $ / C | built #42 | E |
| `billing_list_schedules` / `billing_get_schedule` | Subscription schedules | — | built #40 | R |
| `billing_create_schedule` / `billing_update_schedule` | Future plan changes | P | built #42 | F |
| `billing_release_schedule` / `billing_cancel_schedule` | End a schedule | C | built #42 | F |


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
| `invoice_list` / `invoice_get` / `invoice_search` | Invoices, with hosted link, status and USD totals | — | built #43 | R |
| `invoice_list_payments` | Payments applied to an invoice (the app reads these) | — | built #43 | R |
| `invoice_preview` | Verified TEST next invoice with USD line/total projection | — | built #43 | R |
| `invoice_create_draft` | New draft invoice | P | built #43 | E |
| `invoice_update_draft` | Due date, memo, footer, custom fields, metadata | P | built #43 | E |
| `invoice_add_line` / `invoice_update_line` / `invoice_remove_line` | Draft invoice lines | P / P / C | built #43 | E |
| `invoice_delete_draft` | Delete a draft | C | built #45 | E |
| `invoice_finalize` | Lock a draft so it can be paid or sent | C | built #45 | E |
| `invoice_send` | TEST invoice.sent event (no real email) | C | built #45 | E |
| `invoice_charge_now` | Try to collect an open invoice now (Stripe's "pay") | $ | built #45 | E |
| `invoice_mark_paid_outside_stripe` | Record a check/cash payment (`paid_out_of_band`) | C | built #45 | E |
| `invoice_void` | Void an open invoice | C | built #45 | E |
| `invoice_mark_uncollectible` | Write off | C | built #45 | E |
| `creditnote_list` / `creditnote_get` | Credit notes | — | built #46 | R |
| `creditnote_preview` | Exact effect of a credit note before issuing | — | built #46 | R |
| `creditnote_create` | Issue (refund, credit balance, or reduce amount due) | $ | built #46 | E |
| `creditnote_void` | Void a credit note | C | built #46 | E |
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
| `money_get_balance` | TEST available/pending by currency, provider minor units | — | built #79 | R |
| `money_list_balance_transactions` / `money_get_balance_transaction` | TEST balance transactions with validated fees/net | — | built #79 | R |
| `money_list_payouts` / `money_get_payout` | TEST payout amount, status, arrival and destination ID only | — | built #79 | R |
| `money_list_payout_transactions` | TEST automatic payout balance transactions (manual payouts refused) | — | built #79 | R |
| `money_create_payout` / `money_cancel_payout` / `money_reverse_payout` | Manual payouts; TEST pending manual cancel guarded | $ / C / $ | cancel built #81; create built #82; reverse built #83 (CI pending) | F |
| `money_update_payout` | TEST payout metadata only, guarded | P | built #81 (CI pending) | F |
| `money_get_payout_schedule` / `money_set_payout_schedule` | TEST own-account schedule read (built #80); change is planned with owner guard | — / C | read #80; setter built #87 (CI pending); guided own-account refusal | F |
| `money_list_bank_accounts` | TEST own-account payout destinations, last4 only; explicit unavailable on Connect-only API denial | — | built #80 | R |
| `money_list_topups` / `money_get_topup` | TEST top-up reads, no bank/source leakage | — | built #79 | F |
| `money_create_topup` / `money_cancel_topup` | TEST synthetic-bank top-up (owner approved) / pending cancel | $ / C | built #84 (CI pending); real bank OFF | F |

Removed on purpose: `stripe_create_bank_account`, `stripe_verify_bank_account`,
`stripe_delete_bank_account` (bank numbers never pass through chat; adding or
removing a payout bank account is done in the dashboard, which
`stripe_where_is_setting` links to).

## Disputes (`dispute_*`, `file_*`) — 9

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `dispute_list` / `dispute_get` | Safe TEST dispute status, amount and Colorado response deadline; no private evidence | — | built #90 | R |
| `dispute_save_evidence` | Confirmed TEST-only draft evidence with submit:false and exact read-back; never submitted to bank | P | built #93 | E |
| `dispute_submit_evidence` | Irreversible confirmed TEST evidence submission, safe full-field preview | C | built #95 | E |
| `dispute_accept` | Irreversible ordinary TEST dispute loss; exact owner-approved money out and $500/day cap | $ | built #96 | E |
| `file_upload_evidence` | Confirmed TEST upload of public PDF/PNG/JPEG or shared Drive file (10 MiB, SSRF defense); never submits dispute | P | built #92 | E |
| `file_list` / `file_get` / `file_create_link` | Safe TEST file metadata and confirmed time-limited public BRAND links only; never link private evidence | — / — / P | built #91 | R reads; F link |

## Risk and identity (`radar_*`, `identity_*`) — 16

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `radar_list_fraud_warnings` / `radar_get_fraud_warning` | TEST early fraud warnings, safe amount-free status | — | built #97 | R |
| `radar_list_reviews` / `radar_get_review` / `radar_approve_review` | Safe TEST reviews and guarded approval planned | — / — / C | reads built #97, approval built #98 | R reads; F approval |
| `radar_list_value_lists` / `radar_create_value_list` / `radar_delete_value_list` | TEST value list definitions; create/delete later | — / P / C | read built #97; create built #98; delete built #99 | R read; F writes |
| `radar_list_list_items` / `radar_add_list_item` / `radar_remove_list_item` | TEST item IDs only (no raw email/card/IP); writes next | — / P / C | list built #97; add/remove built #99 | R read; F writes |
| `identity_list_sessions` / `identity_get_session` | TEST identity status only; no verification evidence or client secret | — | built #100 | F |
| `identity_create_session` / `identity_cancel_session` | TEST creation with verified hosted URL; guarded pending-input cancellation | P / C | create built #100; cancel built #101 | F |
| `identity_redact_session` | Irreversible TEST redaction request, separately confirmed; async processing is not erasure | C | built #101 | F |

Removed pending check: `stripe_list/get/create/delete_radar_rule` (audit bug 9; G-3 checks).

## Events and webhooks (`event_*`, `webhook_*`) — 11

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `event_list` / `event_get` | Safe bounded TEST Event summaries, no embedded customer/payment data | — | built #103 | R |
| `event_list_undelivered` | TEST Events with provider delivery_success=false; no app processing claim | — | built #103 | R |
| `webhook_list` / `webhook_get` | TEST endpoint status/origin and bounded event subscriptions; paths, query and secrets redacted | — | built #104 | R |
| `webhook_create` | Guarded TEST endpoint, durable immutable retry; Stripe signing secret only on the independently authenticated one-time owner setup page, never in chat | C | built #109 | F |
| `webhook_update` | URL, description, enabled/disabled | C | C | F |
| `webhook_add_events` / `webhook_remove_events` | Confirmed TEST set union/difference preserving unrelated subscriptions, exact provider read-back | P / C | built #105 | E |
| `webhook_delete` | Guarded native TEST webhook deletion with provider tombstone verification | C | built #110 | F |
| `webhook_check_signature` | Check a pasted test payload + signature header against an endpoint (paste the secret on the setup page, never in chat) | — | R | F |

## Developer tools (`dev_*`, `testclock_*`) — 23 (test mode only; `docs/designs/BATCH-V.md`)

Building with Stripe on any project: realistic test data, precise cleanup, real test events, forwarding events into an
app under development, and time travel. Every tool refuses on a live connection.

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `dev_seed` | Tracked TEST catalog/store, subscriptions, dispute/ACH fixtures and Connect-gated seller onboarding (no money movement) | P | built #47/#48/#50/#52/#54/#56 | E |
| `dev_list_runs` | Account-scoped seed runs and exact recorded object counts | — | built #47 | R |
| `dev_connect_readiness` | Verify selected TEST platform Connect API access and actual capability state; no transfers/payouts | — | built #56 | R |
| `dev_seed_refund` | One owner-approved full refund of a run-owned TEST store charge, with verified ledger entry | $ | built #49 | E |
| `dev_confirm_seed_ach` | Confirm an unconfirmed run-owned TEST ACH intent and verify Stripe processing/action/success; no settlement assertion | P | built #55 | E |
| `dev_verify_outcomes` | Verify actual run-owned TEST dispute events, ACH state and exact succeeded event; never infer settlement or webhook delivery | — | built #51/#55 | R |
| `dev_cleanup` | Safely clean recorded TEST IDs, with zero-balance seller and dependency-free clock deletion; immutable money retained | C | built #57/#58 | E |
| `dev_reset_test_data` | Owner-guided TEST Dashboard reset, no fake bulk-delete API | — | V-2a #57 | R |
| `dev_list_triggers` / `dev_trigger_event` | Current TEST events via true guarded provider actions and independently verified Event IDs (seventeen types through V-3c3d; additional curated types later) | — / P | V-3a #59 / V-3b #60 / V-3c1 #61 / V-3c2 #62 / V-3c3a #63 / V-3c3b #64 / V-3c3c #65 / V-3c3d (hosted native TEST Checkout); more pending | E |
| `dev_create_forwarder` / `dev_list_forwarders` / `dev_delete_forwarder` | Guarded TEST register/list/soft-delete. A target's signing secret is shown only via owner-password-protected one-time setup page; no MCP secret exposure. Outbound sending is V-4c. | C / — / C | built #69 | E |
| `dev_forward_events` | Guarded TEST-only signed replay of up to five independently verified original Stripe Events (IDs or since/type); durable per-event HTTP status; uncertain retries never auto-resend | C | built #71 | E |
| `testclock_list` | Read TEST clock status and frozen time; inspect one exact clock ID | — | built #53 | R |
| `testclock_create` / `testclock_advance` | Create or advance guarded TEST clocks; async advance is only confirmed when provider ready | P / P | built #53 | E |
| `testclock_delete` | Delete a TEST clock after validating dependent records and destructive impact | C | planned V-5 | F |
| `dev_simulate_subscription` | Guarded TEST setup, one-cycle clock advance, inspect and independently verify exact renewal invoice, PaymentIntent and original Stripe Event; 1–3 months | P | setup #73; advance #76; observation #77 | E |
| `dev_test_cards` | Published TEST-only synthetic card/ACH PaymentMethod IDs, not card or bank numbers; safe case filters and pagination, no provider call | — | built #72 | R |

## Reports and account (`report_*`, `account_*`) — 10

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `report_list_types` | Complete TEST report type catalog, exact periods, paged | — | built #85 (CI pending) | R |
| `report_run` / `report_get_run` / `report_list_runs` | Guarded TEST async report request, run state and result file ID | P / — / — | run #86, get/list #85 | F for run; R reads |
| `report_get_result_file` | Verify a completed TEST run's finance_report_run file metadata only; private contents URL never returned | — | built #88; owner-only browser-only CSV delivery #89 (no AI content or URL) | R |
| `account_get` | Business profile, branding, statement descriptor, charges/payouts enabled, what Stripe still needs and by when | — | C | R |
| `account_list_capabilities` | Payment method capabilities | — | C | R |
| `account_list_payment_method_settings` / `account_update_payment_method_settings` | Which payment methods Checkout offers (for example turning ACH on) | — / C | N | F |
| `account_list_apple_pay_domains` / `account_add_apple_pay_domain` | Apple Pay domains | — / P | N | F |

## Owner and administration (`admin_*`, guided settings) — 6 tools + guided settings (`docs/designs/BATCH-G.md` G-6)

For the account owner, not only developers (Chris, 2026-10-10). Everything owner-side in Stripe is covered: settings
with an API by real tools (here and in Branding and setup, Money out, Tax, Checkout/portal, Webhooks), and every
dashboard-only setting by a **guided setting** — structured steps a person or a browser-capable agent follows while Chris
watches, then checked by read-back where Stripe exposes the value (Robinson Tool Contract §11).

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `stripe_admin_overview` | The whole account in one view: business details and verification, what Stripe still needs and by when, capabilities, payouts and bank (last 4), branding and descriptor, payment methods, tax registrations, webhooks, portal, plus every guided setting's state (ok / needs attention / can't read) | — | N | R |
| `admin_list_requirements` | What Stripe needs from the business (documents, details) and the deadlines, in plain words, with the link to provide each | — | N | R |
| `admin_list_guided_settings` | Every dashboard-only setting the map covers, by section | — | N | R |
| `admin_check_setting` | Read back a guided setting's value where Stripe exposes it (e.g. after Chris changes it) | — | N | R |
| `admin_review_security` | What can be read about security (key kind and age as stored here, restricted-key permissions, webhook endpoints, connections and passes to this server) plus guided checks for two-step login, team roles and API keys | — | N | R |
| `admin_fees_and_billing` | What Stripe charges this account: fees by type for a period (from balance transactions), Stripe Billing/Tax/Radar fees, and links to Stripe's own invoices | — | N | R |

**Guided settings covered (dashboard-only; full list in `src/data/dashboard-map.js`, every settings page of the
dashboard):** team members, invitations and roles; two-step login and account security; API keys (create, roll,
restrict) — the steps never show a key to the agent; business details and verification documents; bank accounts for
payouts; customer emails (receipts, failed payments, renewals, card expiry); Billing revenue recovery (Smart Retries,
what happens after all retries fail); invoice numbering and defaults the API can't set; Radar rules; custom Checkout
domain (a purchase — always asks); notifications to the owner; connected apps and integrations; tax settings the API
can't set; deleting test data; closing the account (never automated — steps only).

## Branding and setup (`brand_*`, `setup_*`) — 16

How customers see the business on every Stripe page (Checkout, payment links,
invoices, receipts, the customer portal), and the account settings a new
business needs. Two levels exist in Stripe, and the tools say which one they
touch:

- **Account-wide branding** (logo, icon, two colors, used on receipts,
  invoices, Checkout and the portal). Stripe's API exposes these as
  `settings.branding`, but documents that endpoint for *connected* accounts.
  Card G-5 (trial) and H-1 test whether Stripe accepts the change for Chris's own account;
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

## Project profiles (`project_*`, readiness and setup) — 6

Optional, for any app you build whose own code runs Stripe billing. See `docs/designs/BATCH-P.md` and
`docs/APP-NEEDS-APPLIANCE-DESK.md` (an example profile).

| Tool | What it does | Safety | Origin | Profile |
| --- | --- | --- | --- | --- |
| `project_list` / `project_get` | Profiled projects on this server and what each needs from Stripe | — | N | R |
| `project_update_profile` | Change a profile (events, ownership keys, portal rules) after the project's own code changes | C | N | F |
| `project_draft_profile` | Draft a profile from what an agent found in a codebase (Stripe calls, events, metadata keys) | — | N | E |
| `workflow_app_readiness` | Is Stripe set up for this project (test or live; a profile or an inline spec for a project being built)? Every need: done / fixed (with confirm) / needs you (link + clicks) / needs a decision; prints the exact permission list for the project's own restricted key | C* (only when applying a fix) | N | E |
| `workflow_project_setup` | Start Stripe for a **new** project from a short plain description: webhook (secret via one-time page), portal, payment methods, brand kit, and products/prices only if the project won't create its own; returns a draft profile and the text for its `APP-NEEDS` file | C | N | F |

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
| `workflow_dispute_kit` | Gather what the dispute needs (customer, receipt, invoice, the signed agreement via the project profile's record links, refund policy), draft evidence, save it, and list what Chris must add before the deadline. Submitting stays a separate confirmed step | P | E |
| `workflow_webhook_health` | For each endpoint: enabled events vs what each profiled project needs, undelivered events in the last 3 days, test/live parity; offers the exact fix (calls `webhook_add_events`) | C* (only when applying the fix) | E |
| `workflow_go_live_checklist` | Compares test and live for an account: activation, what Stripe still needs, webhook endpoints and events, portal, payment methods, descriptor, branding; runs `workflow_app_readiness` for each profiled project on the account; offers to copy catalog items to live **only** for projects that don't create their own (confirm, live) | C* | F |
| `workflow_month_end_close` | For a calendar month: gross, refunds, disputes, fees, net, payouts and what each contained, tax collected, plus a report-run download link for the accountant | — | R |
| `workflow_set_up_catalog` | Create products and prices from a plain list ("washer/dryer pair, $65 a month"), using lookup keys so running it twice changes nothing | P | E |
| `workflow_brand_business` | One sentence sets up how a business looks and reads everywhere on Stripe: uploads logo/icon, sets colors (account-wide where allowed), saves the brand kit, statement descriptor, public support details, invoice footer, portal links; previews all of it first and finishes with a test Checkout link to look at. The Stripe version of the Workspace server's `workflow_brand_mailbox` | C | F |
| `workflow_find` | One search box: an email, name, last 4, amount, app ID or Stripe ID → what it is and the matching records | — | R |

## Connect (`connect_*`) — optional, not scheduled (ROADMAP) — 16

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

302 hand-built tools plus the 4 universal `api_*` tools (306 in all; 322 with Connect), plus guided settings for
every dashboard-only owner setting. The universal tools reach every other Stripe operation. The `everyday` profile
has about 125; `read_only` about 115 (B-6 prints the exact numbers). In compact mode (`docs/designs/BATCH-C.md`)
an agent loads only about 20 of them up front and reaches the rest through
`stripe_search_tools` / `stripe_call`.

## Implementation notes — B-2 (draft #21)

The LIVE authorization helper is internal only. It does **not** register or expose a tool, enable a live connection, accept a live key, or change the planned 302-tool catalog. Until the owner-controlled activation flow exists, all external write doors remain disabled.

## Implementation note — B-2b internal owner live-intent flow (#22)

This slice adds **no publicly listed Stripe tool**. The random ten-minute LIVE
enable intent and separately authenticated owner setup confirmation are internal
primitives, default-denied by `LIVE_MODE_OWNER_APPROVED` while IN-06 is not
authorized. `stripe_enable_live` is still an unbuilt/ungated B-8 catalog item;
no model call can reach these internals. Live keys remain unavailable.

## B-3 app-owned protection (internal, no exposed tools)

The app metadata guard is wired into the shared Stripe write adapter. This adds no new callable tools and does not change the tool catalog's built counts; B-8 and later batches will register guarded operations. Refund exceptions still require the mandatory owner-approved money contract.

## B-4 safe errors (no new callable tools)

Existing read handlers and guarded Stripe write adapters use safe, human-readable error formatting for recognized Stripe exceptions. No extra tool is exposed and money/authorization limits are unchanged.

## B-5 display companions (internal utility)

Tool results add human-readable amount/time values and mask sensitive keys. This does not expose any additional Stripe tool or allow writes.

## B-6 profile counts (in progress, no additional tools)

Home now displays read_only, everyday, and full counts for the tools currently exposed, not projected future tools. Unavailable/hidden names are refused before invoking handlers.

## B-7 guard metadata (internal, no additional tools)

Guarded write adapter declares a provider-derived money specification when one exists. The CI checker refuses missing writes, confirmation and money metadata. No money operation has been registered externally.

- **dev_get_checkout_test_url** (TEST only, read-only): returns Stripe-hosted payment URL for a precisely run-owned, still-open TEST checkout_session, checked against exact account/metadata/customer; genuine hosted payment must be completed by an operator/browser. No server SDK operation completes Stripe Checkout. URL stops on paid/expired session; retry the original dev_trigger_event requestKey to independently observe completed Event.
