# Decisions (dated)

One entry per design decision, newest last. Reasons live here; current rules live in AGENTS and the designs.

**2026-10-10 — Build a separate, hosted Stripe MCP in the Google Workspace MCP's style.** Chris asked for a robust Stripe
MCP "in the same (or better) form" as his Google Workspace MCP, after a review of the Stripe tools in Robinson's Toolkit
and older repos. The audit (`docs/audits/2026-10-10-existing-stripe-code.md`) found tools broken by Stripe's 2025 API
changes, a parameter encoder that breaks lists of objects, wrong "cancel at period end", miscomputed MRR, and no safety
layer on 35 money/destructive tools. Money needs preview/confirm/read-back/change-log discipline and a hosted server.

**2026-10-10 — Keys never pass through Claude; restricted keys; test mode by default.** Keys added only on a server page,
stored encrypted with no plain copy; live mode needs two steps; webhook secrets and sandbox passes shown once on the setup
page, never in chat.

**2026-10-10 — Cheap on agent context.** Chris: it must not "burn up an AI agent's context or usage tokens". Compact
listing (≈20 tools, <5,000 tokens) reaching everything, summaries by default, result handles, code mode, budgets as tests.

**2026-10-10 — Reach any agent wherever it runs, via a GitHub relay where only GitHub is reachable.** Chris: not
necessarily Vercel Sandbox; "come up with a solution". Most cloud agent workspaces only reach GitHub and package
registries, which is why his GitHub push/pull tool worked there; the `rstripe` CLI tries direct HTTPS and falls back to
an encrypted GitHub-issue relay. Keys stay on the server.

**2026-10-10 — "Almost everything": universal tools.** Chris: "let my AI agent do literally almost everything for me."
Four `api_*` tools reach every Stripe operation, validated against Stripe's published description, with the same guards;
unknown money-like operations are treated as money.

**2026-10-10 — Branding and setup tools.** Chris asked whether it can set up the dashboard and brand payment pages.
Added brand kits (per-page Checkout branding by API) and account-wide branding (API where Stripe allows it for his own
account, otherwise guided with read-back).

**2026-10-10 — General-purpose, with project profiles.** Chris: the server is "not strictly for Appliance Desk … used on
future projects as well." Apps that run their own Stripe billing get a data-only profile (owned records, webhook events,
key permissions, setup checks). Appliance Desk is the first; `workflow_project_setup` starts Stripe for new projects.

**2026-10-10 — Catalog/tax/usage tools come late (Batch E).** Appliance Desk creates its own products, prices and tax
rates in code; the MCP must not duplicate them. Those tools serve future projects; Batch U reaches them meanwhile.

**2026-10-10 — Plan rebuilt in the Appliance Desk planning system** (AGENTS, SESSION-START, PLAYBOOK, drift protocol,
designs, JIT cards, work index, owner inputs) so Sol 5.6 can implement it efficiently. First version archived in
`docs/archive/plan-v1/`.

**2026-10-10 — Plan approved; public repository; no automated review (IN-00, IN-01).** Chris approved the plan, chose to
keep the repository public (free CI, secret scanning on), and declined Codex reviews for this repo. Every PR carries a
written self-review of the full diff against AI-PR-READ-FIRST instead.

**2026-10-10 — One server per service, combined by Robinson's Toolkit (the hub).** Chris: build each toolset as its own
solid server (Workspace, Stripe, and later his own Vercel, Neon and others — official connectors give less functionality
and agents get different permissions with them), then make Robinson's Toolkit the single MCP/CLI/HTTPS front door. This
server therefore follows the Robinson Tool Contract (RTC 1, in the hub repo), keeps passes and HTTPS doors (Batch R), and
leaves the CLI, code SDK, local MCP, GitHub relay and agent recipes to the hub. Contract-generic code lives in
`src/core/` so the hub can extract it into `robinson-mcp-core` (Batch A amendment). First Batch R archived in
`docs/archive/batch-r-v1/`.

**2026-10-10 — Standalone first (Chris).** "I still need to be able to use the individual tool sets before the hub is
built." This server never depends on the hub: conformance joins CI only when available, and agents reach it through its
own connector and HTTPS API, or through `rtool`/the relay talking to it directly.
