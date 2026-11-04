# OWNER-OBEDIENCE-V2-MONEY — LIVE money operations (payouts, payout schedule) confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** (The one blocker recorded by the
first commit was ruled on and fixed in the follow-up commit — see
the resume note below.) Family 1 of 13 of conformance row 17,
conversion **V2** (appendix mechanism 28). This is corrective work
inside the already-merged money choreography; it completes no
predefined batch subsection and must not be counted as one.
Baseline: `main` `0c34fbe5475f9006023d9066a6e79f5ed5a46d7e` (after
PRs #303, #304, #305). Design draft:
`~/workspace/stripe-v2-design/card-money.md`; coordinator rulings 1,
2 and 6 amend it and are recorded as built below.

## Resume note — the money-out execution-leg blocker, ruled and fixed (2026-11-03)

**Resolution (follow-up commit).** The coordinator ruled the same
day: a non-pass connection's expected approval mode binds to **the
mode stored on that connection's own `oauth_tokens` row**
(`result_scope = p_connection`, kind `'connector'`) — the owner
connection kind, confirmed in the code (`getAccessToken` reads
`kind = 'connector'`; `kind` defaults to `'connector'` in the
table). The expected mode comes from the stored connection record,
never from request input. The pass branch is byte-unchanged; every
other approval term is byte-identical (account, request key, exact
amount, currency, target present, approved, unconsumed, unexpired,
10-minute freshness, and the cap/override block). A missing row, or
a stored mode outside `('test','live')`, leaves the reservation
refusing: a missing row keeps the historical `'test'` fallback in
the comparison, so no previously refused case is newly accepted.
Implemented exactly so in `reserve_money_out_guarded`
(`COALESCE(v_pass.mode, v_connection_mode, 'test')`) and mirrored
in `test/helpers/fake-db.js`. The three BLOCKED tests flipped to
the happy paths they were written for; a new ledger suite proves
the LIVE reservation end to end, the LIVE cap leg (refusal without
the override, reservation with it), and that the binding cuts both
ways (a TEST approval cannot satisfy a LIVE connection, nor a LIVE
approval a TEST one). The paragraphs below are the original blocker
record, kept verbatim.

---

The dispatcher admission and every handler in this family are
converted (below), and the non-money-out operations complete in
LIVE in tests (payout update, payout cancel, payout schedule via
both exposures). **Payout creation and payout reversal cannot yet
complete in LIVE**, for one precise reason found during the build:

- The money reservation SQL function `reserve_money_out_guarded`
  (`src/db.js`, defined at line 1247; the term is at line 1341)
  accepts an approval row only when
  `v_approval.mode IS DISTINCT FROM COALESCE(v_pass.mode,'test')`
  is false — i.e. for any connection that is not a delegated pass,
  the approval's mode must be `'test'`. The fake database mirrors
  the same term (`test/helpers/fake-db.js:677`).
- LIVE money approvals are recorded with mode `'live'`
  (`src/money.js` `prepareMoney` passes the connection's mode) —
  correctly: the owner approval page lists, stages and consumes
  them by mode, and that LIVE approval flow is proven
  (`tests/unit/money-owner-approval.test.js`).
- Result: on the owner's own LIVE connection, a payout confirm
  records a valid LIVE approval request, the owner can approve it,
  and the reservation still returns `owner_approval_required`
  forever. The refusal is safe — nothing executes, the approval is
  never consumed, no money moves — but the execution leg of this
  conversion cannot pass until that term is ruled on.

The design card put the money wiring and the SQL explicitly out of
scope ("Do not touch the wiring or the SQL"), and this is a money
gate, so the build stopped at it instead of improvising. The
decision the coordinator must make: whether the reservation should
bind a non-pass connection's approval mode to **the connection's
own `oauth_tokens` row mode** (the pass branch already binds to the
pass row's mode the same way), which would make the term
mode-general without weakening any check — the approval must still
match account, key, exact amount, currency, target, freshness and
single consumption exactly. Until then, the BLOCKED tests in
`tests/unit/money-live-conversion.test.js` assert the safe refusal
as evidence; when the term is fixed they flip to the happy paths
they were written for, and the LIVE daily-cap leg and the LIVE
read-back leg (both unreachable past the reservation today) become
testable in LIVE. The cap machinery itself remains proven in TEST
(`money-reservation`, `owner-money-limit`).

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| Money tools are refused in LIVE only because they are unreviewed | Three stacked refusals: area `money` absent from `guardedLiveAreas` (`src/core/profiles.js`); the funded condition fails on the owner OAuth connection (`moneyLimitCents: 0`); every handler wrapper returns `gone('… requires TEST mode')` and every verification invariant hard-codes `livemode===false` | All three layers converted here; the funded layer follows ruling 1(b) |
| The money gates live in the handlers | They live in the shared wiring: `src/tools/write.js` binds `prepareMoney` / `reserveMoneyBeforeWrite` / `settleMoneyAfterWrite` into every money `defineWrite`; reservation and cap are SQL-side (`src/db.js`, `reserve_money_out_guarded`) | Wiring untouched; one SQL term was not mode-general and blocked the execution leg — ruled and fixed in the follow-up commit (see the resume note): the expected approval mode now binds to the connection's own stored token-row mode |
| Payout schedule is one tool | It is exposed twice: `money_set_payout_schedule` (area `money`) and `setup_set_payout_schedule` (area `branding`, `src/tools/brand-account.js`) sharing `makeScheduleWrite()` | Shared maker converted once; the branding exposure's admission converts here per ruling 6 (its handler selector follows the mode; every other branding handler keeps its TEST-only selector for the Branding family's own card) |
| TEST behavior is the reference implementation | In TEST the handlers verify against synthetic fixtures and `livemode===false` proofs; LIVE verification must prove the same facts against `livemode===true` objects | Every invariant mode-parameterized (`livemode === (ctx.connection.mode==='live')`), never deleted |
| The family's validators accept the shared fingerprint control field | `validateFields` (shared with ~20 files in unconverted families) rejects `previewFingerprint`; PR #304's idiom updates each family's own validator at conversion time | The four converted files strip the core control field before validation and declare it in their tool schemas; the shared `validateFields` is unchanged, and top-ups (not converted) are untouched |

## Coordinator rulings, as built

- **Ruling 1(b) — owner funding.** In `src/core/profiles.js`
  (`isGuardedLiveWrite`), the funded term is now
  `(!financial || funded || ownerOwnConnection)` with
  `const ownerOwnConnection = connection?.context === 'customer';`.
  The distinguishing check: the owner's own OAuth connection is the
  one built from the owner's OAuth token record (`src/core/mcp-auth.js`,
  `src/core/k3-mcp-auth-seams.js`) — the only connection kind that
  carries a resolved grant `context`, which at LIVE is always
  `'customer'` (a developer context is refused for LIVE before a
  connection exists). Delegated pass connections
  (`src/core/rtc-http.js`) carry **no** `context`, so a pass keeps
  the funded term exactly: a pass with `moneyLimitCents: 0` still
  cannot move money, and the RTC pass door's own ceiling check is
  unchanged. `moneyLimitCents` itself stays 0 on the owner's own
  connection (whoami honesty; an acceptance harness asserts it) —
  only the dispatcher's interpretation changed. Appendix rows
  20–22 are unchanged: exact owner approval, the shared
  $500/account/Denver-day cap with its second override, and pass
  ceilings all bind exactly as before.
- **Ruling 2 — top-ups stay synthetic.** `money_create_topup` /
  `money_cancel_topup` do **not** convert to any real-bank
  behavior. `src/tools/money-topup-writes.js` is completely
  untouched, and the dispatcher names both tools as exclusions
  beside the existing `dev_reconcile_original_event` exclusion, so
  their LIVE admission is exactly what it was: refused at the
  dispatcher and refused at the handler. A real-bank top-up (a real
  debit) is new construction for the roadmap / CAP-4 enumeration,
  never presented as converted.
- **Ruling 5 — fingerprint confirmation uniform across modes.** The
  money family's previews carry the shared `WRITE-…` fingerprint;
  a confirm presenting it is bound in TEST and LIVE alike; drift
  refuses with a fresh disclosure (proven in LIVE by the drift
  test). Direct confirms with no preview keep today's behavior.
- **Ruling 6 — the payout schedule converts with this family.**
  `setup_set_payout_schedule`'s admission and handler are converted
  here; the later Branding card's admission excludes it.

## Build contract, as built

- `src/core/profiles.js`: `money` added to `guardedLiveAreas`;
  `setup_set_payout_schedule` admitted in LIVE via a named
  branding-write exception set (ruling 6); top-ups excluded by name
  (ruling 2); funded term per ruling 1(b). Tests in
  `tests/unit/profiles.test.js` updated to the new intended
  behavior and extended with the ruling-1(b) two-half proof.
- `src/tools/money-payout-create.js`: TEST-mode wrapper gate
  removed; preflight demands account and balance `livemode` equal
  to the connection's mode (account ID and US-country checks
  unchanged); verify demands the created payout's `livemode` equal
  the mode; the summary leads with `LIVE MODE` / `TEST MODE` and
  discloses the amount, the destination bank (id + last 4), the
  source type, that Stripe reports the arrival date on the payout
  once created, that a paid payout cannot be pulled back by this
  server, and the independent owner-approval requirement.
- `src/tools/money-payout-writes.js` (update / cancel): wrapper
  gates removed; every payout read demands USD and `livemode`
  equal to the connection's mode in both directions (a TEST object
  in LIVE and a LIVE object in TEST both refuse); summaries
  mode-labeled.
- `src/tools/money-payout-reverse.js`: wrapper gate removed;
  own-account and payout invariants demand the connection's mode;
  the write-contract wording (`paid, unreversed`) is unchanged;
  verify demands the reversal's `livemode` equal the mode.
- `src/tools/money-schedule-write.js`: wrapper gate removed;
  own-account and read-back invariants demand the connection's
  mode; the guided-refusal fallback is mode-aware (LIVE falls back
  to `https://dashboard.stripe.com/settings/payouts` with LIVE
  steps; TEST unchanged).
- `src/tools/brand-account.js`: only the
  `setup_set_payout_schedule` handler changed — a mode-following
  selector replaces its TEST-only selector; all other branding
  handlers are untouched.
- Provider access flows through the merged mode-aware seam
  (`modeClient` via `client()` in `src/tools/billing-shared.js`)
  unchanged; the money wiring (`src/tools/write.js`
  prepare/reserve/settle) is unchanged. One SQL term changed
  under the coordinator's ruling (follow-up commit, see the resume
  note): `reserve_money_out_guarded`'s expected approval mode is
  now `COALESCE(v_pass.mode, v_connection_mode, 'test')`, where
  `v_connection_mode` is loaded from the caller's own
  `oauth_tokens` row (kind `'connector'`) only when no pass row
  matched; `test/helpers/fake-db.js` mirrors the identical term.
  No other approval term, and no other SQL, changed.
- Aim checks preserved verbatim: rows 20 (exact owner approval),
  21 ($500 cap + override), 22 (pass ceilings), 23 (USD-only);
  `authorizeLiveWrite` in `src/tools/live-guard.js`; the app guard.

## Named tests

New: `tests/unit/money-live-conversion.test.js` (15 tests) — LIVE
preview disclosure and fingerprint format; confirm without the
exact approval refused (ruling 1(b), half ii); fingerprint drift
refusal with fresh disclosure, then execution once approved;
payout update and cancel completing in LIVE; wrong-mode object
refusals in both directions; schedule completion in LIVE through
**both** exposures plus the LIVE dashboard fallback; top-up LIVE
refusal unchanged on a fully enabled account (ruling 2); the RTC
pass door proof (ruling 1(b), half i): a zero-limit LIVE pass on
an enabled account is refused the payout call (403, zero provider
writes) and never lists the tool, while a funded pass keeps
exactly its previous listing. Follow-up commit: a fully approved
LIVE payout creation and reversal now reserve, execute once,
consume the approval and read back; an over-cap LIVE reversal
stops for the separate owner override and executes with it; and a
ledger suite proves the LIVE reservation end to end (reserve →
settle → usage read-back), the $500-cap leg at the ledger (refusal
without the override, reservation with it), and the cross-mode
negatives in both directions.

Extended: `tests/unit/profiles.test.js` — the new LIVE admission
set plus the two-half ruling-1(b) test (owner identity funds the
owner connection; a zero-limit pass stays unfunded; top-ups refused
for owner, zero-limit pass and funded pass alike; TEST unchanged).

Unchanged expectations, all passing: the family's existing suites
(`money-payout-create-contract`, `money-payout-contract`,
`money-payout-reverse-contract`, `money-schedule-write`,
`money-topup-contract`, `money-owner-approval`,
`money-reservation`, `owner-money-limit`, `money-bank-reads`,
`money-inbox`, `money-reads`, `brand-account`, `brand-kit`,
`effective-access`, and the other families' write-contract suites).
Database suites are exact-head CI's route on this machine (no local
PostgreSQL binaries); stripe-mock suites likewise run at CI.

## Done when

Met in full: dispatcher admission, handler conversion, disclosure,
fingerprint binding, mode-parameterized invariants and the
schedule's dual exposure are source-implemented and test-proven;
every money aim check is demonstrably unrelaxed (the pre-existing
refusal suites pass with unchanged expectations, and the new LIVE
tests prove no-approval, zero-limit-pass, wrong-mode and
over-cap-without-override refusals). Payout creation and reversal
complete the full confirmed-action sequence in TEST as before and,
after the reservation ruling landed and the one SQL term was
fixed, in LIVE as well. **Live proof remains open:** no account
was enabled, no LIVE key was used, and no real money moved; this
family closes on the CAP-5 owner's own-connection proof only to
the extent the owner elects to exercise it.
