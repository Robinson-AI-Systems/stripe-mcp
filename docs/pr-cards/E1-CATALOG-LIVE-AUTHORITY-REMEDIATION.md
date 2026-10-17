# E-1 catalog end-user LIVE authority remediation — original product and price life cycle

<!-- bundle-plan:start -->
```json
{
  "baseRevision":"5e5c369adef07c74f807d4ced64b0674e9185cc6",
  "workKind":"ENGINEERING",
  "outcome":"Full owner-scoped selected TEST/LIVE native Stripe catalog reads and guarded writes, with immutable financial price terms and app ownership preserved",
  "integrationBoundary":"six product/price native reads, seven original guarded writes, account key and profile resolver, provider mode verifier, native schema, MCP/RTC listing, tests and owner docs",
  "estimatedProductionLines":230,
  "relatedWorkDecision":"E-1 is historically MERGED as a TEST-only implementation. This fixes existing developer policy leakage; never count E-1 again as a new completed original roadmap subsection.",
  "newEngineering":"Replace blanket TEST-only catalog doors with real authenticated selected LIVE provider implementation while maintaining product/price model integrity and no-customer-write developer restrictions",
  "subsections":[{"id":"E-1","acceptance":["Authenticated exact owner account TEST or LIVE can list/search/get six complete provider product and price operations","Owner-delegated LIVE write scope can create/update/archive/unarchive/delete products and create/update immutable prices through original safe guarded path","Application-owned products, prices, tax and special metadata are never mutated through generic catalog tools; unmanaged records warn when an app owns separate catalog","Lookup-key exact price creation is idempotent and nonduplicating; changes to original amount, product, interval or currency remain refused","LIVE and TEST provider object mode strictly match selected account; disable, revocation, read_only, lack of live consent, absent production and unknown outcomes deny real mutation","Original TEST and private core/RTC/DB regressions, synthetic LIVE counterpart and full exact-head CI stay green"],"remainingEngineering":["Remove developer TEST-only catalog runtime gating","Check independently registered LIVE account and Stripe balance using original provider factory","Install original explicit LIVE modeGuard for all seven already-reviewed native writers","Pass provider record mode through all app ownership, exact lookup, price comparisons and readback","Positive/negative synthetic Stripe LIVE and product pricing warnings"]}]
}
```
<!-- bundle-plan:end -->

## Source and provider facts

Stripe product and price API supports authenticated LIVE listing, search, GET, product create/update/delete and price create/update in both modes: https://docs.stripe.com/api/products/create ; https://docs.stripe.com/api/prices/create. Price amount, product identity and cadence are immutable once created. The original app-owned `owns_catalog` marker and per-account profile binding are genuine user/application protections, unlike global coding-agent TEST-only scope. Do not modify another application's product or price; do not automatically issue real customer charges or enable Stripe production in development.

## Acceptance verification and boundaries

Use `src/tools/account-mode.js` original selected-account and independent Stripe balance proof for LIVE only; keep existing TEST fixture and original native provider safe object guards. Every created/updated LIVE product and price must carry `livemode:true`; readback must not accept TEST objects. Use original `defineWrite` preview, explicit confirm, app ownership and no `outsideApp` override, idempotency and journal, persisted replay guarantees, modeGuard, field allowlist and provider state readback; failures and uncertain provider result must not claim success. Owner LIVE delegation is separate from profile/area, and money-out remains unaffected. Tests must prove positive product/price LIVE create and update, price duplicate reuse, customer-facing pricing disclosures, app-owned denial, read-only/disabled/missing owner consent, provider-mode mismatch and cross-account outcome. No real provider API calls, money/production mutation or release. Run all repository checks/exact-head GitHub CI, review and merge only after gates. Real deployed acceptance remains distinct from code.
