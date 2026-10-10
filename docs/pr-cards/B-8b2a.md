# B-8b2a — Private owner-only AI connection revocation

Status: **MERGED (#30) after verified CI — private owner-only action; no public MCP write**, branch `ai/gpt6/b-8b2-owner-admin`; next card B-8b2b follows.
Baseline inspected: main `d28fc79` after B-8b1 #29 merged.
Parent card: `docs/pr-cards/B-8b2.md`. Design: `docs/designs/BATCH-B.md` §4 B-8.
Risk: connection access and owner authentication. One additive table;
no Stripe provider write operation or live credential.

## Drift check A
| Assumption | Actual merged code | Card action |
| --- | --- | --- |
| Private owner login exists | Origin + double-submit CSRF + passphrase + 5-in-15-minute lockout on setup POST | Reuse for both preview and final owner confirmation |
| Durable OAuth credentials | Account/client-bound hashed tokens and refresh tokens with `revoked_at` | Revoke only selected account/client, atomically |
| AI write tools available | MCP read-only by default; B-7 safety declarations forbid unchecked writes | Do not register `stripe_revoke_connection` via MCP in this slice |
| Audits | `change_log` exists; no owner revoke intent | Add durable one-time intent and exactly one audit in same SQL statement |

## Read only these
- `AGENTS.md`, `docs/SESSION-START.md`, `docs/PLAYBOOK.md` Step 4–9
- `docs/implementation-contracts/DRIFT-PROTOCOL.md` A/B
- `docs/designs/BATCH-B.md` §4 B-8, `docs/pr-cards/B-8b2.md`
- `src/stripe/setup-page.js` protected POST, `src/db.js` OAuth + change-log,
  `test/helpers/fake-db.js` and existing setup/OAuth tests

## Build contract
- On existing owner-only setup page, exact account and client IDs are entered
  with the owner password; first step creates a random one-use ten-minute
  database intent. No account token changes during preview.
- Second step needs the same owner authentication, origin, CSRF and a distinct
  confirmation checkbox. Atomic SQL consumes intent, revokes only that
  account/client's active tokens and audits once. Stale/expired/replayed
  requests fail closed. No direct AI write door.
- Existing tests plus `tests/unit/owner-revoke.test.js` and isolated
  PostgreSQL `tests/db/owner-revoke.test.js` cover selected-account isolation,
  expiry, bad credentials, stale-state and concurrent one-time consumption.
- `npm run check`, exact-head full `ci` green, review all applicable
  `docs/AI-PR-READ-FIRST.md` constraints and record dispositions.
- Update STATUS, ARCHITECTURE (table), GO-LIVE checklist, owner guide,
  catalog and work index. No real key, money, LIVE, infrastructure or other repo.

## Scope boundary
This builds a real private owner action, **not** an exposed MCP
`stripe_revoke_connection` tool. B-8b2b still owns other administrative
actions, B-8c separate individual money-out approvals. Never claim B-8
completed on this merge.

## Final acceptance, evidence and handoff

`tests/unit/owner-revoke.test.js` verifies owner credential, CSRF, origin,
separate confirmation, stale account/client denial, one-use/replay/expiry,
concurrent exactly-one success and unchanged unrelated connection. Isolated
PostgreSQL `tests/db/owner-revoke.test.js` proves token+refresh revocation
and one audit in an atomic statement. The final `ci` job must be green at
the exact head before merge. These owner controls cannot authorize any
Stripe money-out, LIVE key or AI-side account write.
**Next:** `docs/pr-cards/B-8b2b.md` for remaining guarded administration;
B-8c owns the independently authenticated money-approval UI.
