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
   if natural; preserve PLAYBOOK's ~800-line hard stop, one migration and one
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

## G-6 focused test packet
```sh
npx vitest run tests/unit/admin-read-safety.test.js tests/unit/admin-guided.test.js tests/unit/admin-overview.test.js tests/unit/admin-security.test.js tests/unit/admin-fees.test.js
npm run check && npm test
```
No CI job, security test or full DB/mock validation is optional.
