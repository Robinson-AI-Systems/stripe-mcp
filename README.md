# Stripe Unleashed by Robinson AI Systems

**Stripe Unleashed by Robinson AI Systems** — standalone remote Stripe MCP
server for authorized account owners and their AI clients. Source
implementation of the 57 original roadmap subsections is merged. The CAP-3
client ID-card (CIMD) component and corrected one-sign-in consent journey
are **VERIFIED LIVE** at deployed release `5b5f701c`; the VER-1 release
identity and fleet health surfaces are **VERIFIED LIVE** at `c95f9cf0`.
Those component proofs do not finish CAP-3 or CAP-5. The reconciled
remainder is in [the completion schedule](docs/COMPLETION.md): CAP-2 and
CAP-3 remain in progress, CAP-4 and CAP-5 remain unfinished units, 29
Stripe-owned protected provider-acceptance rows remain pending, the
branded-domain/identity cutover completed with the 2026-11-08 move to
the Development Rack (see docs/STATUS.md), and the production-readiness
gate has not passed. This repo is **deployed in TEST-oriented
development** but is **not independently accepted for broad public or LIVE
financial use**.

Connect using the authenticated remote MCP URL `/api/mcp` on the verified
service origin. Current legacy setup uses a protected owner page and verified
Stripe keys; this is not yet the new one-screen public self-enrollment flow.
Keep actual LIVE account activation, financial owner approvals, provider grants
and CI/release gates distinct.

- [Start here](docs/START-HERE.md), [current status](docs/STATUS.md), and
  [the reconciled completion schedule](docs/COMPLETION.md) — the single
  current answer to what remains before this is a finished product.
- [Complete source-only CAP-1 evidence inventory](docs/pr-cards/CAP-1-final-inventory.md) — `node scripts/operation-evidence-report.mjs --families` or `--gaps`, linked tests/live evidence remain visibly unverified.
- [CAP-1 reviewed credential/account-context matrix](docs/pr-cards/CAP-1-grant-context.md) now distinguishes exact own-account, installed app, Connect and organization contexts. Metadata classification never authorizes Stripe calls.
- [CAP-1 offline operation/gap inventory](docs/pr-cards/CAP-1.md):
  `npm run check:capabilities`, `node scripts/capability-report.mjs --gaps`
  or `--json`. Output is **source-only candidates**, not actual Stripe access.
- [Approved GitHub-style connection and God Mode contract](docs/designs/STRIPE-CONNECTION-GOD-MODE.md).
- [Inactive CAP-3 tenant and encrypted grant database contract](docs/TENANCY-DATABASE.md) — no public multi-user login, executable credential grant or production migration yet.
- [CAP-2 Full profile and effective-access explanation](docs/pr-cards/CAP-2.md): `stripe_explain_access` (source diagnostic only; no credential or LIVE approval).
- **Brand/canonical origin (live since 2026-11-08):** [Robinson AI Systems Stripe branding and domain](docs/designs/STRIPE-BRAND-DOMAIN.md) — `https://stripe.robinsonaisystems.com/api/mcp` is assigned, released and active: production serves from the Development Rack under this origin and issuer, and the hosted Vercel project and Neon store were retired the same day.
- [Roadmap](docs/MASTER-ROADMAP.md), [owner guide](docs/OWNER-GUIDE.md)
  and [independent acceptance evidence](docs/developer-evidence.json).

Contributors and coding agents: follow [AGENTS.md](AGENTS.md) and
[docs/SESSION-START.md](docs/SESSION-START.md) before implementation.
