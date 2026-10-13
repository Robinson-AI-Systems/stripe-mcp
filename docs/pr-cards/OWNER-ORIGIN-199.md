# OWNER-ORIGIN-199 — canonical owner setup across Vercel aliases

Status: as-if merged for PR #199; exact-head CI/review required. Demonstrated owner failure 2026-10-13: a legitimate form loaded at `stripe-mcp-psi.vercel.app` POSTed its own Origin, but the existing owner handler compares to canonical `PUBLIC_BASE_URL=stripe-mcp-chris-projects-de6cd1bf.vercel.app`, returning 403 before TEST smoke.

**Acceptance:** A GET to an alternate owner setup alias redirects to the fixed configured issuer's `/api/stripe/setup`; no CSRF cookie or sensitive query/reveal selector is propagated. Canonical GET returns normal CSRF-protected owner form; any noncanonical POST remains 403. No issuer change, no reliance on attacker-controlled Host for permissions, no key read/write, no Stripe provider mutation or LIVE. Unit regressions for valid canonical, alternate GET, alias POST and selector nonreflection. Owner can use canonical URL immediately; real TEST probe remains a separate owner acceptance gate.

**Review and release:** Exact-head seven checks, full diff self-review, zero unresolved review threads, approved merge to main; daily checked main-to-live release only. Continue genuine authorized TEST account smoke and separately authenticated PKCE, webhook and Hub acceptance when owner evidence is available. Do not mark external acceptance PASS from redirect/CI.
