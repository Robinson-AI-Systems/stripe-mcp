# AGENTS.md — the rules. Read this first, every session.

## Original Toolkit is reference-only — owner clarification 2026-10-14

`Robinson-AI-Systems/robinsons-toolkit-mcp` is the historical capability reference,
not an active implementation/deployment target. The standalone custom MCP servers
and optional `robinsons-toolkit-hub` replace it. Do not maintain/rebuild the original,
resume its recovery PRs, synchronize implementations back to it, or require a bridge.
Preserve its code/history for coverage and behavioral research. When the owner chooses a new provider MCP, its implementing agent inventories the
relevant legacy tool names, families, workflows and intended behavior, reconciles them
with current provider contracts, and tracks coverage in THAT project's cards/index.
The Hub stays provider-agnostic: discover/connect/authorize/route/read results for
new contract-compatible MCP servers without provider-specific handlers or a fixed
family list. Future services and legacy catalog parity are not Hub completion gates.
Do not copy provider capabilities into the Hub or start speculative server projects.
Mapped/planned is not implemented or accepted. Service autonomy and all existing
provider/security/owner gates remain binding.


## Efficient release-aware execution — owner instruction 2026-10-14

[SESSION-START](docs/SESSION-START.md) is the consolidated session procedure;
`npm run session:status` prints the read-only release acceptance queue and remaining-roadmap summary.
Its workflow/cadence/merge-versus-live-proof rules supersede older conflicting procedural
wording below, but never override explicit safety or pre-merge owner/card gates.
Use substantial cohesive outcomes; numeric production-line targets are advisory rather
than artificial hard caps. Full mandatory checks run before publication, with focused
checks during development. Product acceptance stays open until real evidence passes.
The owner explicitly authorized this cross-repository guidance/tooling optimization;
routine implementation sessions still prohibit filler/documentation-only PRs.

## Roadmap-throughput and context-safe execution — owner correction 2026-10-14

**Completion outranks PR count.** The goal is completed, usable, safely proven product
functionality, not GitHub activity. Each PR must integrate at least one whole eligible
roadmap slice; package multiple adjacent small slices from the same approved parent
outcome when their contract, risk, callers, integration and tests belong together.
Target **400–800 changed production-code lines per substantive PR on average**
and **2–5 fully completed roadmap slices per substantive PR on average**,
measured over the latest five merged implementation PRs when available.
These are planning averages, not hard bounds or a reason to pad code, split
coherent outcomes or bundle unrelated risks. Count production source changes
only, excluding tests, documentation, generated files, fixtures and formatting.
Record actual source additions/deletions and completed slice IDs with their
acceptance evidence in each PR/handoff. Missing historical measurements stay
unknown. A helper is not a completed slice; eligible engineering and pre-merge
checks must be finished. Deployed/provider acceptance remains separately open.
Explain legitimate smaller safety fixes and larger inseparable outcomes.

**No fixed PR count or multiple-of-five boundary.** Older directions elsewhere
requiring five or ten PRs or PR-number alignment are superseded. Do not invent
small PRs or pad changes to satisfy a number. Spend the chat's usable context
on complete outcomes; after each merged PR, preserve an exact recoverable
checkpoint (branch/head, card/slice coverage, focused and CI proof, open review,
deployed/live versus source, pending acceptance and next action). Before starting
another work unit, assess whether the remaining chat context can support its
implementation, corrections, tests, merge and handoff. If not, finish a clean
checkpoint instead of beginning work likely to be abandoned. Never use a
continuation prompt instead of completing currently feasible work.

**Remaining-work visibility.** Run `npm run session:status` for current
roadmap counts and unfinished IDs in approved order alongside the separate
release acceptance queue. Counts describe the existing index/ledger's coarse
units (including separately listed planned/blocked/optional work), not fine-grained PR slices, time estimates or live acceptance.
Record actual completed slices and remaining engineering in existing cards
and handoffs; never promote an incomplete card to improve the numbers.
Follow the designated roadmap order rather than the milestone in an old handoff.

**Adaptive CI budget and measurement.** Validate focused behavior at meaningful
code seams, run required complete gates on the final coherent tree and fix all
reported failures in one root-cause-informed correction cycle where possible.
If repeated CI fixes occur, investigate contract/test drift and reduce the
*next* PR's risk surface; do not silently split the current work to manufacture
success. Track complete slices/outcomes, real acceptance closed, remaining
work, first-pass CI failures, correction pushes and actual review overhead.
Lines of code and merged PRs are diagnostic statistics, not progress scores.
Every safety, money-out, service autonomy, release and approval gate remains.

## Mobile and tool-unavailable connection recovery

Before treating absent private-plugin tools as an acceptance blocker, follow
`docs/pr-cards/DEVELOPER-CONNECTION.md` → **Agent connection recovery when private plugin tools are absent**.
Use this repository's own saved native OAuth connection through an authorized HTTPS-capable
runner; identify its exact origin and service identity, then run purpose-specific acceptance.
The owner's phone is not the execution runner. Missing tools in one chat do not establish
expired provider authorization. Keep the protected checkpoint single-runner and preserve
all operation, provider, production, spending and isolation gates.


## Product, builder and acceptance boundaries — owner correction 2026-10-13

This repository builds a full independently usable custom MCP integration. Do not narrow
its production tool catalog, implemented operations or runtime profiles to match a temporary
coding-agent test grant. The implementing agent is a separate principal: renewable developer
OAuth may use full permissions for approved test fixtures while existing operation-specific
money-out, spending, live activation, destructive data and resource-isolation gates still apply.
Use `docs/pr-cards/DEVELOPER-CONNECTION.md` for the current mobile connection workflow.

Standard ChatGPT/provider connectors may help inspect infrastructure or author/review code;
those calls do NOT test this custom MCP. To claim custom acceptance, call this repository's
actual deployed `/api/mcp` or its own RTC doors with its service-issued authorization, identify
the exact deployed commit/origin, and record the actual read/write/denial/readback observations.
A public contract, green CI, configured credentials, standard-connector success or a reference
server cannot close custom transport, provider, Hub, revocation or cleanup acceptance.
Keep those layers separate in `docs/developer-evidence.json`; `check:developer-evidence`
rejects inadmissible provenance. Schema validation itself is not independent acceptance proof.
Never ask the owner to copy IDs/passes for routine retests when a saved developer connection
can perform the authorized operation. Reuse/refresh it; request new consent only for a revoked,
expired underlying grant, a new provider credential or a genuinely additional permission.


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
- **PR size:** about 500 production lines and 15 files, advisory size estimate, at most one migration, one risk area
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
