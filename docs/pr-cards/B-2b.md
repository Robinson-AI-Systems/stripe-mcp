# B-2b — two-step owner reauthentication for live activation

Status: **IN_PROGRESS**. Internal activation intent, owner-only setup form and isolated tests implemented on ai/gpt6/b-2b-owner-live-approval. IN-06 activation stays OFF.
Dependency: B-1 PR #20 merged; B-2a guarded write engine PR #21 merged.
Baseline inspected: main `8ac36b8` after #21. Design: `docs/designs/BATCH-B.md` §1 B4, §3 case 6 and §4 B-2.
Risk area: activation security and owner consent; migration budget: at most one additive intent table.

## Read only these
- `AGENTS.md` hard limits and review requirements
- `docs/designs/BATCH-B.md` §1 B4 and §4 B-2
- `src/tools/live-guard.js`, `src/stripe/setup-page.js`, `src/core/oauth.js`
- `src/db.js` account/intent operations, `test/helpers/fake-db.js`, `tests/unit/live-guard.test.js`

## Drift A
| Design assumption | Actual after #21 | Correction |
| --- | --- | --- |
| LIVE guard exists | Default-deny, production/DB/owner-connection validation | Reuse; no alternate write door |
| Two-step enable exists | No activation-intent transaction or page | Implement secure one-time intent plus owner reauthentication |
| Live keys already stored | TEST keys only, no live credential | Keep no live key admission or activation in this slice |
| Live owner approval | IN-06 not granted | Keep actual enabling disabled until owner expressly approves |

## Build contract
- The first step records a confirmed, per-account intent with a 10-minute deadline;
  requesting it **never** changes `live_enabled`. No agent-supplied password.
- The second step is the existing origin/CSRF/passphrase-protected owner setup
  page, which consumes the exact intent atomically after independent owner
  authentication; replay, expired intents, cross-account and duplicate requests
  are denied.
- A server-side IN-06 account authorization gate and verified live credential
  are needed before any `live_enabled` transition. If unavailable, stay OFF.
- Any later `stripe_enable_live` tool in B-8 must call this protected path,
  not toggle the flag directly. Owner setup page shows full account identity
  and clearly states that LIVE actions could affect real money.
- Existing MCP stays TEST/read-only; no production Stripe write or key access.
- Tests: real isolated PostgreSQL atomic one-time intent; owner setup page CSRF,
  origin, 5-attempt lockout, expiry, concurrent/replay, deny without IN-06.
- Run targeted unit and db tests, `npm run check`, exact-head aggregate CI.

## Done when
Two-step handshake is implemented with an independent owner setup action
and verifiable tests; no live state is enabled or live key is configured.
Record remaining B-8 wiring and IN-06 activation permission explicitly.
