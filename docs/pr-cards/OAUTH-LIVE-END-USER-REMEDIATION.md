# OAuth LIVE mode and authenticated end-user delegation — runtime correction

Work kind: approved engineering correction to A-3/B-6/B-8 and R-2 provider-capability roadmap; owner decision October 17 `END-USER-AUTHORITY`. This is a coherent connection workflow bundle, not a new fictional subsection. Baseline actual main: `76080b3cdf3235d4916f944c8b69e7692918bb3a`; PR #264 merged with exact-head CI green. LIVE deployment remains unapproved and untested.

## Frozen acceptance criteria (before code)

1. The original OAuth consent UI must show TEST and only eligible, independently enabled LIVE Stripe accounts, default to TEST, require owner passphrase and a separate explicit LIVE mode selection and LIVE write consent; invalid, forged, disabled or disconnected LIVE accounts fail before a code is created. Existing OAuth client registration/PKCE/state/redirect and password lockout remain intact.
2. The authenticated OAuth code and access token must durably bind the selected account, mode, profile, listing, and specifically approved LIVE write delegation (no financial delegation by default), surviving one-time code redemption, atomic refresh rotation and concurrent requests. A forged mode or scope argument cannot widen an issued token.
3. LIVE MCP bearer must be accepted **only** on verified production with current owner-enabled account and original live key; revoke/disable/expired OAuth token immediately loses LIVE access even after refresh, no TEST fallback. Read-only or no-write LIVE OAuth cannot invoke native or universal write by naming it. LIVE full write consent must use original `defineWrite`, mode/app/financial/account guards and verifiable readback. Live money-out is not accidentally granted.
4. Provider mock and actual disposable Postgres auth → official MCP client tests prove positive LIVE listing/read, preview/confirmation of already-classified universal nonmoney operation, explicit user denial, disabled account, replayed code, refresh scope persistence, fake forged scope, and expired/revoked token. No real Stripe client keys, production operations or money moved.
5. The UI and docs distinguish developer TEST fixture restrictions from user LIVE authorization, source-implemented vs real-provider acceptance, and unimplemented specialist LIVE handlers. Keep external acceptance pending, run full final exact-head CI and review/merge only under AGENTS.

## Required seams and design

- `src/core/oauth-handlers.js`: currently MODES=[test] and hidden mode field; must have honest mode input, per-owner privilege consent, selected-account validation, full PKCE; owner password stays required. Live selection fails outside verified production.
- `src/db.js`: original `oauth_codes.data` JSON permits persisted consent without schema migration; `oauth_tokens.allow_writes` exists for service-owned RTC passes; connector token can use same durable field with zero money delegation. Keep serial refresh scope.
- `src/core/mcp-auth.js`: presently rejects any LIVE mode; ensure fresh account check + deployment check and derive original guarded LIVE consent from authenticated DB row only, never tool arguments.
- `src/core/profiles.js`, `src/core/mcp-server.js`, `src/stripe/provider.js`: existing guards from PR #264, always use original account-owned server provider; preserve read_only and idempotency.
- `tests/unit/oauth-handlers.test.js`, `tests/db/oauth-real-mcp-wire.test.js`, `tests/db/oauth.test.js`: original tests expect TEST-only; extend rather than weaken; real ephemeral isolated DB, synthetic verified LIVE account and no hosted provider.
- Leave specialized TEST-only provider handlers as explicit separate capability gap; grant eligible universal LIVE operations, do not bypass original money classifier or claim all native LIVE.

Work is permitted for synthetic engineering, not for production release or live test. Update current status, owner guide, decision/audit evidence before PR. No branch main pushes.
