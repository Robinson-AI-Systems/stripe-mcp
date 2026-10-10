# Design — Batch G: Money out, disputes, risk, events and webhooks, account settings

Status: **APPROVED once IN-00 is answered.** Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch G.
Cards G-1 … G-5. Depends on Batch D. Tool list: `docs/TOOL-CATALOG.md` sections Money out; Disputes; Risk and identity;
Events and webhooks; Reports and account.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| G1 | No `/v1/radar/rules` endpoint exists at the pinned version (rules are dashboard-only) | `node scripts/openapi-find.mjs "radar rule"` |
| G2 | Webhook endpoint create returns `secret` once; retrieve does not | read the `webhook_endpoint` schema |
| G3 | Events list supports a delivery filter (`delivery_success`) | `node scripts/openapi-find.mjs "list events"` |
| G4 | Payment method configurations are readable and updatable (`/v1/payment_method_configurations`) | same tool |
| G5 | Which account-level settings Stripe lets this account change on itself (`settings.payouts.schedule`, `settings.card_payments`, `settings.dashboard`, `settings.branding`) — the reference documents them for connected accounts | **test-mode trial** in G-5 / H-1: try each, record Stripe's answer in the PR |

## 1. Decisions

**G1. Radar rules:** if G1 holds, the toolkit's four rule tools are not rebuilt; `stripe_where_is_setting` covers rules.

**G2. Webhook signing secrets never go into chat.** `webhook_create` stores the returned secret in `one_time_secrets`
(Batch A, A10) and returns a link to view it once on the setup page, with the instruction "paste it into Vercel as
`STRIPE_WEBHOOK_SECRET` for <project>". Later reads never include a secret.

**G3. `webhook_add_events` / `webhook_remove_events`** read the current list and change only what was asked, then read back.

**G4. Disputes:** `dispute_save_evidence` drafts (`submit: false`); `dispute_submit_evidence` is separate, `C`, and its
preview lists every field and file being submitted plus the deadline in Colorado time. `file_upload_evidence` takes a public
URL or a shared Google Drive link, downloads server-side with a 10 MB cap, uploads with purpose `dispute_evidence`, never
puts bytes in chat.

**G5. Account settings that Stripe refuses to change through the API for Chris's own account** are handled by the
"guided" pattern: the tool does every part it can, returns `done: false` with the dashboard link and numbered clicks
(`stripe_where_is_setting` data), and after Chris says it's done, reads the account back to confirm. It never reports a
setting as changed unless the read-back shows it.

**G6. Payout bank accounts** are listed (last 4 only) but never added or removed through tools; bank numbers never pass
through chat.

## 4. Work units

### G-1 — Balance, balance transactions, payouts, payout transactions, top-ups, bank account list, reports (M)
### G-2 — Disputes and evidence files (M, medium effort)
### G-3 — Radar (fraud warnings, reviews, value lists) and Identity (M)
First step: G1 check, recorded in the PR.
### G-4 — Events and webhooks (M, medium effort)
Extra: secret shown once on the setup page and never in a result; `event_list_undelivered`; `webhook_check_signature`
(payload and header pasted into a tool; the secret entered on the setup page, never in chat).
### G-5 — Account: profile read, capabilities, payment method settings (ACH on/off), Apple Pay domains, payout schedule (M)
First step: G5 trial, recorded in the PR; tools follow G5's guided pattern where Stripe refuses.

## 5. Stop-and-ask points

1. G5 trial shows Stripe accepts *none* of the settings: still build the guided versions; tell Chris which settings are
   dashboard-only.

## 6. Acceptance mapping

| PLAN Batch G line | Evidence |
|---|---|
| Webhook secret never in a result | `tests/unit/webhooks.test.js` + key-scan test |
| Evidence submission is separate and confirmed | write-contract for `dispute_submit_evidence` |
| Guided settings never claim success without read-back | `tests/unit/account-guided.test.js` |

## Amendments
