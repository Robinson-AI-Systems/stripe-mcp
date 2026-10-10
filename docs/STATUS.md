# STATUS — current work, blockers and next action

Updated 2026-10-10. Repository created by Chris; plan written by Claude (Opus 5.5) in the Appliance Desk planning system.
**Batch A implemented (#9–#17):** tested foundation, durable OAuth, pinned Stripe API reference, encrypted keys, secure setup code and owner's deployment guide. No Stripe account has been connected; none of this is deployed or live.

## Next

- **B-8b2b3 in review:** private owner-only account daily money-limit changes,
  PR #33, branch `ai/gpt6/b-8b2b3-owner-money-limit`. The standard remains
  $500 USD/account/Colorado day. Protected two-stage owner confirmation,
  exact USD cents, existing/current spending preview, expected-old-cap check,
  account-row locking and one-use atomic audit. Fake and isolated PostgreSQL
  tests must pass before merge.
- **Last merged:** B-8b2b2 default-account selection #32 (`713836f`).
  #31 emergency LIVE disable, #30 private connection revoke, #29 TEST
  permission re-probe and #28 read-only owner tools; B-1–B-7 merged.
- **Next:** B-8c independent, owner-authenticated approval for **EVERY**
  AI-initiated money-out, with separate exact-transaction approval above the
  configured daily cap. B-8 stays **IN_PROGRESS** until verified end to end.
- **Hard gates:** IN-05 approved $500 standard, but this does **not**
  activate payments. IN-06 LIVE still OFF. No AI-write doors, real funds,
  live credentials or paid infrastructure. IN-02/03/04 deployment inputs
  remain unapproved/unconfigured.
- **Ordered batches:** A → B → C → D → V → G → H → P → W → U → R → E → X.

## Environment

- Repo: `Robinson-AI-Systems/stripe-mcp`, default branch `main`. CI validates docs, secrets, tests with throwaway PostgreSQL and stripe-mock (PR #9). The first commit (this plan) went straight to `main`
  because the repository was empty; every later change goes through an `ai/*` branch and a PR.
- Vercel project, Neon database and Stripe test keys: not created yet (IN-02, IN-03, IN-04).

## Recent merges (newest first)

**2026-10-10 — #30 B-8b2a private connection revoke:** protected owner
preview and final consent, expiring one-time intent, atomic account/client
token revocation and audit. Does not expose a public AI write operation.



**2026-10-10 — B-8b1 TEST-only permission re-probe (PR #29, pending final merge):**
 server-owned lazy encrypted TEST-key use, safe Stripe read list probes, stored
 verified permission results; no credential disclosure or LIVE access.

**2026-10-10 — B-8a read-only account tools (#28):** scoped audit and
 connection summaries, daily shared budget status and Dashboard guidance;
 8 KB response ceiling and paged result tests verified.

**2026-10-10 — B-7 write declarations (#27):** CI checks explicit read/write
 classification, confirmations and provider-derived money-spec metadata.

**2026-10-10 — B-6 profiles (#26):** filtered discovery and direct-call
 authorization; read_only and all current exposed tools remain non-writable.

**2026-10-10 — B-5 result shaping (#25):** additive dollar/currency formatting,
 Denver-local timestamps, redaction and explicit LIVE labeling.

**2026-10-10 — B-4 readable errors (#24):** safe Stripe SDK error explanations.

**2026-10-10 — B-3 app record guard (#23):** metadata ownership, missing parent
 records fail closed, refund exception does not bypass monetary owner approval.

**2026-10-10 — B-2b/B-2a LIVE guard (#22/#21):** default-deny LIVE boundary,
 expiring owner intent, protected setup form, atomic audit; live mode remains OFF.


**2026-10-10 — B-1b2 owner-approved policy and guarded write foundation (PR #20):** internal seven-case write contract and Stripe-derived USD preview; account-wide, cross-connection $500 cap; owner-approved one-use request required for every money-out; separate auditable over-limit owner action; atomic PostgreSQL reservation; rejected-versus-uncertain outcomes. Exact-head CI verified; no money-moving tool exposed. Owner browser approval B-8 and live enable IN-06 remain off.

**2026-10-10 — B-1b1 money reservation ledger (PR #19):** one additive table and database-serialized account lock for per-connection money-out reservation in America/Denver days. Conservative uncertain/confirmed statuses count against usage; no money operations exposed. B-1b2 follows.

**2026-10-10 — B-1a guarded write engine (PR #18):** internal-only, TEST-mode preview/confirm/idempotency/read-back audit, denial for missing audit or unsafe connection. No money write allowed. B-1b still needs concurrency-safe money rule and IN-05.

**2026-10-10 — A-6 deployment guide (PR #17):** docs/DEPLOY.md explains private Vercel/Neon setup, personal credential handling, restricted key templates, test-only setup page, OAuth connection and verification. No environment or Stripe account modified.

**2026-10-10 — A-5b owner setup (PR #16):** protected key-entry page, 15-minute login lockout, CSRF and origin checks, Stripe permission probes, single-view secret page and first two guarded read-only MCP account tools. No real key has been entered or live mode enabled.

**2026-10-10 — A-5a encrypted credential primitives (PR #15):** AES-256-GCM encryption with no plaintext fallback, verified test-key persistence and atomically single-use secret records, with fake and real isolated Postgres tests. The authenticated setup page is still A-5b; nothing deployed.

**2026-10-10 — A-4b OpenAPI source (PR #14):** byte-exact Stripe v2556 SDK OpenAPI, pinned and verified against published Git blob SHA-1, bounded operation lookup and unit tests; stored as 23 immutable parts due provider API upload size. Next A-5.

**2026-10-10 — A-4a Stripe client (PR #13):** official SDK at API 2026-09-30.endive, stable scoped idempotency, bounded paging and preview live-key refusal. A-4b still owns vendored operation description.

**2026-10-10 — A-3b OAuth connector (PR #12):** personal persistent refresh, authorization page, MCP endpoint and metadata; full login behavior tested in unit and PostgreSQL. No live Stripe credentials configured.

**2026-10-10 — A-3b connector (PR #12):** auth page, OAuth registration/code/refresh, metadata, MCP bearer guard, personal persistent refresh authorization. No live keys, no money movement. Next A-4.

**2026-10-10 — A-3a primitives (PR #11):** core token-hashing, PKCE, IP/login lockout and hashed OAuth database methods, real-PG rotation tests. The connector endpoints are deliberately A-3b; do not claim A-3 complete.

**2026-10-10 — A-2 database schema (PR #10):** seven foundation tables and six indexes defined additively in code, tested only on throwaway PostgreSQL; no Neon database created and no Stripe records touched. Next A-3.

**2026-10-10 — A-1 foundation (PR #9):** Node ESM registry, test-only Stripe fake, disposable Postgres adapter, secret scan, docs and budget checks, four CI gates and single `ci` merger. No Stripe requests against real accounts.

**2026-10-10 — Review fixes (docs PR #8):** two gaps found by an automated review of the Workspace server's plan,
applied here: a login refresh keeps account, mode, profile and listing (A-3); the per-pass rate limit is stored per pass
and counted in a shared Postgres table with an atomic update, tested with overlapping requests across two instances
(R-2). Next action unchanged: A-1.

**2026-10-10 — For account owners too (docs PR):** G-6 owner and administration; every dashboard setting covered as a
real tool or a guided setting; audience tags.

**2026-10-10 — General development tool (docs PR):** Batch V developer tools added; test clocks moved from E; project
profiles made optional and general; Appliance Desk framed as an example and completeness check.

**2026-10-10 — Hub architecture (docs PR):** Batch R now provides only the Robinson Tool Contract doors (passes, HTTPS
API, manifest, conformance); CLI, relay and recipes moved to Robinson's Toolkit. Contract-generic code goes in `src/core/`.

**2026-10-10 — Owner answers recorded (docs PR):** IN-00 approved, IN-01 public / no automated review; designs
marked APPROVED; A-1 READY; review rule changed to self-review in AGENTS and PLAYBOOK.

**2026-10-10 — Plan written (initial commit):** AGENTS, START-HERE, SESSION-START, PLAYBOOK, drift protocol, PLAN,
MASTER-ROADMAP, 12 batch designs, TOOL-CATALOG (283 hand-built tools + 4 universal), Appliance Desk project profile,
owner inputs, go-live checklist, decisions, roadmap, work index with validator, first card A-1. The earlier plan version
is archived in `docs/archive/plan-v1/`.

## Blocked

Engineering can continue B-8b2/B-8c with TEST fixtures. Deployment needs IN-02–IN-04; live activation IN-06 is not approved. The owner-approved money policy IN-05 does not activate money movement. Other owner inputs remain scheduled for their applicable batches.
