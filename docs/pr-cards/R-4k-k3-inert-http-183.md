# R-4k — Original Stripe HTTP inert parsed JSON (K-3 security prerequisite)

Status: IMPLEMENTED, exact-head CI/review/merge pending (#183).
Baseline: Stripe main `a38a325f07bdb993b46dc82d85e835d06281aff0`; Hub K-3 #122 immutable source differential.
Priority: HIGH — source-owned demonstrated getter/toJSON code execution prior to DB/RTC.

## Outcome and acceptance
- Replace direct JSON.stringify of framework pre-parsed request objects with descriptor-only detached inert JSON. Reject executable getter, callable toJSON, exotic prototype, cycles, sparse arrays and oversized values without executing input hooks.
- Preserve the original 16 KiB request framing limit, rawBody byte mismatch validation and existing schema/refusal behavior.
- In original RTC HTTPS service, preflight and detach body before pass lookup, rate debit, batch parsing and tool handler; original OAuth registration/authorization/token use sanitized params.
- Original unchanged unit, mock, HTTP, RTC and disposable PostgreSQL suites still run through all mandatory GitHub gates. New original-handler hostile-body regressions prove zero DB/provider executions. Actual deployed TEST and independent Hub routes are not claimed.

## Drift / boundary table
| Assumption | Actual at baseline | Change |
|---|---|---|
| Parsed caller objects are inert | HTTP helper uses JSON.stringify directly, invoking accessor and toJSON | Descriptor-only detached JSON and negative regression |
| RTC length validation protects dispatch | RTC reads req.body.calls during rate reserve before argsOf check | Reject/detach at RTC ingress before pass lookup |
| Wire size may be inferred from normalized body | Existing rawBody and Content-Length proof distinct | Preserve raw byte count/mismatch and declaration requirement |
| Hub portable HTTP is interchangeable | K-3 private module intentionally rejects unsafe body while Stripe did not | Implement Stripe-specific parity independently, do not substitute published dependency |

## Follow-up
Review immutable private candidate artifact SHA/install and preserve service-owned adapter and owner money gates; no package publication, dependency changes or release status without independent verification. Re-evaluate once #183 CI merges.
