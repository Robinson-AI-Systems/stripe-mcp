# OWNER-HTTP-DB-205 — original owner page HTTP + PostgreSQL end-to-end CI

Status: proposed, PR #205, final owner-setup audit tranche from #201 through #205. Complete this cohesive group before a single checked production release; no per-fix deployment.

**Scope:** New isolated localhost PostgreSQL/HTTP suite using original owner `createSetupHandler`, actual SQL login attempts and saved account metadata, actual HTML URL form/CSRF/Origin checks, production owner TEST diagnostics and bounded report projector (synthetic provider), and the original encrypted one-time secret issue/consume. No raw TEST key or account data from production, no Stripe network call, no owner passphrase or Vercel SSO bypass.

**Proof:** GET form plus no-store/referrer, wrong password and forged Origin denied, password-only enrolled TEST account ID inventory excluding LIVE-only accounts, verified read-only failure-stage 503 vs explicitly synthetic 200 tool statuses, one-time credential first-screen display and replay 410, all backed by disposable PostgreSQL. PR #204 separately verifies original outer Vercel entrypoint wire limits. All seven exact-head checks and post-merge six CI jobs green; no unresolved review threads.

**Release/acceptance:** After merged #205, verify main checked and `live` still previous #200, then owner-approved one-time grouped promotion or existing scheduled checked main→live promotion; do not automatically initiate another live deployment. Verify Vercel production READY at exact checked commit before asking owner to use new account ID lookup/stage reason and re-run G-6. Genuine provider, OAuth PKCE, signed webhook, Hub routes and owner Dashboard are separately blocked and may not be marked PASS by this suite.
