# R-4j — pinned official RTC 1 conformance against actual Stripe TEST HTTP subset (#182)

Status: MERGED (#182) as-if; only final exact-head checks, self-review, zero unresolved threads and an authorized merge make it so.
Baseline: f87324e9a4f949f8e9b8548b29757b1a1d7e3a82 (#181). Approved Batch R design + actual Hub RTC 1 contract.
Risk: truthful contract, HTTP error behavior and CI verification; no schema migration, provider write, LIVE or external host.

## Drift A

| Assumption | Actual inspected | Correction |
| --- | --- | --- |
| Upstream RTC CI certifies Stripe | Current rtc-reference runs Hub's own fake fixture only | Run the PINNED actual upstream runner against local actual Stripe registry HTTP + throwaway PostgreSQL |
| Full RTC 1 works on HTTPS | Actual manifest exposes only TEST read_only and zero writes | Report supported named checks independently; raw upstream full/write checks remain failures/out of subset, overall full certification false |
| RTC `not_found` matches unknown POST tool | RTC call adapter classifies every unknown name as forbidden (403) | Unknown name -> 404 `not_found`; existing restricted/money/write name remains 403 `refused_by_guard`, no Stripe call |
| OAuth/dual-process check is passed by this suite | Actual source #181 local OAuth SDK boundary and #165 dual HTTP listeners separate | Leave external OAuth and 2 independent OS-process hub quota probes explicitly unverified |

## Build and proof

- `src/core/rtc-http.js`: distinguish absent versus extant but forbidden tools while keeping area, profile, money and no-write guard authoritative.
- `scripts/rtc-service-subset.mjs`: own fake TEST account + generated one-hour passes in disposable isolated PostgreSQL; genuine loopback HTTP uses actual Stripe registry and RTC handler. Execute unmodified pinned upstream `runConformance` from Hub commit `f8e61dbc`.
- Assert upstream actual-service applicability: public manifest, bounded OpenAPI, catalog metadata, pass refusal, expired/revoked refusal, compact budget; the upstream safety probe depends on forbidden write fixtures and is OUT_OF_SUBSET, while a separate real HTTP assertion verifies safe unknown-tool 404 and write 403. Assert full-profile meta/read/write/readonly-write probes remain known OUT_OF_SUBSET (upstream demands write tools), and refresh and two-process checks are SKIP rather than silently PASS. Confirm forbidden write still 403.
- Existing db CI job checks out pinned Hub and runs both normal `npm run test:db` and this service-level test under localhost PostgreSQL, without changing the protected seven CI jobs or reaching the hosted service.
- If actual-service upstream checks fail, fix demonstrated implementation drift, not the upstream reference or TEST safeguards. The script exits nonzero for unsupported probes unexpectedly passing or failing for another reason.

## Closure

Pass seven exact-head check/unit/db/mock/rtc-reference/ci/target-main checks and self-review with zero unresolved threads; verify final main six. This is source + local actual-service conformance **subset only**. Real deployed conformance, full RTC 1, actual Stripe TEST reads, hosted OAuth, webhook and D-4 remain separate external gates. Next eligible work must be independently justified by a real finding or approved G-4/G-5/G-6 task; no padding.