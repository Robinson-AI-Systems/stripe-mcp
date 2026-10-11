# START HERE — Robinson Stripe MCP

A hosted MCP server (Node 20, plain ES modules, Vercel serverless + Neon Postgres) that gives Chris's AI agents safe,
almost-complete control of his Stripe accounts. Same family and conventions as `Robinson-AI-Systems/google-workspace-mcp`
(reused code is named in `docs/designs/BATCH-A.md`). General-purpose across Chris's projects; apps that run their own Stripe billing get a project profile (Batch P),
the first being the Appliance Desk rental app (`docs/APP-NEEDS-APPLIANCE-DESK.md`). Chris operates mostly from a phone; everything he reads must be plain language.

## Read only what this work needs

1. Implementing a card: [SESSION-START](SESSION-START.md) (one page). Otherwise AGENTS — workflow and hard limits.
2. [STATUS](STATUS.md) — current head/state/next item.
3. [MASTER-ROADMAP](MASTER-ROADMAP.md) — order of batches and work coverage.
4. Next card, then its named design headings and code. If JIT, write the short card from the design first;
   [drift protocol](implementation-contracts/DRIFT-PROTOCOL.md) applies every time.
5. PLAN's acceptance for the batch and PLAYBOOK's verification commands.
6. Need concrete mappings or fixture patterns? Select one section from
   [implementation guides](implementation-guides/README.md); existing paths and proposed paths are labeled separately.

## Code map (target; confirm the actual path before editing)

`api/` Vercel functions (`mcp.js` connector, `oauth/*` login, `stripe/setup.js` key page, `tools/*` HTTPS API,
`contract.js` RTC manifest) · `src/core/` contract-generic code (no Stripe imports; extracted later into
`robinson-mcp-core`) · `src/stripe/` the only Stripe client, money-operation table, OpenAPI index ·
`src/tools/` one module per area (`customers.js`, `payments.js`, …) plus `write.js` (safety layer), `guards*.js`,
`app-guard.js`, `live-guard.js`, `summaries.js`, `errors.js`, `util.js`, `index.js` (registry layers) ·
`src/db.js` all SQL · `tests/unit|db|mock|doors` · `scripts/` checks ·
`vendor/stripe-openapi/` Stripe's published API description for the pinned version.

## One authority per fact

| Fact | Authority |
|---|---|
| Workflow / hard limits | AGENTS; PLAYBOOK for command recipes |
| Current state / ordered work | STATUS / MASTER-ROADMAP / `pr-cards/work-index.json` |
| Remaining acceptance | PLAN |
| How each batch works | `designs/BATCH-*.md` (targeted headings); the card for exact execution |
| Every tool and its safety marks | TOOL-CATALOG |
| What each profiled app needs | `APP-NEEDS-<APP>.md` (first: APP-NEEDS-APPLIANCE-DESK), `designs/BATCH-P.md` |
| Owner-only inputs / live switches | OWNER-INPUTS / GO-LIVE-CHECKLIST |
| Runtime facts | code and tests; ARCHITECTURE updated as behavior ships |
| Historical evidence | `archive/`, `audits/`, dated DECISIONS; never current instructions |

Preserve stable IDs (cards, `IN-xx`, decisions). Anything that could move money or touch live mode starts off.
Do not turn a plan or a passing test into a claim of live readiness.
