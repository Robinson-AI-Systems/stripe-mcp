# R-3b — RTC paginated discovery and client field selectors (#157)
Status: MERGED (#157) as-if; exact-head CI/review mandatory.
Baseline: 32971734fc2b7c015bd9385961b710cf7edece3e; predecessor #156 narrowed scopes.
Drift A: GET catalog exposed next offset but did not accept offset; the hub
runner sends field arrays while core projection requires comma-separated paths.
Implementation: bounded offset/limit, accurate next, audience filter,
safe field-array conversion at RTC HTTP edge. Original MCP unchanged.
Tests: disjoint paginated results, empty tail, hostile offset/audience/fields,
and core projection with actual handler readback.
No provider writes, secret exposure, LIVE or money.
Drift B: STATUS updated; no tool registration or DB change.
Full write-role conformance and D-4 real routes remain unverified.
