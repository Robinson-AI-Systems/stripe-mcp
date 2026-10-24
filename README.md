# Robinson Stripe MCP

**Stripe by Robinson AI Systems** — standalone remote Stripe MCP server
for authorized account owners and their AI clients. Source implementation of
the 57 original roadmap subsections is merged; the new CAP-2..CAP-5 authorization and functional
multi-user identity, Stripe App OAuth and optional God Mode expansion remains
unfinished. This repo is **deployed in TEST-oriented development** but is
**not independently accepted for broad public or LIVE financial use**.

Connect using the authenticated remote MCP URL `/api/mcp` on the verified
service origin. Current legacy setup uses a protected owner page and verified
Stripe keys; this is not yet the new one-screen public self-enrollment flow.
Keep actual LIVE account activation, financial owner approvals, provider grants
and CI/release gates distinct.

- [Start here](docs/START-HERE.md) and [current status](docs/STATUS.md).
- [Complete source-only CAP-1 evidence inventory](docs/pr-cards/CAP-1-final-inventory.md) — `node scripts/operation-evidence-report.mjs --families` or `--gaps`, linked tests/live evidence remain visibly unverified.
- [CAP-1 reviewed credential/account-context matrix](docs/pr-cards/CAP-1-grant-context.md) now distinguishes exact own-account, installed app, Connect and organization contexts. Metadata classification never authorizes Stripe calls.
- [CAP-1 offline operation/gap inventory](docs/pr-cards/CAP-1.md):
  `npm run check:capabilities`, `node scripts/capability-report.mjs --gaps`
  or `--json`. Output is **source-only candidates**, not actual Stripe access.
- [Approved GitHub-style connection and God Mode contract](docs/designs/STRIPE-CONNECTION-GOD-MODE.md).
- [Inactive CAP-3 tenant database contract](docs/TENANCY-DATABASE.md) — no public multi-user login or production migration yet.
- [CAP-2 Full profile and effective-access explanation](docs/pr-cards/CAP-2.md): `stripe_explain_access` (source diagnostic only; no credential or LIVE approval).
- **Future brand/canonical origin:** [Robinson AI Systems Stripe branding and domain](docs/designs/STRIPE-BRAND-DOMAIN.md) targeting `https://stripe.robinsonaisystems.com/api/mcp`, not yet assigned, released or active. Existing issuer remains unchanged until DNS, TLS, OAuth/callback and real-client cutover acceptance.
- [Roadmap](docs/MASTER-ROADMAP.md), [owner guide](docs/OWNER-GUIDE.md)
  and [independent acceptance evidence](docs/developer-evidence.json).

Contributors and coding agents: follow [AGENTS.md](AGENTS.md) and
[docs/SESSION-START.md](docs/SESSION-START.md) before implementation.
