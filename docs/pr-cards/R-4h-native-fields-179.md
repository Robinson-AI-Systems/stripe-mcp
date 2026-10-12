# R-4h — Native read selector compatibility and genuine TEST provider proof (#179)

Status: MERGED (#179) as-if; seven exact-head checks and review audit required.
Design: RTC R-3 HTTP interface, G-5a native TEST account projection and Hub D-4 safe reads.
Baseline inspected: 42a58e53042abaa58ae8b1d7668432790722e356 (PR #178 merge).
Risk: bounded HTTPS read normalization and acceptance correctness only, no migration,
new SDK permission, Stripe mutation, money, LIVE, or production deployment.
Budget: one coherent source/probe security fix plus actual registered-handler regressions.

## Read only these
AGENTS.md, SESSION-START.md, DRIFT-PROTOCOL, HOSTING-COST-POLICY,
src/core/rtc-http.js, src/tools/account-profile.js, src/tools/billing-shared.js,
src/core/mcp-server.js, src/acceptance/rtc-service-check.js,
tests/unit/rtc-http.test.js and rtc-service-check.test.js,
docs/acceptance/STRIPE-TEST-MILESTONE.md and Hub CONTRACT §3/7.

## Drift check A
| Prior assumption | Actual at inspected main | Kind | Correction |
| --- | --- | --- | --- |
| HTTP array fields work on all readers | Generic RTC normalization stringifies every fields array; actual account_get validates native array fields and refuses string | Demonstrated production API mismatch | Dispatch-aware normalization preserves native safe arrays; HTTP string comma selectors become native arrays |
| HTTP declared field metadata reflects tool's native enum | metadata overwrote native fields array enum/max with unbounded generic selector | Contract truth | Preserve native array schema within HTTP union and enforce enum/bounds in direct+batch preflight |
| Detail summary/full universal | Native special readers can define alternative detail values (e.g. compact) | Contract compatibility | Preflight accepts only selected registered tool detail enum |
| ID-only account read proves Stripe TEST API success | account_get on permission_denied returns locally selected `{id,available:false,verification:'not_readable'}` | False acceptance risk | Opt-in --authorized-provider-read requires read-only verified account profile booleans; permission denial/foreign identity fail |
| Mock runner shows authenticated hosted provider | Prior fixture accepted ID shape, no owner pass or provider response exists in CI | Evidence boundary | Add actual registered native handler dispatch with fake SDK, plus fail-closed runner fixture; genuine owner external remains UNVERIFIED |

## Contract and coverage
src/core/rtc-http.js normalizeReadArgs(args,tool) bridges native field array
and generic dotted strings, with strict uniqueness/enum/limit/unsafe path
preflight BEFORE any batch read. Metadata matches registered field enums.
src/acceptance/rtc-service-check.js uses only id,chargesEnabled,
payoutsEnabled,detailsSubmitted and requires three provider booleans,
never declaring a 403 fallback account ID successful. The output remains
status-only, no raw API response/credentials.

tests/unit/rtc-http.test.js invokes actual G-5 account_get registered handler with
TEST fake provider, direct/batch arrays and comma selectors, invalid later
batch preflight, specialist detail enum and negative unsupported fields.
tests/unit/rtc-service-check.test.js covers permission denied, foreign,
missing area, safe projection and status-only report.

## Gate / handoff
Run seven exact-head CI check/unit/db/mock/rtc-reference/ci/target-main,
zero unresolved threads, protected merge. All external OAuth/provider TEST,
webhook and Hub D-4 remain pending until protected credentials and deployed
scheduled live revision; no forced deployment or paid infrastructure.
