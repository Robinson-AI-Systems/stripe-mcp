# 05 — Storage and secrets

## Store

- **One Postgres store**, reached through `src/db.js` over
  `src/db-transport.js`, which selects the Neon HTTP driver or pooled
  `pg` by URL shape. Schema creation is additive and runs once per
  process (`src/core/schema-once.js`); feature stores compose into
  `createDb` (webhooks, tenancy, metered billing, brand kits, app
  profiles, dev runs/forwarders/simulations).
- **Production store today:** the rack's Postgres (`stripe_production`,
  reconciled at the 2026-11-08 move; the hosted Neon store was retired
  the same day). Tests use disposable Postgres only.

## Tables (`SCHEMA_TABLES` in `src/db.js`: 35 tables, plus gated tenancy)

| Group | Tables |
|---|---|
| Enrolled accounts & keys | `stripe_accounts` (encrypted Stripe keys + probed permissions) |
| OAuth issuer | `oauth_clients`, `oauth_codes`, `oauth_tokens`, `login_attempts` |
| Money safety | `money_reservations`, `money_approvals`, `owner_money_limit_intents`, `owner_money_decision_intents`, `live_enable_intents` |
| Owner intents | `owner_revoke_intents`, `owner_disable_live_intents`, `owner_default_account_intents`, `owner_deenroll_intents`, `owner_delete_client_intents` |
| Work & results | `change_log`, `result_store`, `one_time_secrets`, `tax_transaction_index` |
| Billing extras | `meter_usage_claims`, `brand_kits`, `known_apps`, `app_profile_account_scope`, `project_setup_runs` |
| Developer (TEST) | `dev_runs`, `dev_run_objects`, `dev_forwarders`, `dev_forwarder_replays`, `dev_forwarder_replay_events`, `dev_simulation_cycles` |
| Webhooks | `webhook_create_intents`, `webhook_signing_secrets`, `test_webhook_receipts` |
| RTC / boundary | `rtc_pass_rates`, `developer_boundary_events` |
| Tenancy (gated, inactive) | tenancy tables incl. `tenancy_secrets` — only behind `STRIPE_TENANCY_SCHEMA_APPROVED=enabled` (see 02) |

## Secrets

- Stripe keys and one-time secrets are encrypted with **AES-256-GCM**
  (`src/core/crypto.js`); OAuth lookups search token **hashes**, not
  raw tokens (`hashToken` in `src/core/oauth.js`).
- Webhook signing secrets live in `webhook_signing_secrets`, written
  by the webhook-create flow and read only by the signature store
  (`src/webhooks/signature-store.js`) to verify inbound events.
- One-time secrets are revealed exactly once on the owner's own
  connection; a revealed record cannot be reopened.
