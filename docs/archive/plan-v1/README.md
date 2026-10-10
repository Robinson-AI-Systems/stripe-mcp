> **RETIRED DOCUMENT — reference only.** First version of this plan (2026-10-10), written in the Google Workspace MCP plan style before it was rebuilt in the Appliance Desk system. Nothing here is a current instruction. Use `AGENTS.md`, `docs/START-HERE.md`, `docs/designs/` and `docs/TOOL-CATALOG.md` instead.

# Robinson Stripe MCP: implementation plan

**Start here.** Written 2026-10-10 by Claude (Opus 5.5) for Chris Robinson, to be
executed by a less expensive model. This folder is the whole brief: what the
server is, why it is built this way, the exact order of work, how each piece is
proven done, and the prompt to paste into the implementing model.

It is deliberately built the same way as the Robinson Google Workspace MCP
(`Robinson-AI-Systems/google-workspace-mcp`), and reuses that server's proven
parts wherever they apply. Where this plan does something *better* than the
Workspace server, it says so, and says why.

Owner: Chris Robinson. He is not a developer. Every status update and every
question to him is written in plain English, with no jargon unexplained.

## What this server is, in one paragraph

A Claude connector that gives Claude real, safe control of Chris's Stripe
accounts: customers, payments, refunds, subscriptions, invoices, the product
catalog, tax, payouts, disputes, webhooks and the account itself, plus a set of
"workflow" tools that do Chris's real money jobs in one sentence ("who didn't
pay this week and why?", "refund the Hendersons' deposit", "is the rental app's
webhook set up right?", "are we ready to go live?"). It runs hosted on Vercel
with its state in Neon, so it works from claude.ai on his phone. Every tool that
moves money or changes anything previews first, asks before anything that
cannot be undone, reads back what Stripe actually holds afterwards, and writes
a line to a change log.

## Why a separate server (and what happens to the toolkit's Stripe tools)

Robinson's Toolkit MCP already has a `stripe` namespace (202 tools in
`handlers/stripe.js`). It is a good map of *what* to cover, and this plan uses
it as the starting list. But it runs on one computer, has no safety layer (none
of its 35 refund/cancel/delete/payout tools asks before acting), sends no
duplicate-protection key with any payment, and several of its tools no longer
work against current Stripe (see `FINDINGS.md`). Money needs the Workspace
server's discipline, not the toolkit's breadth-first style.

The toolkit's Stripe namespace stays as it is until this server is live (card
P9-2 then decides whether to retire it or point it here). Nothing in this plan
edits the toolkit.

## What this plan delivers

1. **Safe to leave running.** Stripe keys stored encrypted (required, not
   optional as it was for Google tokens), restricted keys preferred, the same
   lockout-protected login page, tests on every change.
2. **Test mode by default, live mode on purpose.** Each Claude connection is
   bound to one Stripe account *in one mode*. A live connection is chosen
   deliberately at login and shows "LIVE" on everything it returns. The
   Appliance Desk app's own rule, "Stripe in test mode only until Chris
   explicitly authorizes going live", is enforced here too.
3. **Refuse to do dumb things with money.** Preview on every change, an exact
   dollar preview before any charge, refund, payout or plan change, confirmation
   before anything that cannot be undone, a per-connection daily money limit,
   and a duplicate-protection key on every Stripe write so a retried call never
   charges twice.
4. **Never fight the rental app.** Stripe records the Appliance Desk app created
   (it tags them with `agreementId`, `estimateId`, `depositId` and so on) are
   protected: Claude can read them freely, but changing them is refused with a
   plain explanation unless the call says it really means to. This is the
   Stripe version of the Workspace server's "stay inside your own business"
   rule.
5. **Speak plainly.** Stripe's errors (declines, missing permissions on a
   restricted key, test/live mix-ups) translated into what happened and what to
   do; amounts shown as dollars as well as cents; dates shown in Colorado time.
6. **Do Chris's real tasks in one sentence.** Money snapshot, failed payments,
   refund a customer, change a plan with the exact price difference first,
   dispute evidence kit, webhook health check, go-live checklist, month-end
   close, and brand a business's payment pages, receipts and invoices.
7. **Things the Workspace server planned but never built, built in from day
   one:** read-only connections, smaller tool menus ("profiles"), and undo
   built on the change log.
8. **Cheap on an agent's context and usage.** About 4,000 tokens to load in
   "compact" mode for all 282 tools; small summaries by default; big results
   kept on the server behind a handle; a code mode where an agent processes
   hundreds of records and gets one line back. Budgets are checked by tests.
8b. **Lets an agent do almost anything in Stripe.** 282 hand-built tools for
   the common jobs, plus four universal tools that reach every operation in
   Stripe's API (checked against Stripe's own published description, with the
   same confirm, money-limit and guard rules). Settings Stripe has no API for
   come back as exact click-by-click steps an agent with a browser can follow
   while Chris watches.
9. **Usable by agents that cannot add a connector, wherever they run.** A
   plain HTTPS API, and `rstripe`, a small command-line tool any agent can
   install from GitHub (laptop, cloud agent workspace, CI, Vercel Sandbox).
   It calls the server directly when it can and, in locked-down workspaces
   that only allow GitHub, passes encrypted requests through a private GitHub
   "relay" instead, the same reason Chris's GitHub tool worked there. Access is
   a short-lived pass Chris creates; the Stripe key never leaves the server.
   See `CONTEXT-AND-ACCESS.md`.

## Which model to use

| Role | Model | Why |
| --- | --- | --- |
| Implementing every task card | **Claude Sonnet 5.5**, medium effort | Strong at code, follows a written plan closely, a fraction of the cost. |
| Pure mechanical cards (marked `[H]` in TASKS.md) | Claude Haiku 4.5 | Cheapest; fine when the card leaves nothing to decide. |
| Phase-gate review (end of each phase, read-only) | Claude Opus 5.5 or Fable 5.1 | Catches money and security mistakes Sonnet may not. One review per phase. |

Never use Haiku for anything touching keys, money movement, the safety layer,
the live-mode guard or the app-owned guard.

## How to run the plan

1. Create an empty GitHub repository `Robinson-AI-Systems/stripe-mcp` and copy
   this `docs/plan/` folder into it (Claude can do this for you once the empty
   repository exists).
2. Open `IMPLEMENTER.md`, paste its prompt into a new session with the
   implementing model, and name the card (for example `P0-1`).
3. One card per pull request, in the order in TASKS.md, unless a card says it
   may be grouped.
4. Chris merges. Vercel deploys `main`. Preview deployments share the
   production database, so every database change must be additive.
5. At the end of each phase, run the phase-gate review prompt from
   `IMPLEMENTER.md`. Fix what it finds before the next phase.

## Order of work

| Phase | Theme | Cards | Rough size |
| --- | --- | --- | --- |
| P0 | Foundation: repo, tests, login, encrypted Stripe key store, Stripe client | P0-1 … P0-6 | 1 week |
| P1 | Trust layer: preview/confirm/read-back, money rules, live guard, app guard, plain errors, change log, profiles, small results, compact listing | P1-1 … P1-10 | 2 weeks |
| P2 | Everyday money: customers, payments, refunds, checkout, portal, subscriptions, invoices | P2-1 … P2-6 | 1.5 weeks |
| P3 | Catalog, tax, usage billing, quotes, credit notes, test clocks | P3-1 … P3-5 | 1 week |
| P4 | Money out and risk, account settings, branding and setup, universal access to the rest of Stripe | P4-1 … P4-8 | 2 weeks |
| P5 | Workflows in Chris's language | P5-1 … P5-10 | 1.5 weeks |
| P6 | Reach any agent: HTTPS API, `rstripe` CLI, code SDK, GitHub relay, setup recipes | P6-1 … P6-5 | 2 weeks |
| P7 | Appliance Desk support | P7-1 … P7-3 | 3–4 days |
| P8 | Undo and read-only smoke test | P8-1 … P8-2 | 3–4 days |
| P9 | Optional: Connect (for YardSync/Cortiware), toolkit retirement | P9-1 … P9-2 | when needed |

## Rules that never bend

- **A Stripe secret key never passes through Claude.** Keys are added on the
  server's own setup page, never by a tool argument, never in a tool result,
  never in a log, test or change-log row. Tests use obviously fake keys.
- **Live mode is opt-in per connection** and every live write needs
  `confirm: true`, even ones that would not need it in test mode.
- **Every Stripe write carries an idempotency key** (Stripe's duplicate
  protection) derived from the call, so a retry returns the original result
  instead of charging, refunding or paying out twice.
- **Every write tool reads back** what Stripe now holds and returns that, not
  the request we sent.
- **Anything that moves money or cannot be undone requires `confirm: true`**
  and supports `dryRun: true`. The list is in TASKS.md P1-1.
- **Records the Appliance Desk app owns are not changed** without
  `outsideApp: true` in the call (and Chris saying so).
- **The Stripe API version is pinned in code.** Moving to a newer version is
  its own card, never a side effect.
- **Additive database changes only.**
- **Plain English to Chris.** If a card needs his decision, the PR body asks
  the question in one sentence a non-developer can answer.
- **Nothing is done until its acceptance checks pass.** "Compiles" is not done.
  No placeholder code. A tool either calls the real Stripe method it claims to,
  or it does not exist.

## Files in this folder

| File | What it is |
| --- | --- |
| `README.md` | This page |
| `FINDINGS.md` | What was found in the existing Stripe code across Chris's repos, including what is broken today |
| `ARCHITECTURE.md` | How the server works, every moving part, and the conventions to keep |
| `TOOL-CATALOG.md` | Every tool, by area, marked carried over / fixed / new |
| `CONTEXT-AND-ACCESS.md` | How the server stays cheap on agent context, and how agents without a connector use it from anywhere (HTTPS API, CLI, code mode, GitHub relay) |
| `TASKS.md` | The ordered task cards with acceptance checks, plus the status ledger |
| `TESTING.md` | The test strategy |
| `IMPLEMENTER.md` | Paste-ready prompts (implement, review), PR template, checklists |
