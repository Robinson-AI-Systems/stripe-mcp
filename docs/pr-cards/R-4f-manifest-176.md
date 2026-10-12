# R-4f — RTC TEST manifest, OpenAPI and service catalog truth (#176)

Status: MERGED (#176) as-if; actual merge depends on all seven exact-head CI checks and review-thread gate.
Design: approved RTC 1 R-2/R-3 read-only HTTPS subset, docs/designs/BATCH-R.md (if present) and Hub docs/CONTRACT.md sections 1–3 and 9.
Prerequisites: #171–#175 green, actual main 43b44fb25d971033ee4789cbe41e507635d65bea.
Baseline inspected: 43b44fb25d971033ee4789cbe41e507635d65bea. Predecessor: #175.
Risk: public contract truth only; no DB migration, Stripe SDK operation or token scope change.
Budget: bounded (a metadata/OpenAPI unit, <150 production lines); no new tool, API permission or provider write.

## Read only these
- AGENTS.md hard limits and docs/SESSION-START.md §§0–3.
- docs/implementation-contracts/DRIFT-PROTOCOL.md A/B.
- src/core/rtc-http.js manifest/metadata/rtcOpenApi and tests/unit/rtc-http.test.js.
- tests/db/rtc-real-http.test.js (real loopback, isolated PostgreSQL).
- Hub docs/CONTRACT.md §§1–3,5,9; Hub D-4 pending external evidence.
- docs/HOSTING-COST-POLICY.md and docs/acceptance/STRIPE-TEST-MILESTONE.md.

## Drift check A
| Assumption | Actual baseline | Kind | Correction |
| --- | --- | --- | --- |
| Manifest reports reachable RTC pass tools | Pre-#176 reports all MCP registered tools including writes/money and multiple profiles, while HTTPS pass guard exposes only TEST read_only | Security/correctness | Count in-scope safe HTTPS tools; restrict profiles/areas/counts to that surface, test catalog parity |
| Tool metadata profiles match HTTPS | Metadata inherited MCP full/everyday profiles even for pass-only door | Semantic | Narrow returned metadata to read_only without altering MCP registrations |
| /api/openapi.json is an actual OpenAPI operation document | Present only skeletal paths; missing responses, authentication scheme and path parameter definitions | Contract accuracy | Describe only actual pass-only endpoints with 200 responses, public exceptions and bounded batch |
| Legacy null-area pass whoami reflects broad read grant | Previously reported [] despite unrestricted legacy read-only access | Correctness | Explicit null plus legacyUnscoped indicator; never enlarge grant |
| Green upstream conformance establishes actual service | CI runs hub reference fixture; real Stripe HTTP/DB subset tested separately | Acceptance drift | Add real service paged catalog parity; external/full conformance remains unverified |

## Build contract
No new Stripe API call or mutating handler. Change src/core/rtc-http.js exports
rtcManifest(registry), rtcOpenApi(), and HTTPS metadata/whoami only. Never touch
/api/mcp connector route, credentials, DB schema, business operations, LIVE or owner approvals.

## Tests and acceptance
- tests/unit/rtc-http.test.js: public exposed counts and read_only-only profiles,
  masked money/meta exclusion, genuine OpenAPI security, endpoint response and batch cap.
- tests/db/rtc-real-http.test.js: real HTTP listener + disposable PostgreSQL pass,
  paged HTTPS catalog and manifest counts/areas equality, no delegators.
- Existing cross-area, revoke/expiry, rate, 16KiB POST, money and ten-call quota
  regressions must remain green; no reference-fixture PASS called service-certified.
- Exact-head check, unit, db, mock, rtc-reference, ci, target-main; review-thread
  audit before owner-authorized protected merge.

## Handoff
Update STATUS and the separate TEST acceptance ledger; no documentation-only PR.
Next: independently validate deployed source after scheduled live promotion and
security-approved real OAuth/Stripe TEST webhook/Hub D-4, then only fix demonstrated
contract or provider defects. External blocks remain named, no fabricated PASS.
