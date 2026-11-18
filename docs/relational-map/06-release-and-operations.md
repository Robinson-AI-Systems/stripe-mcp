# 06 — Release and operations

## Branches

- `main` — development branch; all PRs target `main`
  (`.github/workflows/pr-target.yml` enforces it).
- `live` — production branch, promoted from `main` by the checked
  promoter.

## Promotion (`main` → `live`)

- Workflow: `.github/workflows/promote-live.yml` — nightly at
  20:53 America/Denver (with bounded missed-run recovery crons), plus
  owner-only dispatch paths (missed-daily recovery, owner release
  with the exact expected main SHA). The promoter
  (`scripts/promote-live.mjs`, tested by `scripts/promote-live.test.mjs`)
  is a checked promotion: exact-head green CI and the exact SHA gate
  every release.
- **Post-rack-move state (2026-11-08):** production is the rack image
  of `main`, and the daily promotion workflow was disabled the day of
  the move because its hosted Vercel deploy target no longer exists;
  the promotion machinery itself is unchanged and remains the owner's
  standing decision (`docs/STATUS.md`, 2026-11-08). Do not read the
  workflow file alone as proof a hosted promotion can still run.

## CI (`.github/workflows/ci.yml`)

- `check` job: `npm run check` — secret scan, docs-updated, PR-card
  index, lint, write guards, budgets, OpenAPI verification,
  capability inventories, developer evidence, session checks — plus
  the daily-live / hosting-policy validation.
- Unit, DB (disposable Postgres), and stripe-mock suites
  (`npm test`, `npm run test:db`, `npm run test:mock`) gate merges.

## Production operations

- **Host:** Development Rack (see 01); health at `/api/health`
  (`src/health.js`).
- **Inbound Stripe webhooks (TEST):** Stripe posts test events to
  `/api/stripe/test-webhooks/{account}/{endpoint}`; the receiver is
  the raw-body route — the signature is verified against
  `webhook_signing_secrets` (`src/webhooks/test-receiver.js`,
  `signature-store.js`) and receipts are stored
  (`test_webhook_receipts`) for the dev tools to inspect.
- **Event forwarders (TEST):** dev forwarders
  (`src/dev/forwarder-*.js`, `dev_forwarders` /
  `dev_forwarder_replays` tables) replay received events to local
  development endpoints, with replay records kept for inspection.
- **Dev simulation (TEST):** `src/dev/triggers*.js` and the
  simulation-cycle store drive Stripe test-mode scenarios (charges,
  checkout, disputes, invoice/subscription lifecycles, failures)
  through test clocks — test data only, behind the dev tool families.
- **Housekeeping:** `.github/workflows/git-housekeeping.yml` runs the
  owner-authorized branch preserve-and-prune plan on pushes to `main`.
