# G-3a — Safe TEST Radar reads
Status: MERGED (#97), exact-head CI evidence required.
Predecessor #96 merged at 09ed53a048820989a3f69c057ebf8a6be0c2a988. Batch G G-3, catalog Risk and identity.
Risk: private fraud/identity data. Migration none. No LIVE.
Read only: AGENTS; SESSION-START; Batch G G1/G-3; implementation-guides/REMAINING;
src/tools/billing-shared.js; dispute-reads.js; TOOL-CATALOG risk section.
## Drift A
| Planned | Verified API/code | Correction/test |
| --- | --- | --- |
| Radar rules available | No documented API | No rules tool, use guided UI |
| Radar may include IP and cardholder | Review contains IP and billing ZIP | Strict safe projection excludes sensitive fields |
| Value list items are harmless | Values include email, card fingerprint | Return only ID, presence and list ID |
| SDK list returns fully safe shape | Mixed schemas, pagination | Verify object, TEST mode, IDs and list ownership |
## Implementation
Existing client(ctx), guarded, pageResult, paging, ref, local. New risk read module
src/tools/radar-reads.js exports six tools/handlers + safe projections.
No provider writes or SQL. SDK GET routes:
radar.earlyFraudWarnings.list/retrieve, reviews.list/retrieve,
radar.valueLists.list, radar.valueListItems.list({value_list}).
Tests: tests/unit/radar-reads.test.js, tests/mock/radar-reads.test.js;
registry/profile/meta + five exact-head CI.
G-3b inherits validated schemas/IDs; mutation requires independent verified
preflight and own new tests, no raw PII in audit.
