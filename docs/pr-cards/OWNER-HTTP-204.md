# OWNER-HTTP-204 — owner request-body gate at deployed entrypoint

Status: proposed. Whole-page audit uncovered an original-service transport gap: `api/stripe/setup.js` previously initialized Neon SQL and associated stores before applying the shared original-wire request-size and content-type checks. Method rejection happened deep in the handler after database startup.

**Scope:** Only GET and POST, with the existing 16KB request-body/Content-Length safety check performed before any Neon startup. Reject unsupported POST content types early; preserve same-origin, CSRF, password lockout, exact TEST account, restricted-key isolation, encrypted key store, single-use intents, and LIVE/money approvals.

**Evidence:** Original API handler unit requests for excessive declared Content-Length, inconsistent wire bytes, unsupported methods and media types; positive small valid form passes preflight into existing owner-auth checks. Existing `incomingBodyWithinLimit` helper remains unchanged. No provider-side tests or deployment.

**Exit:** Exact PR-head all seven green, no actionable review threads, final-main application checks, and one consolidated checked owner setup release candidate after full audit. Owner real TEST acceptance remains separately unverified.
