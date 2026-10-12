# R-3 HTTP failure classification — PR #161

Status: proposed; CI, self-review and merge required.
Baseline: e9b5440532e0ac5bb0744741933df62929f54e42.
Drift: HTTPS direct and batch translated backend/service errors into HTTP 403,
and batch translated invalid projections into 403. This misrepresents permission
and invalid-arguments failures to a real Toolkit Hub caller.

Implementation: retain the same TEST read_only pass, exact area and rate guards;
share an error status classifier for call, batch and result paths. No change to
MCP/OAuth, restricted credential handling, Stripe provider writes or LIVE mode.

Regression: real dispatch returns isError and cannot leak failure details;
direct and batch service_error 503; invalid projection in batch returns
invalid_args 400. Full six-check CI required. Full RTC conformance and external
D-4 direct/relay/Sandbox remain unverified; no synthetic test counts as them.

Acceptance: six exact-head CI checks, resolved reviews and owner-safe self-review.
