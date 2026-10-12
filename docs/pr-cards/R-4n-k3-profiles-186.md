# R-4n — Stripe-owned portable profiles / listing boundary
Status: IMPLEMENTED, #186 CI/review/merge pending.
Baseline Stripe main: `a2a5949884e204eb8f8d041e51a91b80d6c09d2a`; immutable Hub core candidate
`08f4189f72dbe1d5b870c7b17daabd39833eff31`, SHA256 `3038f766...`.

## Capability
Rehearse adapted portable `./profiles` in the **original Stripe service**
in separate disposable CI, not Production. Re-export only shared generic
profile functions; retain Stripe `isGuardedTestWrite` and
`listingForConnection` including guarded TEST areas, explicit write metadata,
profile visibility, money-write exclusion, legacy meta tools and compact mode.

Preserve original code as active source. A future reviewed package migration
must use this same Stripe-owned service seam and published immutable package,
not blindly replace `src/core/profiles.js`.

## Independent acceptance
Original source profile, registry, server dispatch, RTC HTTP/atomic batch
and guarded write unit suites through the privately installed core (six);
actual service PostgreSQL HTTP/RTC, dual listener, OAuth connector and
owner transaction/cap suites (five). Existing #184 7+9 source suites and
#185 two-pool one-time secret proof stay in same exact-head DB job.
No active private dependency, no REAL Stripe provider or LIVE mode,
no auth/cap bypass. All seven exact-head checks and review resolution.

## Drift
Hub profile core lacks Stripe-specific `isGuardedTestWrite`,
`listingForConnection`; source module is adapted, not byte-identical.
All six adapted interfaces remain individually gated and final GitHub
Release/remote Hub D-4 unverified.
