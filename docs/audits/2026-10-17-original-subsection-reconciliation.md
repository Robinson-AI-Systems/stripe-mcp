# Documentation-to-source audit: original Stripe batch subsection count — 2026-10-17

## Scope and frozen acceptance (documentation reconciliation only)

This owner-requested record repair is **maintenance, zero original product bundles**, and must not alter provider source, scopes, permissions, releases, acceptance results, or production data. Start at independently verified `main` `c24999315a2230b1e01b31e1281aff1fe7c9ac07`. Review authoritative `docs/pr-cards/work-index.json`, `docs/PLAN.md`, `docs/MASTER-ROADMAP.md`, current cards/status, original merged PRs, present source modules and regression suites.

**Success criteria**
1. Distinguish *original subsection source merge* from *external real provider/Hub/owner acceptance*, *production release*, and *post-roadmap capability correction*. Never mark external acceptance PASSED simply because CI or PR merge is green.
2. Correct seven evidently stale source statuses only when they have explicit merged PR and code/test evidence: H-1 (#243); P-1 and P-2 (#244); P-3 (#245); R-1, R-2 and R-3 (#263). Preserve their unchanged original IDs and card counts; no new subcards, no double credit.
3. Keep `V-3` (genuine TEST Event/browser end-to-end) and `G-6` (signed-in owner Dashboard review) **IN_PROGRESS** until independent external proof; preserve `E-2`, `E-3`, `E-4`, `X-1`, `X-2` as **APPROVED**, since none has an original full-section merged implementation. Confirm source still exists but no evidence substitutes for whole-section acceptance.
4. Reconcile `work-index` total and status, seven affected cards, `STATUS`, `MASTER-ROADMAP`, and `PLAN` with a source-vs-provider checklist and references. Add a stable audit table naming code/tests, merged PR SHA, outstanding provider acceptance and next rightful owner. Keep historic status paragraphs legible but explicitly superseded, not erased.
5. Reconcile actual `main`, `live`, READY serving commit and open PRs at closeout. Avoid new real Stripe transactions. All original protected external acceptance items remain last recorded 10 PASSED / 33 PENDING (43 total) pending independent evidence; no false pass or newly invented task ID.
6. Execute mandatory exact-head `check`, `unit`, disposable PostgreSQL, pinned mock, RTC service/reference, K-3 adopter and PR target policy. Review, address blocking comments, merge, then leave permanent postmerge handoff.

## Clarifications

`MERGED` in work-index means the implementation card has passed its code/CI/review merge gate—not that real Stripe, app, owner Dashboard, Hub or production deployment acceptance has completed. The genuine user-authorized LIVE capability remediation #264–#269 is **not** a new original batch subsection and is not guaranteed complete across all specialist provider modules; advanced financial/owner policy and guide-only gaps remain to be engineered despite older cards being MERGED.

**Baseline math:** `57` original indexed subsections, `43` marked MERGED, `2` IN_PROGRESS and `12` APPROVED at the starting SHA, giving `14` stale/open. Upon evidence-backed repair of seven source statuses, expect `50` source-MERGED, `2` IN_PROGRESS and `5` APPROVED; **7 remaining original subsections**. This does not mean seven PRs, seven bundles, or that only seven acceptance tasks remain.

## Evidence-backed source/CI register (one row per original ID)

All merged SHA values below come from the existing PR merge records, **not** inferred solely from file presence. Source files and tests named here were confirmed in the actual current `main` GitHub tree. The required source execution was reviewed and merged at the time; this document does not rerun, replace or rewrite their original proof. Existing original external acceptance tasks remain separate.

| Original ID | Source PR (merged SHA) | Current implementation and test anchor | What is **not** accepted by the source merge |
| --- | --- | --- | --- |
| H-1 | [#243](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/243), `157acab51f59ac9ce9ed0439b68e4f3f41489af2` | `src/tools/brand-kit.js`, `src/tools/brand-account.js`, `tests/unit/brand-kit.test.js`, `tests/db/brand-kits.test.js` | Authenticated own-account Dashboard/brand control and actual hosted Checkout/page rendering, after checked deployment |
| P-1 | [#244](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/244), `c1f9c43e838124df41ef7af85d7257154698070a` | `src/apps/profiles.js`, `src/tools/app-profiles.js`, `src/tools/app-guard.js`, `tests/unit/app-profiles.test.js`, `tests/unit/app-guard.test.js` | Actual app-owner TEST account binding, safe scope migration consent and real integration |
| P-2 | [#244](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/244), `c1f9c43e838124df41ef7af85d7257154698070a` | `src/apps/profiles.js`, `src/tools/app-profiles.js`, `src/tools/app-guard.js`, `tests/unit/app-profiles.test.js` | Opening current app routes in independently authenticated deployed app with a real bound Stripe record |
| P-3 | [#245](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/245), `fcfb013f70f49caa980cd0d5d1d449c16380fe67` | `src/tools/workflow-app-readiness.js`, `tests/unit/workflow-app-readiness.test.js`; original 21 row workflow and individually guarded change handlers | Real Stripe TEST portal/ACH/webhook observations, owner S-row decisions, app acceptance and G-6 Dashboard |
| R-1 | [#263](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/263), `9f9a4590fb510f99fafd21136d01ae3f74521dc7` | `src/core/rtc-passes.js`, protected owner page, `tests/db/rtc-passes.test.js` | Actual owner-issued external LIVE pass and verified live key/grant flow |
| R-2 | [#263](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/263), `9f9a4590fb510f99fafd21136d01ae3f74521dc7` | `src/core/rtc-http.js`, `src/core/rtc-route.js`, `tests/db/rtc-dual-http.test.js`, `tests/db/rtc-delegated-money.test.js` | Real connected source-versus-deployed authorized owner pass/HTTP operations |
| R-3 | [#263](https://github.com/Robinson-AI-Systems/stripe-mcp/pull/263), `9f9a4590fb510f99fafd21136d01ae3f74521dc7` | Source-pinned original RTC 1 Hub conformance CI and original shared Postgres/SDK fixtures | Externally accepted Hub direct/relay/Sandbox connection; fake-provider CI is not live-service acceptance |

**Do not reopen these seven as brand new approved roadmap engineering** solely because the old card header says IN PROGRESS. Follow the original card's remaining external acceptance queue, and any separately approved LIVE product-capability remediation, without double-counting old code. As always, if a later test finds genuine missing functionality, restore and fix that specific original acceptance line with honest source evidence.

## Still-open original subsections and correct next dependency

| ID | Original batch | Source index status | Concrete outstanding outcome |
| --- | --- | --- | --- |
| V-3 | Developer | IN_PROGRESS | Complete actual run-owned TEST failed payment/invoice/dispute provider Events and real Stripe-hosted Checkout payment/browser return; exact original Event independent retrieval and cleanup |
| G-6 | Owner/admin | IN_PROGRESS | Actual owner-signed-in Dashboard verification and crosschecked safe native TEST admin/readback, including settings not readable via API |
| E-2 | Catalog | APPROVED | Complete coupons/promotions/entitlements/feature/tax-rate original provider family, API-by-API user authorization |
| E-3 | Usage | APPROVED | Complete meters, usage, alerts, billing credit grants with actual provider schemas and separate financial entitlement |
| E-4 | Tax/quotes | APPROVED | Complete Stripe Tax and quotes original scope and guarded effects |
| X-1 | Undo | APPROVED | Implement safe verifiable inverse support where provider allows, without fake reversals |
| X-2 | Smoke | APPROVED | Final real read-only smoke suite and production verification gates |

**Original mathematical reconciliation:** 57 fixed IDs in index = 50 source-MERGED + 2 IN_PROGRESS + 5 APPROVED. Thus `57 - 50 = 7` not source-closed, and previously `57 - 43 = 14` was an **outdated index label** rather than seven missing feature families. V-3/G-6 are already substantially coded but lack full independently observed original acceptance. E-2/E-3/E-4/X-1/X-2 may reuse universal/provider infrastructure, but are *not* completed simply because some underlying Stripe operations exist. Count only their entire approved original scope once verified.

## Additional remaining work outside this subsection arithmetic

- **Real acceptance:** last protected ledger 43 total; 10 PASSED and 33 PENDING. Evidence must be gathered on actual source serving revision, with owner permissions and externally available provider/browser prerequisites. No connected provider acceptance status changed in this audit.
- **Release:** previous checked Vercel READY live revision `5e9a7fa7b2540f943995efc18ba307f0990dcbf5`; latest code on `main` already included #264–#269 at `c24999315a2230b1e01b31e1281aff1fe7c9ac07`. A documentation-only merge is not permission to promote production or use LIVE Stripe.
- **Product authority:** the owner requires actual user-authorized Stripe capabilities, not accidental developer-agent TEST/$0 caps. Earlier MERGED original sections still have specialist payment/billing/branding/report and financial user-specific-policy deficits, even after #264–#269 source fixes. These are genuine additional engineering obligations but **not another original approved subsection count**. The 7-ID count is not an estimate of the number of remaining PRs or complete product bundles.
- **No unwanted side effects:** index/card/status/text only. No new source logic, migration, provider/API write, Stripe secret, spending, release, customer email or external system mutation.

## Maintenance delivery and reviewer checklist

- Review the exact seven changed index IDs and unchanged **seven** remaining IDs; do not infer source completion from raw `MERGED` labels alone.
- Run repository `check` including index/doc consistency, plus entire required CI matrix and pinned private-core adopter on one exact PR head. Read all findings, correct only proven record issues and merge only under repo gates.
- Post final original counts, completed CI/review, live/main identity, pending external acceptance and next accepted original work on the merged PR. This audit **counts zero new production lines and zero new product bundles**.
