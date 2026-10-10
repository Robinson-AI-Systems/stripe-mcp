# Design — Batch P: Project profiles (any app that runs billing on Stripe)

Status: **APPROVED** (Chris, 2026-10-10, IN-00). Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch P.
Cards P-1 … P-4. Depends on Batches B, D, G, H.

The Stripe MCP is general-purpose. Some of Chris's projects run their own Stripe billing in code (Appliance Desk today;
YardSync and Cortiware later). For those, the server must know three things, or it will fight the app: which Stripe
records the app owns, which webhook events it relies on, and how to check that Stripe is set up for it. A **project
profile** holds exactly that. Projects that don't have their own billing code need no profile; they use the server
directly (and `workflow_project_setup`).

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| P1 | `docs/APP-NEEDS-APPLIANCE-DESK.md` still matches the app's code | in `christcr2012/appliance-desk` (read only): `grep -rhoE "stripe\.[a-zA-Z.]+\(" src \| sort -u`; webhook event list in `src/domains/billing/`; metadata keys `grep -rhoE "metadata\??\.[a-zA-Z_]+" src/domains \| sort -u` |
| P2 | The app guard (B-3) reads its key list through one function | `grep -n "APP_METADATA_KEYS\|appMetadataKeys" src/tools/app-guard.js` |

## 1. Decisions

**P1. A profile is data, not code.** One row in `known_apps` per project, plus one human-readable file
`docs/APP-NEEDS-<APP>.md` (the template is the Appliance Desk file). Adding a project = one data row + one doc + one test
fixture; no new tools.

**P2. What a profile holds:** `id`, `name`, `base_url` (for record links), `stripe_accounts` (which accounts it uses),
`metadata_keys` (ownership markers), `webhook_url` and `webhook_events`, `key_permissions` (restricted-key permission list
for the app's own key), `owns_catalog` and `owns_tax_rates` (the app creates its own products/prices/tax rates — never
duplicate them), `portal_rules` (e.g. "no cancel, no plan switch"), `payment_methods` (e.g. card + US bank account in
payment and setup modes), `dashboard_settings` (settings with no API and the recommended value, e.g. "after all retries
fail: leave subscription past due"), `record_links` (URL templates per metadata key).

**P3. Ownership is per profile.** The app guard (B-3) checks every profile on the connection's Stripe account and reports
which app owns a record. No profile on an account → the guard is inactive there.

**P4. `workflow_app_readiness(app, mode)`** checks every row of the profile and returns, per row: done / fixed (with confirm)
/ needs you (link + numbered clicks) / needs a decision (`IN-xx`). It can fix, each previewed and confirmed: missing
webhook events, payment methods off, portal allowing cancel or plan switch, branding (via Batch H). It never creates
products, prices or tax rates for a profile with `owns_catalog`/`owns_tax_rates`.

**P5. `workflow_project_setup(project, mode)`** is for a **new** project: given a short plain description (name, website,
what it sells, monthly or one-time, card/ACH, whether its own code will create the catalog), it previews and then creates
what that project needs in Stripe: webhook endpoint with the events the project will use (secret via one-time page),
portal configuration, payment method settings, brand kit, and — only when the project will not own its catalog —
products and prices by lookup key. It finishes by writing a draft profile row (`status: draft`) and the text for the
project's `APP-NEEDS-<APP>.md`, for Chris or the project's agent to commit in that project's repo.

**P6. App's own restricted key.** Readiness prints the exact permission list (from the profile) to tick when Chris
creates the app's key in Stripe; Stripe has no API to create keys.

## 2. Schema

```sql
CREATE TABLE IF NOT EXISTS known_apps (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  profile JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
```

Seed (P-1): the Appliance Desk profile, generated from `docs/APP-NEEDS-APPLIANCE-DESK.md` (stripe account IDs are added
on the setup page, not committed).

## 4. Work units

### P-1 — `known_apps`, Appliance Desk seed, app guard reads profiles (M, medium effort)
Tests: ownership reported per app; two profiles on one account; inactive guard on an account with none; a test lists every
seeded key and event with the appliance-desk file it came from (the PR body carries that table).
### P-2 — App record links (S)
Results carry the app URL for a record (from `record_links`).
### P-3 — `workflow_app_readiness` (L, medium effort)
Tests with fixtures for the 21 Appliance Desk rows: webhook missing two events → one confirmed fix → read-back; portal
allows cancel → fix; ACH off → fix; owns_catalog → never creates products; guided rows return link + steps.
### P-4 — `workflow_project_setup` (M)
Tests: a monthly-subscription project without its own catalog gets products/prices by lookup key (run twice → nothing
new); a project with its own catalog gets none; the draft profile and doc text are returned, never committed elsewhere.

## 5. Stop-and-ask points

1. P1 shows the app changed its Stripe use: update the profile and the APP-NEEDS file in the same PR; if a new owned
   object type appears, amend B-3's coverage first.

## 6. Acceptance mapping

| PLAN Batch P line | Evidence |
|---|---|
| Appliance Desk profile complete and traceable | P-1 table in PR |
| Readiness covers all 21 rows | `tests/unit/workflow-app-readiness.test.js` |
| New-project setup is idempotent and app-aware | `tests/unit/workflow-project-setup.test.js` |

## Amendments
