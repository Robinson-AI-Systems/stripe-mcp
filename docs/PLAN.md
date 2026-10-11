# PLAN — remaining scope and acceptance

Written 2026-10-10 for an empty repository. Order is in [MASTER-ROADMAP](MASTER-ROADMAP.md); current head and blockers in
[STATUS](STATUS.md). AGENTS owns workflow rules. This file owns acceptance; designs own semantic decisions; cards own the
next bounded implementation.

## Rules that apply to every batch

- Every write tool passes the seven write-contract checks (`docs/designs/BATCH-B.md` §3) through every door that exists.
- Every Stripe request shape passes against `stripe-mock` at the pinned API version.
- Database code passes on throwaway Postgres; schema changes are additive and idempotent.
- `npm run check` green: secret scan, docs check, index validation, lint, write-safety, token budgets.
- No secret in code, docs, tests, logs, PR text or tool results (key-scan test).
- Test mode only. No live key, no live write, no real money, no purchases (AGENTS hard limits).
- Owner inputs are inputs, not things to invent: build the mechanism, keep the dependent behavior off, list the `IN-xx`.
- Money shown in dollars and cents, stored in cents; times shown America/Denver, stored UTC.
- The PR description carries the card's acceptance checklist with evidence.

## Batch A — Foundation (`designs/BATCH-A.md`)
- [ ] CI runs check, unit, database and stripe-mock jobs on every PR; a failing test turns it red.
- [ ] Connector login with account, mode (test only until enabled), profile and listing; lockout after 5 tries in 15 minutes; tokens stored hashed.
- [ ] Keys stored only encrypted; added only on the setup page; previews refuse live keys; key-scan test passes.
- [ ] One Stripe client, pinned API version, idempotency key on every write, nested parameters correct (audit bug 4).
- [ ] One-time-secret page works (shown once, then gone).
- [ ] `docs/DEPLOY.md` followable by Chris.

## Batch B — Trust layer (`designs/BATCH-B.md`)
- [x] `defineWrite` with money spec, dollar preview, always-confirm money out, daily limit, read-back/verify, inverse (internal B-1 #18–#20; owner grant UI and live tools remain gated).
- [x] Live guard (internal two-step owner intent, no activation), app-owned guard (refund exception), plain-English errors, result shaping and profiles (#21–#26). IN-06 stays OFF.
- [x] `check-writes` fails on undeclared writes, missing `dryRun`, missing money spec (#27).
- [x] Server tools through #35: scoped reads, key re-probe, owner limit/default/revoke, LIVE disable and authenticated TEST money approval; LIVE activation still off (IN-06).

## Batch C — Cheap on context (`designs/BATCH-C.md`)
- [x] Summaries, `fields`, `detail`, handles, annotations, structured output (#36).
- [x] Catalog and compact listing; meta-tools route through guarded handlers (#36).
- [x] Budgets enforced in CI: compact <5,000 tokens, everyday catalog <20,000, descriptions ≤160 characters, results ≤8 KB or a handle (#36).

## Batch D — Everyday money (`designs/BATCH-D.md`)
- [ ] D-1 all 17 customers (#37), D-2 all 19 payments/refunds/setup (#38), D-3 all 16 hosted Checkout/portal tools (#39) complete; remaining D-4 subscriptions/schedules and D-5 invoices/credit notes.
- [ ] No `client_secret` in any result; setup via hosted Checkout.
- [ ] Regression tests for audit bugs 1, 3, 4, 5. The historical toolkit audit is a feature-coverage checklist only; no legacy aliases or name map.

## Batch V — Developer tools (`designs/BATCH-V.md`)
- [ ] Seed scenarios with every created object recorded; cleanup touches only recorded objects.
- [ ] Real test events triggered; events forwarded to an app under development with valid signatures; private URLs refused.
- [ ] Test clocks and subscription simulation; test cards; every tool refuses live mode.

## Batch G — Money out, disputes, risk, events, account (`designs/BATCH-G.md`)
- [ ] Every listed tool built; Radar-rules question answered from Stripe's description.
- [ ] Webhook signing secrets only via the one-time page.
- [ ] Account settings: by API where Stripe allows (trial recorded), otherwise guided with read-back.
- [ ] Owner side complete: admin overview, requirements, security review, fees; every dashboard settings page in the map as structured guided steps (contract §11).

## Batch H — Branding and setup (`designs/BATCH-H.md`)
- [ ] Brand kit applied to every page this server creates; never to pages a profiled app creates.
- [ ] Account-wide branding, public details, descriptor, invoice defaults, portal look, payout schedule, card safety, dashboard time zone.

## Batch P — Project profiles (`designs/BATCH-P.md`)
- [ ] `known_apps` with the Appliance Desk profile, each item traceable to the app's code.
- [ ] App guard reads profiles and names the owning app.
- [ ] `workflow_app_readiness` covers all 21 rows of the example profile and works with an inline spec; fixes previewed and confirmed; never creates a profiled app's catalog.
- [ ] `workflow_project_setup` for new projects, idempotent; `project_draft_profile` from codebase findings.

## Batch W — Workflows (`designs/BATCH-W.md`)
- [ ] All 13 workflows; MRR correct per W3; webhook fix exact; all writes confirmed and logged.

## Batch U — Universal tools (`designs/BATCH-U.md`)
- [ ] Four `api_*` tools; requests validated against Stripe's description; money detection with safe default; hand-built tools win; same guards.

## Batch R — Hub-ready doors, RTC 1 (`designs/BATCH-R.md`)
- [ ] Passes per RTC §2; HTTPS tool API, manifest and OpenAPI per RTC §1/§7.
- [ ] Same seven write-contract checks through MCP, `stripe_call` and HTTPS.
- [ ] RTC 1 conformance green in CI.

## Batch E — Catalog, Stripe Tax, usage, quotes (`designs/BATCH-E.md`)
- [ ] Every listed tool built; profiled apps' catalogs never touched; no legacy usage records.

## Batch X — Undo and smoke test (`designs/BATCH-X.md`)
- [ ] Undo for every clean opposite; read-only smoke report on test mode. No toolkit compatibility or retirement decision.
