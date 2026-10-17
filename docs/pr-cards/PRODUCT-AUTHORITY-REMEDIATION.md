# Product authority runtime remediation — cross-cutting existing B/C/U/R acceptance correction

**Owner decision:** 2026-10-17 developer restrictions must never masquerade as permanent product restrictions. This is corrective work within the already approved B-6/B-8, C-2, U-1 and R-1/R-2 scope, **not a new countable roadmap subsection**. Do not relabel previously merged code as a new bundle. Approval here authorizes source work, not provider charges, production changes, owner actions or release.

**Pre-code baseline:** `main` 9f9a4590fb510f99fafd21136d01ae3f74521dc7 (R-1–R-3 merged), `live` 5e9a7fa7b2540f943995efc18ba307f0990dcbf5; 0 open PRs on inspection. Released-provider acceptance separately queued (10 PASSED/33 PENDING in recorded ledger), not implied by source.

## Frozen acceptance criteria before implementation

1. Enumerate separately developer authority, real provider limits, per-user delegation, and implementation gaps across OAuth, RTC, universal operation dispatch, guarded native writes, financial controls, account/admin/security, setup/flags and guided fallbacks. Cross-link actual paths and current decisions; never declare coverage from `MERGED` alone.
2. A properly owner-issued and activated LIVE RTC pass with full profile and authorized write grant must discover and execute existing audited native nonmoney write families through direct RTC calls. The identical TEST grant must work. An explicit read-only pass, disabled LIVE account, revoked/expired pass, disallowed area, unauthenticated request and absent live write consent must fail before provider mutation.
3. Authenticated native discovery/meta-call must show and invoke only those writes the installed server guard can really execute. No newly advertised tool may bypass native `defineWrite`, provider authentication, actual profile/area, app ownership, preview/confirmation, idempotency, journal/readback, or independent financial approval. LIVE is never implicitly enabled.
4. Pinned universal `api_read` and safe verified `api_write` must respect the selected account's verified TEST/LIVE mode; never call the other mode or accept mismatched provider resource modes. LIVE writes require production, independently enabled account, owner LIVE write delegation and the same original native safety/uncertain-outcome protection.
5. No arbitrary unknown or amount-unclassifiable provider write becomes executable just because it is an API operation. Catalogued provider capabilities missing executable provider-specific classification/readback remain explicitly tracked, not hidden as policy. True Dashboard-only settings remain guided only where no safe executable provider API exists.
6. Add regression proof for a properly authorized operation, explicit user denial, live-account/permission boundary, audit/confirmation/readback, and no developer TEST fixture gaining LIVE/financial rights. Run focused unit and real-database tests where supported, all required exact-head CI, self-review, then merge only after gates. Keep protected external acceptance PENDING until independently observed against serving READY code.

## Initial drift and code seam map

| Existing subsection | Existing path and contradiction | Required resolution |
| --- | --- | --- |
| B-6/B-8 | `src/core/profiles.js`: `listingForConnection` filters LIVE writes through a TEST-only eligibility helper; several shipped native write areas are excluded from `guardedTestAreas`. | Align discovered/dispatchable names with audited wrapped write capabilities, retain workflow allowlist and profile/owner restrictions. |
| C-2 | `src/tools/meta.js`: `stripe_call` uses TEST-only `isGuardedTestWrite`, labels all writes TEST even in LIVE. | Match dispatch original guards; preserve batch reads-only. |
| U-1 | `src/tools/universal.js` hard-refuses every LIVE read/write and forces `livemode:false` even for an authorized LIVE pass. | Mode-consistent typed provider verification; never widen unknown financial operations. |
| R-1/R-2 | `src/core/rtc-http.js` supports owner-consented LIVE passes and DB-revocation/mode checks; descriptive OpenAPI/auth text still claims TEST-only. | Correct description; maintain pass-only bearer and owner confirmation. |
| A-3 | `src/core/oauth-handlers.js` and `mcp-auth.js` hardcode TEST; unlike RTC, generic OAuth does not expose owner-selected LIVE pass delegation. | Record as independent remaining implementation seam if not safely shipped in this coherent correction; do not lie about OAuth parity. |
| B-1/IN-05 | `src/money.js`, `src/db.js` durable independent approvals and $500 default may be owner policies rather than developer policy; historical `docs/DECISIONS.md` calls IN-05 an explicit owner decision. | Preserve existing explicit owner choice and actual ledger protection until owner policies are represented per actual user; never silently treat developer $0 as user cap. |

## Verification and delivery

Capture original affected tests in `tests/unit/profiles.test.js`, `tests/unit/meta.test.js`, `tests/unit/universal.test.js`, RTC/DB tests for account+pass enforcement. Use only synthetic provider and disposable DB, never live keys or spending. Update `docs/DECISIONS.md`, `docs/STATUS.md`, `docs/OWNER-GUIDE.md` with separately classified implemented, unverified/provider and remaining capability gaps; no actual release in this work.
