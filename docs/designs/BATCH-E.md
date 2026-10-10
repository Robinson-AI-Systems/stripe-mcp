# Design — Batch E: Catalog, Stripe Tax, usage billing, quotes

Status: **APPROVED** (Chris, 2026-10-10, IN-00). Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch E.
Cards E-1 … E-4. Depends on Batches B, C, P. (Test clocks moved to Batch V, developer tools, 2026-10-10.)

Why this comes late: Appliance Desk creates its own products, prices and tax rates in code, so it needs none of these
tools; Batch U already reaches them. They matter for future projects (YardSync, Cortiware) that may keep a catalog in
Stripe. Tool list: TOOL-CATALOG sections Catalog; Stripe Tax; Usage billing; quotes in Invoices.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| E1 | Legacy usage records do not exist at the pinned version; Billing Meters do | `node scripts/openapi-find.mjs "usage record"`; `"billing meter"` |
| E2 | Profiles mark `owns_catalog` / `owns_tax_rates` (Batch P) | `grep -n owns_catalog src/` |

## 1. Decisions

**E1. Catalog tools respect profiles:** creating or changing a product, price or tax rate on an account where a profile
has `owns_catalog`/`owns_tax_rates` is refused for records that profile owns (metadata) and warned for others ("this
account's app creates its own products; this one will not be used by it").

**E2. Lookup keys** for every price this server creates, so running a setup twice changes nothing.

**E3. Prices are immutable in Stripe** except nickname, lookup key, metadata and active; `price_update` says so.

**E4. No legacy usage-record tools** (audit bug 2); meters only.


## 4. Work units

### E-1 — Products and prices (M)
### E-2 — Coupons, promotion codes, features, entitlements, tax rates (M)
### E-3 — Meters, usage, billing alerts, credit grants (M) — grep test: no usage-record endpoint anywhere
### E-4 — Stripe Tax, quotes (M)

## 6. Acceptance mapping

| PLAN Batch E line | Evidence |
|---|---|
| Profile-owned catalog never touched | `tests/unit/catalog-profile.test.js` |
| No legacy usage records | E-3 grep test |

## Amendments
