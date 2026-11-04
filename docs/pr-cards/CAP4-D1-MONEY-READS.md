# CAP4-D1-MONEY-READS — money reads serve the connection's own mode with per-object verification

Status: **SOURCE-IMPLEMENTED.** Family D-1 of CAP-4 (Phase 1 of
the frozen sequence, second after D-3). Read paths only: no write
handler's mode gate, ceremony, aim check or dispatcher admission
moves, and the money wiring (`src/core/write.js`, `src/money.js`,
`src/db.js`) is byte-untouched. Baseline: `main`
`d547c8544594a89ec906532b4e803ecf3ca6f777` (PR #321,
CAP4-D3-INVOICE-BILLING-READS). Design record: the CAP-4 card set
(`card-money-reads.md`, `census.md` §2/D-1, `sequence.md`,
`coordinator-rulings.md`) in the coordinator's design folder; the
family's write side is OWNER-OBEDIENCE-V2-MONEY and
OWNER-OBEDIENCE-V2-SHARED; the read idiom is the one D-3
established (mode-threaded projections, wrong-mode refuses the
read, no-mode callers byte-identical).

## Scope

Ten tools, three gate sites, one embedded sub-check:

- `src/tools/money-reads.js` — eight tools (`money_get_balance`,
  `money_list_balance_transactions`,
  `money_get_balance_transaction`, `money_list_payouts`,
  `money_get_payout`, `money_list_payout_transactions`,
  `money_list_topups`, `money_get_topup`) behind one wrapper that
  refused every non-TEST connection before any provider call, plus
  the embedded TEST check inside `money_list_payout_transactions`
  (the automatic-payout proof rejected `payout.livemode===true`).
- `src/tools/money-bank-reads.js` — two tools
  (`money_list_bank_accounts`, `money_get_payout_schedule`) behind
  two module-local gates with their own refusal texts, an
  identity-only account check, and a hardcoded `mode:'test'`
  literal in the schedule result.

Census trace: 8 operations claimed for D-1 in the reconciliation
appendix (balance ×1, balance_transactions ×2, payouts ×2,
top-ups ×2, and `GET /v1/accounts/{account}/external_accounts`
claimed here as `money_list_bank_accounts`' provider subject).
`money_get_payout_schedule`'s subject (`GET /v1/account`) is
claimed by D-7; this card converts the tool, D-7 owns the
operation row. No operation is double-claimed.

**Phase 0 confirmation (sequence.md Phase 0, folded into this
build):** CAP-2's remainder is authorization source-policy
(`src/core/profiles.js`, `src/tools/meta.js`,
`src/core/mcp-server.js` diagnostics, per `docs/pr-cards/CAP-2.md`)
and CAP-3's remainder is identity/tenant/grant lifecycle
(`src/core/oauth-handlers.js`, `src/core/mcp-auth.js`, `src/db.js`,
`src/keys.js`, `src/stripe/credential-context.js`, per
`docs/pr-cards/CAP-3.md`). Neither card names or touches
`src/tools/money-reads.js` or `src/tools/money-bank-reads.js`;
a grep for the money-read modules across both cards and
`docs/COMPLETION.md` returns nothing. **No overlap.**

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| One wrapper gate refuses all 10 tools | True for 8 (the `money-reads.js` wrapper loop). `money-bank-reads.js` carries its **own** two gates with different refusal texts, as the card's drift table said | All three sites converted; no single edit was assumed to cover the family |
| The projections are mode-neutral | They surface `livemode` as data but verify nothing: on a TEST connection a LIVE balance, transaction, payout or top-up projected without complaint — only refusal stood between the family and LIVE, there was no verification in either direction | The four projections (`safeBalance`, `safeTransaction`, `safePayout`, `safeTopup`) take the connection mode as an optional parameter and verify via `assertAccountResourceMode` when it is `test`/`live` — the D-3 shared-projection precedent. They are module-local, so handler callers always supply the mode and no external caller exists to drift; a caller that supplied no mode would keep the historical behavior exactly |
| `money_list_payout_transactions` needs only its wrapper removed | Its automatic-payout proof embeds a second, deeper TEST check (`payout.livemode===true` refuses), and its listed transactions were never verified | The proof is parameterized to the connection's mode with the same exactness (exact payout object, exact ID, `automatic===true`, `livemode` equal to the connection mode when present); the manual-payout exclusion stands in both modes; scope string and result shape unchanged; the listed transactions verify through `safeTransaction` |
| The payout-transactions refusal text can simply be de-TESTed | The combined refusal names TEST ('Exact automatic TEST payout required…') | The text now names the connection's own mode, so the TEST wording is **byte-identical** to baseline and the LIVE wording is accurate — recorded here as the build's interpretation of the card's named parameterization |
| Bank/schedule account verification is an identity check only | `authenticatedAccount` retrieved the account and compared IDs; it demanded no mode evidence in either direction, so a TEST connection whose provider evidence said LIVE was served | Verification now follows the connection mode via the verified-account readers (TEST reader for TEST, LIVE reader for LIVE) — the converted branding writes' `modeAccount` precedent in `brand-account.js`. Refusal texts on this path are now the readers' established texts (identity/mode evidence), replacing the module's local mismatch text; every pre-existing assertion on this path checks `isError` only |
| The schedule result's `mode` field is data | It was a hardcoded `'test'` literal — a hardcoded mode field in an output, the gate species the coordinator's brief names | It now reports the connection's own mode; on the TEST connections this read has always served the value is unchanged (proven byte-identical by test) |
| Bank objects need no verification | `summary()` checked shape and foreign-account ownership but not mode | `summary()` takes the connection mode and verifies the bank's own `livemode` after its historical shape checks (the `safeCredit` precedent); a bank object with no `livemode` passes, as before |
| No other callers depend on these handlers | `admin-guided.js` and `admin-overview.js` call both bank handlers directly for their native setting reads | Both consumers are TEST-account-scoped (`requireAdminTestAccount` / the admin read path) and pass a TEST connection, so they take the converted TEST path with byte-identical results; their suites stand in the regression run. The D-7 card owns the admin families themselves |
| The pre-existing bank fixture can stand as-is | The fixture account omits `livemode` and the mock had no `balance` surface; the verified TEST reader demands independent balance evidence exactly then | One fixture completion in `tests/unit/money-bank-reads.test.js`: a `balance.retrieve` stub returning `livemode:false`. **No assertion in that suite changes** |
| A modeless connection keeps the old fail-reply | At baseline the wrapper/gates returned `fail(...)` for any non-TEST mode, including a missing one | After conversion a modeless connection is refused by the shared seam (`modeClient`), exactly as in every converted family; the dispatcher always supplies a connection mode |
| A decision entry is expected if behavior choices arise | The refusal-text interpolation and the reader-text adoption are implementation interpretations of the card, recorded in this table | No `docs/DECISIONS.md` entry, per the V2-BILLING and D-3 precedent |

## Build contract, as built

- `src/tools/money-reads.js` — the fail-closed wrapper loop is
  deleted; `safeBalance`, `safeTransaction`, `safePayout` and
  `safeTopup` gain the optional mode parameter and verify via
  `assertAccountResourceMode` before their historical shape checks
  (the D-3 `itemSafe`/`subscriptionSafe` placement); every handler
  passes `ctx?.connection?.mode`; list projections close over the
  mode so a wrong-mode member refuses the whole read;
  `money_list_payout_transactions`' automatic-payout proof is
  mode-parameterized as recorded above; the eight descriptions and
  the module header name both modes. Amounts pass through the
  established projections unchanged — nothing is invented, rounded
  or re-derived.
- `src/tools/money-bank-reads.js` — both gates are deleted;
  `authenticatedAccount` dispatches to
  `readVerifiedTestAccount`/`readVerifiedLiveAccount` by the
  connection mode; `summary()` gains the mode parameter;
  `money_get_payout_schedule`'s result `mode` reports the
  connection mode; the provider-denial and not-supported results
  (`available:false` with their reasons) are unchanged in shape and
  now reachable in both modes; the two descriptions and the module
  header name both modes.
- Transport is unchanged: handlers already ran on the shared
  `guarded` seam, whose LIVE resolution goes only through the
  verified selected-account path. No dispatcher, profile, registry
  or reachability change: the same 322 tools, the same profiles.
  No SQL, no schema, no Stripe operation added or removed. No
  write handler, money gate or money wiring file is in the diff.

## Named tests

New suite `tests/unit/cap4-d1-money-reads.test.js` (20 tests):

- **Balance:** LIVE balance projected on LIVE (amounts exact);
  wrong-mode balance refused in both directions (the refusal is
  the mode-mismatch verification, asserted by message).
- **Balance transactions:** list and get refuse wrong-mode in both
  directions; LIVE list/get project with exact fee/net.
- **Payouts:** list and get project LIVE payouts on LIVE; refuse
  wrong-mode in both directions.
- **Top-ups:** list and get project LIVE top-ups on LIVE; refuse
  wrong-mode in both directions.
- **Payout transactions:** an automatic LIVE payout verifies on a
  LIVE connection (scope string and shape unchanged); a TEST
  automatic payout is refused on LIVE and a LIVE one on TEST;
  manual payouts stay refused in both modes; a wrong-mode
  transaction inside the list refuses the read.
- **Bank accounts:** LIVE banks project on LIVE, masked (no
  routing/account-number keys); a wrong-mode bank is refused in
  both directions; a TEST connection whose provider balance
  evidence says LIVE is refused (the verified-reader evidence
  check); a provider denial still reports `available:false`, now
  on LIVE too.
- **Payout schedule:** the LIVE schedule reads back with
  `mode:'live'`; the TEST result is asserted **byte-identical**
  (`toEqual` on the full object).
- **Descriptions:** all ten name both modes (`TEST or LIVE`) and
  claim neither alone.
- **Baseline record:** 17 of the 20 fail at baseline `d547c854` —
  every LIVE happy path (refused by the wrapper/gates), every
  TEST-direction wrong-mode refusal (no verification existed),
  the provider-evidence refusal, and the descriptions. The 3 that
  pass at baseline are the cross-mode payout-transaction refusal
  (refused then by the embedded TEST check and the wrapper, now by
  the parameterized proof), the manual-payout exclusions, and the
  TEST schedule byte-identity — each passing after for the
  converted reason or, for the schedule, unchanged by design.
- **Regressions standing:** the pre-existing
  `money-reads`/`money-bank-reads` suites pass (one fixture
  completion, no assertion changed); the V2 money write suites
  (`money-live-conversion`, `money-payout-contract`,
  `money-topup-contract`, `money-schedule-write`), the money
  snapshot composite and the admin suites pass unchanged in the
  full unit run; `registry` still counts 322 tools.

Database tests are exact-head CI's route: this build environment
has no local PostgreSQL binaries (`session:prepare` reports
`localPostgresBinaries: false`), and no database code changes here.

## Acceptance

- All 10 tools serve TEST and LIVE connections with per-object
  mode verification; wrong-mode objects are refused in both
  directions; a LIVE money read never projects a TEST-mode object.
- Every pre-existing read expectation stands; TEST output shapes
  are byte-identical (asserted in full for the payout schedule;
  the rest are covered by the unchanged pre-existing suites).
- **Live proof stays open in the CAP-5 queue:** protected-
  acceptance rows for money reads on the owner's own LIVE
  connection after a checked release — balance, one payout, one
  top-up, bank accounts, payout schedule — move to the CAP-5
  queue; this card claims source implementation only.
- The CAP-4 work-index entry names this card while D-1 is the
  family's current unit (the D-3 registration pattern);
  COMPLETION's CAP-4 section and the conformance progress note
  record D-1 with this card.

## Done when

- The three gates and the embedded check are converted, the new
  suite and the full unit suite pass, `npm run check` is green,
  and the docs named in this card are updated. The successor
  inherits: D-2 (payment reads) next in the frozen Phase 1
  sequence.
