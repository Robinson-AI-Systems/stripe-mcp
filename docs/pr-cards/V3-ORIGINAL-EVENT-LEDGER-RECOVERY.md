# V-3/G-6/H-1 completion push — genuine provider evidence and safe ledger recovery

<!-- bundle-plan:start -->
```json
{
 "workKind":"ENGINEERING",
 "baseRevision":"913253882e19b4679c90620491c9eb3a3008471b",
 "outcome":"Allow safe recovery of an independently verified, previously emitted original TEST Stripe Event into an incomplete immutable V-3 run without Stripe mutations, and preserve exact external G-6/H-1 gate evidence.",
 "integrationBoundary":"V-3 original source Event proof, idempotent account-scoped PostgreSQL run-object insert/completion, original guarded native write contract, connected read-only custom Stripe MCP current deployed TEST facts and owner Dashboard/branding readiness",
 "newEngineering":"Implement one original verified-event reconciliation end-to-end with atomic SQL and original native write guard, test concurrency and foreign/invalid/replay/outcome paths; document actual deployed G-6 and H-1 boundaries without inventing acceptance",
 "estimatedProductionLines":260,
 "relatedWorkDecision":"V-3, G-6 and H-1 remain the original three IN_PROGRESS whole subsections, not new tiny subcards or independent completed bundles; only V-3 recovery engineering is eligible without account/owner/browser prerequisites, while G-6 and H-1 original provider acceptance still need actual signed-in Dashboard and hosted Checkout. Do not falsely relabel any subsection MERGED.",
 "subsections":[
  {"id":"V-3","acceptance":["The existing original immutable Stripe TEST Event and source can be independently matched to an exact selected-account running V-3 trigger without creating or retrying provider objects","An explicit preview/confirm-only native owner-delegated operation durably reconciles exactly that original Event ID with atomic account-scoped run completion, preserves cleaned source evidence, idempotence and full original provider readback","Unfinished runs lacking original Event, failed payment or invoice attempts, forged account/plan/source, LIVE/read_only/no consent, duplicate/racing transactions and uncertain providers remain refused; no fake acceptance"],"remainingEngineering":["Create atomic original Event insert/completion and real DB race proof","Register and guard native owner TEST reconcile tool with strictly matched Stripe Event and completed-run provider reread","Add broad source unit/DB acceptance and G-6/H-1 honest external evidence"]},
  {"id":"G-6","acceptance":["Perform currently available direct connected TEST native owner administration read-only checks; classify every unavailable actual signed-in Dashboard item as PENDING, without inference or tools that mutate provider settings"],"remainingEngineering":["Owner-authenticated signed-in Dashboard review cannot be completed through a read-only Stripe API; retain original acceptance and current real provider evidence separately"]},
  {"id":"H-1","acceptance":["Read deployed selected TEST branding kit state without changing customer-visible pages and identify exact provider/owner prerequisites for real Checkout brand acceptance; never claim unverified source version released"],"remainingEngineering":["Owner-approved kit configuration and actual Stripe-hosted TEST Checkout/branding browser proof depend on authenticated owner + scheduled release; preserve original open gate"]}
 ]
}
```
<!-- bundle-plan:end -->

## Frozen external evidence before source edits

Actual connected service `stripe_whoami` shows selected TEST account, LIVE disabled. `dev_list_runs` reports four legacy unfinished original TEST runs. The real read-only `dev_inspect_incomplete_run` call for `run_cca181e7a2d5506e1a86a535` independently verified retained `customer.subscription.deleted` Event `evt_1UQUKe46Dan0UEUVLiGLWK9d` with five matching original source rows, but no Event ledger row; the other three failed-payment, dispute and invoice runs have missing/unverified original Events and are **not** eligible for reconciliation or replay. All real reads issued no provider/DB writes.

The deployed TEST `brand_get` returned `kit:null, version:0`. The protected owner TEST `stripe_admin_overview` returned `dashboardWalkthroughVerified:false`, awaiting owner, with several Dashboard-only `not_readable` sections. A real signed-in Stripe Dashboard walk-through, actual hosted Checkout TEST payment and a checked scheduled/owner-authorized release **cannot be replaced** with faked Stripe account previews or source tests. None is claimed complete.

## Safety/verification acceptance

- Code does not touch actual Stripe TEST/LIVE data; only a future independently authorized owner-confirmed V-3 native action can append already observed original Event proof to its own SQL test-run ledger. No automatic run of the new operation from this coding session.
- Own account TEST, exact immutable run, no pre-existing recorded event, all preceding steps present and type/ID checked, exact original Event retrieved and matched with source and source ledger. Missing, mismatched, expired, wrong mode, uncaught provider error and uncertain result fail closed.
- SQL is single-statement/transaction atomic for event record + run completion, no detached “event inserted but not completed” outcome, exact request PlanDigest/scenario/size, supports existing cleaned originals for genuine Event evidence, never marks cleanup or webhook verified.
- The existing original `defineWrite` must require preview, `confirm:true`, idempotency and audited change log; a duplicate/race cannot trigger a second Stripe provider write. No user LIVE granting or $0 development cap becomes a product policy.
- Full source unit, real disposable Postgres concurrency, mock, RTC, private-core and exact-head PR policy CI before review, safe merge, then permanent source/actual deployed handoff.
