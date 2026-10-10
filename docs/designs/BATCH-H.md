# Design — Batch H: Branding and setup

Status: **APPROVED once IN-00 is answered.** Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch H. Card
H-1 (and `workflow_brand_business` in Batch W). Depends on Batch G (G-5's trial result). Tool list: `docs/TOOL-CATALOG.md`
section Branding and setup.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| H1 | Checkout session create accepts `branding_settings` (logo, icon, background/button color, border style, font family, display name) and payment links accept the same or `custom_text` | `node scripts/openapi-find.mjs "checkout session create"`; read `branding_settings` |
| H2 | Files upload accepts purposes `business_logo` and `business_icon` | `node scripts/openapi-find.mjs "create file"` |
| H3 | G-5's trial recorded whether `settings.branding` can be changed for Chris's own account | G-5 PR description |
| H4 | Invoice rendering templates are listable/archivable | `node scripts/openapi-find.mjs "invoice rendering template"` |

## 1. Decisions

**H1. Two levels, always named.** Account-wide branding (logo, icon, two colors on receipts, invoices, Checkout, portal)
uses the API if H3 says Stripe allows it, otherwise the guided pattern (Batch G, G5) with read-back. Per-page branding
(Checkout and payment links) is always by API.

**H2. A saved brand kit per Stripe account** (`brand_kits`), applied automatically to every Checkout session and payment
link this server creates unless the call overrides it. Projects that create their own Checkout sessions (profiled apps)
are not affected; for them, account-wide branding is what shows — `workflow_app_readiness` says so.

**H3. Logos come from a public URL or a shared Google Drive link** (downloaded server-side, size and square checks), e.g. a
raw GitHub URL for `appliance-desk/docs/brand/01_Logos/...`.

**H4. Statement descriptor:** 5–22 characters, at least one letter, none of `< > \ ' " *`; a short card prefix is offered;
refused in words otherwise.

## 2. Schema

```sql
CREATE TABLE IF NOT EXISTS brand_kits (stripe_account TEXT NOT NULL, mode TEXT NOT NULL, settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (stripe_account, mode));
```

## 4. Work units

### H-1 — Branding and setup tools, brand kits (M, medium effort)
Tools: every `brand_*` and `setup_*` tool in TOOL-CATALOG. Checkout/payment-link tools from Batch D start applying the kit.
Tests: kit applied (request contains `branding_settings`); descriptor rules; non-square icon refused; guided fallback returns
`done: false` with link and never claims success; stripe-mock accepts every request.

## 5. Stop-and-ask points

1. Applying a brand kit would change pages a profiled app creates: it must not; stop and amend if it would.

## 6. Acceptance mapping

| PLAN Batch H line | Evidence |
|---|---|
| Kit applied to every page this server creates | `tests/unit/brand-kit.test.js` |
| Account branding by API or guided with read-back | `tests/unit/brand-account.test.js` |

## Amendments
