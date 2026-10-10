# AGENTS.md — the rules. Read this first, every session.

The single, current set of rules for every AI working on this repo (Sol/Codex, Claude or any other), written to be
followed literally. If it is written here, it is current. Reasons and history live in `docs/DECISIONS.md` and
`docs/archive/` (look things up there; never take instructions from them). The repo, not chat history, is the memory.
Modelled on `christcr2012/appliance-desk` `AGENTS.md` (2026-10-09), which is how Chris runs all AI build work.

**Implementing an approved PR card?** Read `docs/SESSION-START.md` (one page) and the card, then work. Open the
sections below when a step names them.

**Other sessions** (design, planning, review): this file → `docs/START-HERE.md` → `docs/STATUS.md` →
`docs/MASTER-ROADMAP.md` → the relevant `docs/PLAN.md` section and design headings.

## Working without stalling (mandatory; written with Sol 5.6 at medium effort in mind)

1. **Read by section.** Files over ~300 lines (`docs/TOOL-CATALOG.md`, `docs/designs/BATCH-*.md`, Stripe's OpenAPI
   file): find the heading or name with `grep -n`, then read ≤150 lines with `sed -n 'A,Bp'`.
2. **Search narrowly:** always a path and a cap (`grep -rn "defineWrite" src/tools | head -50`). Never the repo root,
   `node_modules`, `coverage`, `vendor/`; no `ls -R`, no `find .` without `-maxdepth 3`.
3. **Only commands that finish by themselves.** Never `vercel dev`, watch modes, bare `vitest`, `tail -f`, or sleep/poll
   loops. Use `npx vitest run <file>`; wrap slow commands in `timeout 600`. Exception: the bounded CI wait in PLAYBOOK
   Step 10.
4. **Nothing interactive:** `GIT_PAGER=cat PAGER=cat GH_PAGER=cat CI=1`; `npx --yes`.
5. **Cap output** with `| tail -80` and `set -o pipefail`.
6. **Two strikes:** the same command fails or hangs twice → change approach or record the blocker; never a third try.
7. **Explore budget:** after about 10 focused reads/searches without an edit, write down what you know and make the
   smallest justified edit with its test — or report a true blocker. Never guess unsafely to save a read.
8. **Checkpoints:** one coherent work unit with its tests → local commit → update the card's resume note. Publish the
   complete, checked tree with one push.
9. **External waits are checkpoints, not a loop** (PLAYBOOK Step 10).
10. **Two-lane conveyor:** lane A builds the current card and its immediate successor; lane B handles CI/review/merge of
    the predecessor. At most two unmerged implementation PRs in a chain.

## What this is

**Robinson Stripe MCP** is a hosted MCP server (Vercel + Neon) that lets Chris's AI agents operate his Stripe accounts
safely: customers, payments, refunds, subscriptions, invoices, branding, payouts, disputes, webhooks, account settings,
and — through universal tools — every other Stripe API operation. It is a **general, powerful tool for developers and
account owners alike**: any agent should be able to use it freely on whatever Chris is working on — building for a
client, building for himself, or setting up and running his own Stripe account. It covers **building with Stripe**
(test data, cleanup, test events, event forwarding, time travel — Batch V), **owning and administering the account**
(admin overview, verification, team, security, fees, every dashboard setting through real tools or guided settings —
G-6, H) and **day-to-day operation** (everything else). An app that
runs its own Stripe billing can optionally get a **project profile** (Batch P) so the server never fights it. Real
projects such as Appliance Desk are used only as **completeness checks** ("can it do everything this needed?"), never
to narrow the design. It is reached
through a Claude connector and a plain HTTPS API, and it follows the **Robinson Tool Contract** (RTC 1) so that
**Robinson's Toolkit** (`Robinson-AI-Systems/robinsons-toolkit-hub`, the hub) can combine it with Chris's other servers into
one MCP, CLI and HTTPS API for any agent. **Chris is not a developer:** every
update, question or PR summary for him is plain English — what changed, how it was verified, what he must decide,
what is next.

## Priorities (higher wins)

1. Money safety and security. 2. Correctness. 3. Low cost for the agents that use it (context and tokens).
4. Simplicity. 5. Features.

## Definition of Done (non-negotiable)

1. No placeholders, stubs, TODO-as-implementation, or mock data presented as real. A tool either calls the real Stripe
   method it claims to, or it does not exist.
2. Tests exercise real behavior: every write tool passes the seven write-contract checks (`docs/designs/BATCH-B.md` §3);
   every request shape passes against `stripe-mock`; database code passes against throwaway Postgres.
3. CI green: secret scan, docs check, lint, unit, database, stripe-mock, token budgets.
4. The card's acceptance (from `docs/PLAN.md`) checked item by item with evidence (test names, CI run).
5. `docs/STATUS.md` updated.

If something isn't finished, say so and record it in STATUS. Never present partial work as done — Chris has been
burned by overclaiming. A passing typecheck, a screenshot or a plan is not evidence a feature works.

## Hard limits — stop and ask Chris first

- Using a **live** Stripe key, enabling live mode, or any write in live mode — including from tests or scripts.
- Moving real money in any mode outside a test: refunds, payouts, transfers, charges.
- Buying anything (Stripe add-ons, domains, Vercel/Neon plans).
- Putting any secret (Stripe key, webhook secret, passphrase, encryption key, pass, GitHub token) in code, docs,
  tests, logs, PR text or a tool result. Fake keys only: `sk_test_FAKE…`, `rk_test_FAKE…`.
- Changing anything outside this project: the Appliance Desk repo or its Vercel/Neon projects, the Google Workspace MCP,
  Robinson's Toolkit, other Vercel/Neon projects. Reading them for reference is fine.
- Changing Stripe records a profiled app owns (Appliance Desk today), outside a test fixture.
- Widening what a restricted key or a pass may do by default.
- Making this server depend on Robinson's Toolkit (the hub). It must stay **fully usable on its own** — connector,
  HTTPS API and passes — whether or not the hub ever exists (Chris, 2026-10-10).
- Committing directly to `main`.

## Scope and owner decisions

Build what the current card asks, completely. Other ideas go in `docs/ROADMAP.md` and your report — don't build them
unasked. Owner decisions live in `docs/OWNER-INPUTS.md` with stable IDs (`IN-xx`); check there first and ask only for
what the current card needs. Build what doesn't depend on a missing answer; keep the dependent behavior off.

**Configurable by default.** Limits, thresholds and defaults (daily money limit, pass lifetime, result size cap, profile
contents) are stored settings with a sensible starting value, explained in plain words in the tool description or setup
page. Money is shown in dollars and cents; stored in integer cents.

## How work is organized

- **Approved designs, just-in-time cards.** Implement only approved scope (`docs/designs/BATCH-*.md`, `docs/PLAN.md`).
  The implementing model writes the card for the current unit (and its immediate successor when useful) from the
  approved design and actual code (`docs/pr-cards/README.md`). A missing card means write it, not stop. Money, secrets,
  guards and provider replay follow the design's contract; if it can't work, propose a dated amendment and get it
  reviewed.
- **Drift and reconciliation** (`docs/implementation-contracts/DRIFT-PROTOCOL.md`): checklist A before each PR, B inside
  each PR written as if it had already merged, C when a batch finishes.
- **PR size:** about 500 production lines and 15 files, hard stop ~800 lines, at most one migration, one risk area
  (PLAYBOOK Step 3a).
- **Model:** whichever model Chris selected does the work. Sol 5.6 is the routine implementer: light effort for an
  already-tested pattern (a new read tool), medium for the safety layer, guards, money, keys, passes, or anything
  unfamiliar. A missing decision is never solved by guessing.
- **Branches:** `ai/<tool>/<topic>` from current `main`, or from the unmerged predecessor's branch when stacking.
- **Use the web** for current Stripe API facts (reference, changelog for the pinned version) and MCP spec details;
  cite them in the PR.

## Verify, push, review, merge (details: PLAYBOOK Steps 4–9)

- **Before pushing:** `npm run check` (secret scan, docs check, index validation, lint, write-safety check, token
  budgets) and the card's targeted tests. Never `--no-verify`.
- **One push per CI cycle.** After a red run, read all failures, reproduce locally, fix them all, push once. "Flake" is
  not a cause; never skip, weaken or quarantine a test.
- **The `ci` check is the single merge gate**, green at the exact head.
- **Review:** read `docs/AI-PR-READ-FIRST.md` for anything touching money, keys, guards, auth or passes, and
  record how each applicable constraint is honored. **This repo has no automated review** (Chris, 2026-10-10, IN-01):
  never wait for or request one. If one posts anyway (an organization-wide reviewer), handle its findings like your
  own: fix or answer each thread, then resolve it. Before merging, inspect the whole diff yourself against AI-PR-READ-FIRST and write
  "Self-review: <findings and dispositions>" in the PR; fix blocking findings (security, money, data integrity,
  contract, acceptance) in one patch. Never claim a review that didn't run. Phase-gate reviews (end of a batch,
  DRIFT-PROTOCOL C) may use a second model on request.
- **Merging (authorized by Chris):** `ci` green at the exact head, acceptance met with evidence, reviews handled → merge
  with the expected-head SHA. Stacks merge bottom-up, retargeting each PR to `main` first. Merging never covers a hard
  limit.
- **Security or money hole already on `main`:** fix it immediately in its own PR.

## Where the rules live (one source of truth each)

| Topic | File |
|---|---|
| Starting a card session; resume note | `docs/SESSION-START.md` |
| Step-by-step procedure and testing | `docs/PLAYBOOK.md` |
| Every tool: name, purpose, safety, profile | `docs/TOOL-CATALOG.md` |
| Project profiles (what each app needs from Stripe) | `docs/APP-NEEDS-APPLIANCE-DESK.md` (first profile), `docs/designs/BATCH-P.md` |
| Runtime facts (env vars, tables, infra) as built | `docs/ARCHITECTURE.md` |
| Remaining acceptance | `docs/PLAN.md` |
| Approved designs (how) | `docs/designs/BATCH-*.md` |
| Exactly what one PR builds | `docs/pr-cards/<ID>.md` (wins over the design where they differ) |
| Current state and next item | `docs/STATUS.md`, `docs/MASTER-ROADMAP.md`, `docs/pr-cards/work-index.json` |
| Owner decisions | `docs/OWNER-INPUTS.md` |
| Dated decisions and reasons | `docs/DECISIONS.md` |
| Ideas not being built | `docs/ROADMAP.md` |
| Go-live switches | `docs/GO-LIVE-CHECKLIST.md` |
| What Chris can ask for | `docs/OWNER-GUIDE.md` |
| Money/secret constraints for PRs | `docs/AI-PR-READ-FIRST.md` |
| The contract every Robinson server follows | `Robinson-AI-Systems/robinsons-toolkit-hub` `docs/CONTRACT.md` (RTC 1) |
| Audit of the older Stripe code | `docs/audits/2026-10-10-existing-stripe-code.md` |
| Retired documents (reference only) | `docs/archive/` |

## Engineering rules for every change

- **Code and tests change together.** Every write tool is built with `defineWrite` and passes the write-contract helper
  through every door this server has (MCP, `stripe_call`, HTTPS API). Contract-generic code lives in `src/core/` and
  imports nothing Stripe-specific (Batch A amendment), so the hub can extract it into `robinson-mcp-core`.
- **Stripe only through `src/stripe/client.js`** (official `stripe` library, pinned `STRIPE_API_VERSION`, idempotency key
  on every write). Never hand-build request bodies; never change the API version outside its own card.
- **Money is integer cents**; shown with `_display` dollars. **Times stored UTC, shown America/Denver.**
- **No secret ever returned:** `client_secret`, webhook signing secrets, keys, passes. Card and bank details are only ever
  typed on Stripe's hosted pages.
- **Small results:** every read tool takes `fields` and `detail`; nothing over 8 KB returned without a handle; listing
  descriptions ≤160 characters (`docs/designs/BATCH-C.md`).
- **Database changes are additive** (`IF NOT EXISTS`); previews share the production database.

## CI

The repository may be public: anything committed is public forever. CI runs on every PR: secret scan, docs check,
index validation, lint, unit tests, database tests on throwaway Postgres, stripe-mock tests, token budgets.
`.github/workflows/ci.yml` keeps `permissions: contents: read`, uses no repository secrets, never
`pull_request_target`, never echoes environment values. Never commit Stripe account IDs, Vercel/Neon IDs or URLs with
credentials.

## How to run things

```bash
npm ci
npm run check                                   # quick gate: secrets, docs, index, lint, write-safety, token budgets
npx vitest run tests/unit/<file>.test.js        # one unit file
npm run test:db -- tests/db/<file>.test.js      # throwaway Postgres (scripts/local-postgres-test.sh)
npm run test:mock -- tests/mock/<file>.test.js  # against stripe-mock (scripts/stripe-mock.sh starts it)
python3 docs/pr-cards/validate-index.py
```

## Ending a session

1. `docs/STATUS.md`: merged, in progress (branch, PR, head SHA, CI run), blocked and why, next.
2. `docs/DECISIONS.md` entry for any design decision; `docs/ROADMAP.md` for out-of-scope finds;
   `docs/GO-LIVE-CHECKLIST.md` for any new switch, key or owner step.
3. Report to Chris in plain English: what changed, how it was verified, what he needs to decide (`IN-xx`), what is next.
