# R-3a — RTC pass-area least-privilege enforcement (#156)
Status: MERGED (#156) as-if; exact-head checks and review remain mandatory.
Baseline: de56af8199fee39b20c2a1ac733562f2622dfda7; predecessor R-2 #155.
Approved: RTC 1 §2/3/4, Toolkit D-4 TEST-only owner scope.
Drift A:
| Assumption | Actual baseline | Correction |
|---|---|---|
| Pass areas already enforced | null-areas pass accepted but catalog/call ignored areas | Intersect every HTTPS tool visibility/dispatch with stored grant |
| Read-only implies no financial action | metadata may separately label money/destructive | Reject these on RTC pass doors |
| Nested meta handlers are area-safe | wrapped MCP dispatcher enforces profile, not RTC pass areas | Hide nested delegation for area-restricted passes |
Work: core RTC boundary + HTTP adversarial unit tests, no DB migration.
No direct Stripe call, no real money, no keys, no LIVE/production-account activation.
Drift B: STATUS updated; API surface unchanged; no tool registration change.
Acceptance: unscoped existing TEST passes still read; restricted areas do not
leak via catalog, describe, call or batch; indirect delegation denied; malformed
stored grant denied. Full server conformance and D-4 genuine integration pending.
