# R-4l — Stripe-owned checksum-verified K-3 private adopter

Status: IMPLEMENTED pending CI, reviews, merge (#184).
Baseline: Stripe main `df551c660b4cdef57b1f7b48fc37faff6ec8f57a`; Hub main immutable commit `08f4189f72dbe1d5b870c7b17daabd39833eff31`.

## Scope
Independently replay original Stripe assertions *inside Stripe CI* with a
privately packed Hub candidate installed into the throwaway runner only.
Accept the exact SHA256 `3038f7664e18ac57e5fdb86daf0884f603a78a446e2f1300f20fd59a92e73ea6`
recorded by Hub #122 final SQL rehearsal; verify source commit, exact four
byte-identical modules, npm integrity, installed export manifest and private status.
Never add an unpublished package to Stripe's package.json/lockfile or deploy it.

Original Stripe 7 unit suites and 9 original service PostgreSQL suites,
including owner consent, Colorado cap, actual HTTP/RTC and dual database
connections, must pass with the four import leaves temporarily redirected and
reverted even on failure. All existing seven exact-head checks remain required.

## Drift
Hub had proven 5 unchanged original source unit and 7 SQL suites at a38a325.
Stripe #183 has a new original HTTP security regression, changing source HTTP,
not the four byte-identical leaves. Extend Stripe-run original replay to new
HTTP/RTC unit and actual PostgreSQL HTTP suites. Hub K-3 six adapted exports,
independent financial owner approval end-to-end, a published package/release and
deployed Hub D-4 remain distinct open gates.

## Next
Verify CI's actual archived digest and suite execution on PR exact head.
Then implement independently reviewed adapted export service-boundary tests
without bypassing Stripe-owned SQL, OAuth, AAD or money confirmation.
