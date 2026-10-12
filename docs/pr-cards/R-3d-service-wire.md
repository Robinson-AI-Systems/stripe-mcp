# R-3d — Actual Stripe RTC safe-service HTTP acceptance (#159)
Status: MERGED (#159) as-if, exact-head six CI checks and no review threads.
Baseline: ade1f39bd6a39fb4dd70a7ae8fe169e2a571f8dd; R-3c area grants from #158.
Drift A: hub pinned reference fake conformance tests run, but real Stripe server
HTTP handlers and PostgreSQL credential grants have never been exercised
together through a TCP loopback request. Required: real registry and guards,
public contract, authenticated metadata read, refusal of write, scoped handles,
expired and independently revoked passes in a throwaway database.
Work: additive real HTTP network integration in tests/db; existing db job
executes it against local ephemeral PostgreSQL with fake test account only.
No Vercel secret, actual external Stripe call, live-mode or provider mutation.
Drift B: STATUS updated; API unchanged. This is safe-slice evidence, NOT full
hub conformance and NOT genuine owner direct/relay/Sandbox D-4.
