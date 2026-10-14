# Development efficiency — authoritative execution guidance

## Evidence at verified #125 (2026-10-11)
PRs #116–#125 frequently shipped a single related Stripe API operation per PR,
each needing five exact-head checks and review. Four G-6 admin handlers duplicated
TEST/account validation; three duplicated single-result MCP parsing. The implementation
guide index still called #93 G-2d the next task despite merged #125.
The existing five-job CI and pull-request concurrency cancellation are already
sound. Do not reduce coverage, remove checks, or invent time savings.

## Working procedure (security, DRIFT-PROTOCOL, PLAYBOOK always prevail)
1. Verify current main, open PRs, all review threads, CI and unfinished work.
   Read AGENTS + SESSION-START + STATUS Next, then only the JIT card's stated
   design heading, relevant code and one implementation recipe. Dated examples
   are not the queue.
2. Group several related endpoints into one cohesive PR when API area, owner
   boundary, write contract and fixtures match. Prefer ~450–800 production lines
   if natural; preserve PLAYBOOK's advisory size estimate, one migration and one
   risk area. Small finished risk-isolated PRs are valid; never pad or combine
   money-out, login, keys or destructive changes just for size.
3. Reuse authentic helpers and test fixtures before introducing abstraction.
   `src/tools/admin-read-safety.js` is the existing G-6 shared helper: exports
   `requireAdminTestAccount(ctx)`, `validateAdminArgs(args,allowed)`,
   `parseAdminReply(response)`, `readAdminTool(fn,args,ctx)`. These only
   validate TEST connection/transport. Every caller MUST separately validate
   actual Stripe account identity, provider mode, fields, page completeness,
   and redact private fields before returning observed.
4. For Stripe changes, record exact SDK mapping, raw-test initial state,
   expected read-back, refused/partial case, zero-write failures, and tests.
   Run focused unit/mock/db locally if possible, then npm run check and npm test.
   No local checkout: use GitHub REST commit route and real Actions checks,
   never report that CI ran locally.
5. Push only after the preceding CI run is finished. Collect all red failures,
   correct as one coherent batch, run all five exact-head jobs and resolve
   every review thread (including outdated) before expected-head merge.
6. Record measured CI durations, cancelled/red reruns, functional units/PR
   and known duplicate removal. No estimated speedup masquerading as data.
7. Before any handoff, note branch/PR/head, exact failing action or owner gate,
   the next correction, and the next approved JIT card. External TEST-account
   and Stripe Dashboard acceptance remain unverified without an owner session.

## Milestone-driven session and measurable acceptance (2026-10-12 owner policy)

Before choosing implementation, consult the finite TEST acceptance ledger, current deployed `live` SHA, owner input gates and active reviews. Name the capability and exact remaining criteria; fix a demonstrated defect before proposing an unrelated improvement. A PR is substantive only when it advances an approved user/developer outcome with meaningful tests. Align completed session work with a repository PR-number multiple of five when safe substantive PRs are eligible. Five PRs is normally where to checkpoint, not a quota. If all eligible work is exhausted, stop earlier with one precise prerequisite instead of small invented fixes.

Use a separate evidence row for source, real local HTTP/PostgreSQL, deployed service and connected external tests. Record successful tests by actual execution environment, never infer real Stripe TEST/OAuth/Hub D-4 from fakes or reference CI. For each BLOCKED row retain blocker, required evidence/decision, dependencies, unlock condition, next actor/action, and last checked observation; re-evaluate after a relevant change. Reuse already approved owner permissions rather than asking twice. Each substantive PR updates existing docs, and the final PR gets the permanent status/handoff; each session supplies a compact repeatable next-session prompt pointing at those records. Preserve seven exact-head checks, review resolution, default-deny LIVE and money owner gates.

**Blocker isolation and alternative-work rule (2026-10-12 owner correction):** A failed action is not a failed project. Diagnose the cause and attempt safe remedies (source, CI/configuration, dependency drift, documentation, existing authorization) before declaring an externally blocked gate. Complete all independent source/tests first. For anything still unavailable, log the narrow affected operation, exact external input/evidence, dependencies and re-entry condition; resume it automatically once cleared. Explicitly scan the remaining approved roadmap for eligible independent substantive work and proceed, even when an external acceptance or package publication remains blocked. An early batch stop is justified only by a named execution limit or evidence no eligible safe implementation remains, never by PR count or desire to hand off. Preserve all safeguards and separate local acceptance from authentic external evidence.

## G-6 focused test packet
```sh
npx vitest run tests/unit/admin-read-safety.test.js tests/unit/admin-guided.test.js tests/unit/admin-overview.test.js tests/unit/admin-security.test.js tests/unit/admin-fees.test.js
npm run check && npm test
```
No CI job, security test or full DB/mock validation is optional.
