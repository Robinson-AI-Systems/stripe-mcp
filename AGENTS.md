# AGENTS.md — the rules. Read this first, every session.

## Independent MCP and optional gateway boundary — owner request 2026-10-12

This server remains independently connectable, authenticated, deployed and testable. Robinson's Toolkit Hub
is optional: one agent connection routes through this server's RTC HTTPS contract, not its internal dispatcher.
Provider credentials, account/project state, canonical tools, permission/write/approval guards and results remain
owned here. Hub credentials must not be accepted as service credentials; separately issued scoped service passes
are required. Shared `robinson-mcp-core` adoption is optional, export-by-export, after immutable publication and
original-service parity; it is not a prerequisite for RTC connectivity or real Hub acceptance.
The owner explicitly requests this focused docs/planning repair; routine no-docs-only implementation cadence
and every CI/review/security/production/deployment/spending gate remain unchanged.

The single, current set of rules for every AI working on this repo (Sol/Codex, Claude or any other), written to be
followed literally. If it is written here, it is current. Reasons and history live in `docs/DECISIONS.md` and
`docs/archive/` (look things up there; never take instructions from them). The repo, not chat history, is the memory.
Modelled on `christcr2012/appliance-desk` `AGENTS.md` (2026-10-09), which is how Chris runs all AI build work.

## Verified hosting and main protections — October 12, 2026

Follow [the verified hosting-cost operating policy](docs/HOSTING-COST-POLICY.md). Saved exact-main protection requires GitHub Actions `ci` **and** `target-main`; preserve existing review/agent merge flow, daily checked `main` → `live`, disabled automatic previews, low compute caps and all owner gates. Do not wait for Vercel preview checks or manually deploy at a batch boundary. Record this infrastructure checkpoint in the next substantive PR's status ledger; no documentation-only PR.

**Efficiency policy:** [development efficiency](docs/DEVELOPMENT-EFFICIENCY.md) is authoritative for cohesive PRs, shared helpers and review/CI cadence. Money, authentication, account isolation and approval gates always prevail.

**Implementing an approved PR card?** Read `docs/SESSION-START.md` (one page) and the card, then work. Open the
sections below when a step names them.
For exact existing helpers, mapping/fixture recipes and JIT execution packets, use
`docs/implementation-guides/README.md` to select one relevant section; these aids do not change approved scope or rules.

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
   complete, checked tree with one push (a turn that must end pushes what it has with an exact resume note; no-shell workspaces push each slice — SESSION-START §6).
9. **External waits are checkpoints, not a loop** (PLAYBOOK Step 10).
10. **Two-lane conveyor:** lane A builds the current card and its immediate successor; lane B handles CI/review/merge of
    the predecessor. At most two unmerged implementation PRs in a chain.
11. **Resume the failing PR first.** At session start or after any interruption, inspect open PRs and exact-head CI
    before new development (`docs/SESSION-START.md` §0). A red check is an engineering task, never a reason to await Chris. Read all failed-job
    logs, fix the distinct causes in one correction batch, and rerun the normal gates; never dismiss a red as a stall.
12. **Catch integration ripple before pushing.** New tools require registry name/count/profile test updates and
    guarded indirect-call tests; new Stripe params require pinned-SDK/stripe-mock validation. Run lint and targeted
    tests after each coherent unit. If the workspace cannot execute tests, use CI as the execution environment and
    clearly label unverified work; do not claim local tests passed.
13. **Checkpoint for interrupted sessions.** Before yielding, write exact branch/head, PR, red/pending gates, the
    first failing command and next corrective action in the card resume note and STATUS. Never end at 'CI pending'
    when eligible local corrections, independent tests or immediate-successor work remain.
14. **Problems are not blockers.** Red CI, lint, failing tests, wrong parameters, conflicts and unclear code are yours to
    fix; stop only for a hard limit or an owner decision the current step needs (SESSION-START §6). Validate in thin
    slices (≤ ~150 production lines between test runs) and end every turn right after a push whose resume note names
    the exact next action.

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
- Any AI-initiated money-out needs a distinct, independently authenticated owner approval for the exact Stripe account, target and amount, even below $500. Spending that exceeds the shared $500/account/Colorado-day budget requires a second separate owner override for that same transaction. An AI `confirm`, context flag, pass or MCP argument is never owner consent. Keep money tools unexposed until B-8's secure approval page is verified.
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

## Automatic session PR alignment and same-conversation intervention (owner 2026-10-13)

At **every** session start, count the highest assigned PR number (including external/concurrent PRs), target the next higher multiple of five, and automatically use the number of substantial eligible implementation PRs needed to reach it (immediately after #200, target #205). Recalculate when concurrent PR assignment moves that target. Never pad with trivial/documentation-only PRs, bypass acceptance, or treat numbering as proof of progress.

If the expected batch cannot be completed, first fix actionable code/CI/review/configuration problems and continue independently eligible roadmap work. If a real owner-only prerequisite or execution limit remains, **pause in the same conversation** with the exact blocker, remedies attempted, secure owner UI/action or approval, remaining work and the immediate resumption step. Do not expose secrets or ask for them in chat. Do **not** produce a next-chat continuation prompt for an incomplete batch; resume here after the owner responds. Only after a genuinely completed aligned batch and final-main verification post the permanent PR handoff and a compact next-session prompt retaining both rules.

## Permanent outcome-driven development and handoff (owner instruction, 2026-10-12)

This is the standard for this and **every future session**, alongside all hard safety and release gates.

1. **Choose an outcome, not a PR count.** First reconcile current main, active work (including other agents), reviews, CI, live deployment, owner decisions and the accepted work index. Pick the highest-priority eligible milestone and enumerate its finite, remaining acceptance criteria. Group coherent implementation PRs to complete or materially advance that user/developer capability; fix demonstrated security/correctness/CI/review defects first. When eligible substantive work exists, aim for the repository PR-number checkpoint to end on a **multiple of five** (e.g. #190, #195), including work already completed in the session. PR numbers are an organizational target, never permission to manufacture filler or bypass reviews/CI/approval. Five qualifying substantial PRs is a normal session boundary **only**. Never pad, fabricate hardening, weaken checks or skip a needed acceptance to hit five.
2. **Make blockers executable.** In STATUS and the authoritative acceptance ledger, each pending external/owner/dependency gate must name its exact blocker, required evidence or owner decision, prerequisite, condition that makes work eligible and the next concrete action. Recheck on relevant merges, credential grants, owner authorizations and scheduled promotions. Reconcile authorizations already supplied; never ask again for an already approved exact action. If a step becomes eligible, resume it without waiting for another planning request.

   **Isolate a blocker to the specific operation, never the whole project by default.** Before calling any item BLOCKED: trace its root cause; check code defects, configuration, dependencies, stale instructions, and previously approved owner decisions; try the authorized remedy; finish every runnable part and its meaningful tests. Record the precise unavailable external credential, permission, decision, or evidence source only after exhausting repairs. Then inspect the remaining approved roadmap/dependency queue and implement its highest-priority independent eligible item. Automatically restore deferred items on their explicit re-entry condition; do not stop or substitute a continuation prompt merely because the preferred milestone is blocked. An early stop requires evidence that **no** further safe substantive work is eligible or a concrete execution limitation, the remedies attempted, and the smallest genuinely required external action. Never bypass safeguards or invent acceptance results.
3. **Separate four proof layers.** Implementation/source exists; meaningful automated verification; actual deployed HTTPS revision/behavior; genuine third-party connected integration/owner acceptance. Each has its own status and evidence. Fake providers, local PostgreSQL/HTTP, upstream reference conformance, GitHub green CI, configuration readback, protected SSO or Vercel READY for an older commit never prove adjacent layers. Use PASSED/FAILED/BLOCKED/UNVERIFIED and do not claim certification without actual-service conformance for the supported subset.
4. **Protect financial and security invariants.** No placeholders, unauthorized money-out or LIVE, weakened ownership/profile isolation, missing idempotency/audit/recovery, secret disclosure, skipped reviews or forced deployment. Preserve scheduled checked live promotion, protected main, hosting cost caps and production/owner gates. A blocked external step does not block independent eligible approved roadmap work.
5. **Persist a precise continuation.** Update existing STATUS, work index where applicable, owner-input/blocker record and existing finite acceptance ledger inside the next substantive implementation PR; no duplicate instruction files or docs-only PRs. The final PR's permanent handoff names the milestone, exact main/head/check/deployed revisions, what code/automated/hosted/external evidence passed, all actionable blockers, dependencies, newly eligible work and the next action. Every session ends with a **compact copy-paste continuation prompt** pointing to these authoritative files, a verified checkpoint and the same outcome-first/five-PR-boundary discipline. Do not repeat long history/rules in the prompt.

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
- **The protected-main GitHub Actions `ci` and `target-main` checks are both required**, green at the exact head, alongside the five other existing exact-head jobs and review-thread gate. Do not rely on disabled Vercel preview checks.
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

## Release branch rule (owner approved October 12, 2026)

Development PRs target `main` and keep all existing exact-head CI and review
gates. Vercel Production must track **`live`**, not `main`. The
`.github/workflows/promote-live.yml` job alone automatically fast-forwards
`live` at most once per America/Denver calendar day after all six main checks
pass, with an atomic daily marker. Do not merge development PRs into `live`,
force-update `live`, remove promotion tags, manually trigger deployments, or
weaken Vercel deployment protection as part of routine development. A
Production READY state on `main` is not proof `live` branch tracking works.
Refer to [daily release guide](docs/DAILY-PRODUCTION-PROMOTION.md) and record
live commit, scheduled promotion job, and actual Vercel deployment separately
during handoff. Owner permission is still required for Stripe LIVE mode.

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
