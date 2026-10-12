# R-3c — Owner-selected least-privilege RTC pass areas (#158)
Status: MERGED (#158) as-if; six exact-head CI/review gate.
Baseline: b99eaf95663de34149d313b8571e309921259cc8; #156 enforces persisted areas, #157 supports page/projection.
Drift A: owner form issues only unscoped read-only TEST passes, despite RTC
contract's chosen area grant and implemented scope checks. The Postgres areas
TEXT[] column and pass-only authentication already exist.
Implementation: authenticated origin/CSRF/passphrase owner form selects bounded
comma-separated known read-only areas, defaults to server-only; issuer rejects
unknown/duplicate/empty; store TEXT[] via string_to_array without new migration.
Return only selected area names, never bearer. Existing MCP unchanged.
Tests: forged selections, scoped issuance/revocation, real disposable Postgres
area roundtrip and owner form selection. No money, provider writes, LIVE.
Drift B: STATUS, this card. D-4 genuine route and full-role RTC conformance pending.
