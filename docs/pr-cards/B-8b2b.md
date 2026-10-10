# B-8b2b — Remaining protected account administration

Status: **NEXT, JIT card**, begin only after B-8b2a PR #30 merges.
Baseline: main after #30. Parent: `docs/pr-cards/B-8b2.md`.
Approved design: `docs/designs/BATCH-B.md` §4 B-8.
Risk: account settings and owner authorization; no real money or LIVE activity.

## Drift check A to repeat on current main
| Design assumption | At B-8b2a boundary | Correction |
| --- | --- | --- |
| Owner-only setup POST | Password, CSRF, origin and rate-limit already protect two-step revoke | Reuse for each admin intent |
| Atomic one-time admin intent | `owner_revoke_intents` specifically handles revocation | Generalize only if necessary; no bypass |
| Standard budget | $500 USD/account/Denver day and approval of every AI money-out | Never silently widen cap; owner limit changes require an independent owner action |
| LIVE enabling | IN-06 OFF, no live credential onboarding | Only safe emergency disable; never enable LIVE |
| AI write exposure | MCP deliberately read-only | Do not advertise account write tools until full seven-case contract and independent owner approval exist |

## Read only these
- `AGENTS.md`, `docs/SESSION-START.md`, `docs/PLAYBOOK.md` verification/merge, DRIFT A/B
- `docs/pr-cards/B-8b2.md`, `docs/designs/BATCH-B.md` §3/§4
- `src/stripe/setup-page.js`, `src/db.js`, `src/core/write.js`, `src/tools/write.js`
- `tests/unit/owner-revoke.test.js`, `tests/db/owner-revoke.test.js`, `docs/OWNER-INPUTS.md` IN-05/IN-06

## Remaining contract
Build exact-account owner-authenticated default-account selection, a securely
approved money-limit update that preserves the standing $500 default and
transaction-by-transaction approval, and emergency disable-LIVE (no enable).
All mutations require preview, explicit owner-authenticated final confirmation,
CSRF, origin, rate limiting, stale-state detection, audit and read-back;
if an action is exposed as an MCP write, it must use `defineWrite` and pass
the seven write-contract scenarios through that actual door. Never accept
owner authentication from agent-controlled flags or chat messages.

Tests: fake owner/browser actions, cross-account/CSRF/password/expiry/race,
local isolated PostgreSQL atomicity and audit; tool write contract where
applicable; `npm run check`, full exact-head `ci`, documented self-review.
No live keys, production money, paid provisioning or changes to other repos.
B-8c owner transaction approval remains an independent later card.
