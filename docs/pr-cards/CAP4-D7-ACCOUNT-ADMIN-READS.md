# CAP4-D7-ACCOUNT-ADMIN-READS — account and admin reads follow the connection mode

Status: **SOURCE-IMPLEMENTED, with one leg FLAGGED for a coordinator
ruling (the key-permission probe — see "Flagged, not converted").**
Family D-7 of CAP-4 (the seventh CAP-4 family built, in the frozen
Phase 1 sequence after D-6). Read paths only: no write handler's
mode gate, ceremony or verification moves, and the money wiring
(`src/tools/write.js`, `src/money.js`, `src/db.js`) is
byte-untouched, proven by an empty name-only diff against the
baseline. Baseline: `main`
`5ad332267cd93178f5ea5c89bdde41be60164b0f` (PR #328, CAP-4 D-6).
Design record: the frozen card `card-account-admin-reads.md` and
`coordinator-rulings.md` in the coordinator's design folder. The
coordinator's in-flight ruling on the shared admin gate (the
guided-settings tools) is recorded under Drift, row 6.

## Scope, as built

Nine registry tools carry this family's conversion: `account_get`
and `account_list_capabilities` (account reads); `stripe_admin_overview`,
`admin_list_requirements`, `admin_fees_and_billing` and
`admin_review_security` (the admin family); `admin_list_guided_settings`
(gate + payload mode only, per the coordinator ruling — its family is
D-12); and the shared gate `requireAdminAccount` itself.
`stripe_check_key_permissions` is the ninth census tool and is the
flagged leg: its read-side conversion is fully designed here but
deliberately not built, for the `src/db.js` reason below.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The frozen card names `account_get_capabilities` and `account_get_profile` | Neither exists. The registry's account reads are `account_list_capabilities` (`src/tools/account-capabilities.js`) and `account_get` (`src/tools/account-profile.js`) | **Naming/census drift, not a scope change** (the D-4/D-5/D-6 precedent): the family is the registry's tools; this card uses registry names throughout |
| The frozen card names a six-tool admin family: `stripe_admin_overview`, `stripe_admin_business_health`, `stripe_admin_attention_queue`, `stripe_admin_todos`, `stripe_admin_security_posture`, `stripe_admin_fees_and_billing` | Only `stripe_admin_overview` exists under that name. Business health is a **section** of the overview result; the attention queue is the overview's `attention` list and the todos are its `verificationReadiness` / `ownerWalkthrough` derivations; security posture is registered as `admin_review_security`; fees as `admin_fees_and_billing`. The registry's admin area is exactly six tools: those four plus `admin_list_requirements` and the two guided tools | **Census drift (fourth recorded species):** the admin "family" is one overview tool with derived sections, the requirements read, the fees read and the security review. `admin_list_requirements` shares the gate and module with the overview, and the frozen card's own drift table cited its payload lines (`admin-overview.js:65,100`) for conversion — it is converted with the family. The guided pair is dispositioned in row 6 |
| The family claims 1 census operation (`GET /v1/account`); admin subjects are local derived data | Confirmed in substance: the admin tools derive from the selected connection's composed readers and local state, not from separate census operations. The family's direct provider reads are `accounts.retrieve` (both account reads, requirements), `accounts.listCapabilities` and `balanceTransactions.list` (fees) | Recorded; no separate operations exist to convert, and none is invented |
| A12/A13 are two gate sites (`admin-read-safety.js`, `admin-security.js:26`) | A12 is the single shared helper `requireAdminTestAccount` in `admin-read-safety.js`, called from four modules; A13 is exactly `safeProbe`'s `v.mode!=='test'` re-validation in `admin-security.js` (line 26 as cited) | Both converted: the helper is mode-aware (below) and `safeProbe` now requires the probe result's mode to equal the connection mode |
| A14's probe block (`server.js`, refusal at :201, probe invoked with hardcoded `mode:'test'` at :210) | Confirmed at the cited block: the handler gate refuses non-TEST connections, invokes `services.stripePermissionReprobe` with `mode:'test'`, and labels its result `source:'Fresh TEST key read-only Stripe probes'`. The service (`src/keys.js` `createPermissionReprobe`) independently hard-requires `mode==='test'` | **FLAGGED, not converted** — see the flagged section. The card's probe conversion cannot complete inside this family: persisting a LIVE probe result requires `src/db.js` |
| The admin gate's conversion affects only this family's tools | `requireAdminTestAccount` is also called by `admin-guided.js` (`admin_list_guided_settings`, `admin_check_setting` — the later D-12 family), and `admin_list_guided_settings` hardcodes `mode:'test'` in its reply | **Coordinator ruling (2026-11-04, in writing):** converting the shared helper carries the guided tools' gate — acceptable and preferred over forking a TEST-pinned variant; no silent half-state, so (1) `admin_list_guided_settings`' payload mode reports the connection's actual mode in this build, (2) this card records that the guided native readers already follow the connection mode through the caller's ctx (they call the D-1/D-5-converted handlers), and (3) D-12 still owns the guided family's full conversion, its own suite and any remaining TEST-shaped text in `admin-guided.js`. Two note strings in `admin_check_setting` became outright falsehoods on the LIVE path this conversion opens ('Own-account TEST identity could not be independently confirmed', 'Native TEST data was observed…') and are minimally mode-parameterized here (TEST byte-identical), as the ruling directs; the guided descriptions (including `admin_check_setting`'s TEST-named one) and the remaining comment text stay D-12's |
| Unenumerated gates and TEST-hardcoded outputs (the hunt every family runs) | Found: (a) `verifiedTestAccountRecord`'s hardcoded `livemode===false`, shared by `account_get` and the requirements read; (b) mode-word text in the fees `validate()` refusal and `rowSafe` period refusal; (c) on the LIVE path the shared `modeClient` performs the verified account read **inside client acquisition**, so a provider 403 surfaces at `client(ctx)` — outside the 403 try in the fees and requirements handlers, whose TEST client never throws one | (a) Parameterized as `verifiedAccountRecord(value, expected, mode)`; the TEST specialization keeps its name and contract. (b) Mode-word substitution (TEST byte-identical). (c) Both handlers wrap client acquisition and the verified read in the existing 403 try — the same unreadable evidence; TEST behavior unchanged, pinned by the pre-existing suites. The hunt otherwise came up empty: no mode-shaped ID pattern exists in this family, and the overview's composed readers were all converted by earlier families (bank/schedule D-1, portal D-5, payment settings and Apple Pay domains already mode-aware, webhooks D-6), so every overview section follows the connection mode through the caller's ctx with no composite change |
| Baseline quirks ride along untouched | The overview composes sub-readers through `readAdminTool`, which swallows any reader error into an unobserved section; on a LIVE connection whose sub-reader cannot serve, the section reports `not_readable` rather than failing the overview | **Preserved** — it is the family's designed degradation and the reason an unconfigured LIVE fixture yields an all-`not_readable` overview in mode rather than an error |

## Per-site semantics (fitted to baseline evidence; the D-5 lesson)

- **Account record verification (`verifiedAccountRecord`, `accountSafe`):
  STRICT, parameterized.** The baseline required an explicit
  `livemode===false`; the mode form requires the boolean for the
  connection mode, so the TEST read set is unchanged. `accountSafe`'s
  new `mode` option defaults to `'test'`, so no-mode callers keep the
  historical contract exactly (V2 precedent).
- **Fees rows (`rowSafe`): DEFAULT (optional-mode) semantics** via
  `assertAccountResourceMode` — the baseline accepted a TEST row with
  `livemode` false **or absent** and refused only `livemode===true`,
  so a present livemode must equal the connection mode and an absent
  one still passes; the baseline TEST read set is unchanged (pinned
  by the absent-livemode fixture test, which passes at baseline).
- **Capabilities: account-level proof only.** Capability objects
  carry no `livemode`; the account is proven by the mode-matched
  verified reader before any capability projects (the D-1/D-2
  discipline).
- **Admin gate (`requireAdminAccount`):** connection mode ∈
  {test, live} plus the baseline account-ID shape; returns
  `{account, mode}`. The refusal substitutes the connection's mode
  word (generic 'TEST or LIVE' when no valid mode is selected), so a
  TEST refusal is byte-identical to the historical text and a LIVE
  refusal never claims only a TEST account qualifies.
- **Probe re-validation (`safeProbe`):** the probe result's `mode`
  must equal the connection mode (was: must equal `'test'`).

## Card-named behavior changes (the complete list)

1. **Payload `mode` fields report the connection's actual mode** —
   overview (summary and full), requirements (including the
   not-readable reply), fees (including the unreadable reply),
   security review, and the guided list (ruling item 1). At baseline
   these fields were provably wrong only for non-TEST connections,
   which were refused entirely, so no TEST output changes.
2. **The fees categorical refusal is replaced:** `rowSafe`'s
   'LIVE balance data is not allowed' is gone; wrong-mode balance
   data refuses with the standard 'Stripe provider resource mode
   mismatch' in both directions.
3. **Mode-word substitutions** in refusals and notes (admin gate,
   account_get gate and fallback note, capabilities gate / argument
   refusal / unreadable note, requirements verification-failure text
   and not-readable instructions, overview notes, fees validate /
   period / unreadable / owner-step texts, security probe and
   webhook notes, the two guided check-setting notes): every one
   substitutes the connection's mode word for the hardcoded TEST, so
   **each is byte-identical on a TEST connection** and truthful on a
   LIVE one.
4. **Existing-test updates (four files):** the shared-gate test in
   `admin-read-safety.test.js` and the LIVE legs of
   `admin-overview.test.js`, `admin-guided.test.js` and
   `admin-security.test.js` pinned the TEST-only gate this card
   abolishes; they now assert the post-conversion contract (LIVE
   answered in mode; an unconfigured LIVE fixture fails closed or
   degrades to `not_readable`, never a TEST payload). No assertion
   about TEST behavior changed.
5. **NOT landed (flagged):** the probe refusal-text correction. The
   card orders 'Only a configured TEST account…' corrected to name
   the real requirement; while the probe stays TEST-only (below)
   the existing text remains true, and the corrected text lands
   with the probe conversion itself.

## Flagged, not converted — `stripe_check_key_permissions`

The probe's read-side conversion is designed but **stopped for a
coordinator ruling**, under the family's standing instruction (stop
and flag rather than edit `src/db.js`):

- The handler (`src/tools/server.js`) and the service
  (`src/keys.js` `createPermissionReprobe`) hard-require TEST; both
  are parameterizable inside this family's surface, and the
  enrolled-key lookup already supports mode
  (`keyStore.loadKeySnapshot({account, mode})` is mode-aware and
  production-gated for LIVE; `db.getEncryptedKey` selects the mode's
  ciphertext column).
- **The blocker is persistence.** A probe run ends in
  `db.updateKeyPermissions({account, permissions, expectedCiphertext})`,
  and `src/db.js` implements it as `WHERE id = … AND test_key_enc =
  expectedCiphertext`, writing the **single shared**
  `key_permissions` / `key_checked_at` columns — the same columns
  `stripe_whoami` reports for whichever mode the connection is in.
  A LIVE snapshot's ciphertext can never match `test_key_enc`, so a
  threaded LIVE probe would probe the LIVE key and then fail (or,
  worse, a naive fix would overwrite the shared permissions with the
  other mode's results). Ruling needed on the intended semantics:
  mode-aware persistence against the mode's key column, per-mode
  permission columns, or a non-persisting LIVE probe.
- Until then the probe stays byte-identical at baseline, and this
  build holds that contract with pins: a TEST connection probes its
  TEST key; a LIVE connection refuses and the probe service is
  **never invoked** (no cross-mode fallback); a connection without
  the probe service refuses. `admin_review_security`'s probe
  section therefore reports `not_readable` on LIVE — honest
  degradation, pinned — and its `safeProbe` re-validation is already
  mode-aware, so the section lights up unchanged when the probe
  conversion lands.

## Budget

Dual-mode wording was fitted inside this family's own six converted
descriptions (account, capabilities, requirements, overview,
security, fees — each trimmed of filler as it gained 'or LIVE'); the
probe and guided descriptions are untouched. Everyday catalog:
**19,997 tokens against the 20,000 cap** — one under the 19,998
baseline reading; the cap did not move and no other family's text
was touched.

## Proof

New suite `tests/unit/cap4-d7-account-admin-reads.test.js`: 30
tests — **16 fail at the pristine baseline** `5ad33226` (every LIVE
happy path, both no-connection gate texts, the mode-named
unreadable notes, the fees standard-refusal text, the account
wrong-mode text, the guided LIVE pins and the descriptions) and
all 30 pass after. The 14 baseline passes are accounted: the TEST
byte/shape pins (account projection, capabilities shape, TEST
requirements, TEST overview summary, TEST fee sample, TEST security
review, TEST guided-list mode) — TEST was already fully served; the
`accountSafe` no-mode contract and the absent-livemode TEST fee row
(the fixture shape that forced default semantics); the capabilities
wrong-mode refusal, outcome-identical at baseline (gate refusal
before any provider call; verified-reader refusal after); and the
four flagged-probe pins, which hold the baseline contract of the
one leg this build deliberately does not convert. The four updated
pre-existing suites pass with their TEST assertions unchanged; the
remaining family suites (fees, capabilities, profile, key-reprobe,
server) pass unedited. Registry stays 329 tools (no tool added,
removed or renamed).

## CAP-5 obligation

Live proof for D-7 stands in the CAP-5 queue: `account_get`,
`account_list_capabilities`, `admin_list_requirements`,
`stripe_admin_overview`, `admin_fees_and_billing` and
`admin_review_security` reads on the owner's LIVE connection,
including the overview's section set and the fees sample. The
probe's LIVE row joins the same queue but additionally waits on
the flagged probe conversion above.

## What was NOT done

- The probe conversion (flagged above): `src/tools/server.js`,
  `src/keys.js` and `src/db.js` are byte-untouched in this build.
- The guided family's full conversion (descriptions, remaining
  TEST-shaped text, its own both-modes suite) — D-12's, per the
  coordinator ruling; only the gate consequence, the list payload
  mode and two falsehood notes were touched here.
- No account was enabled and no LIVE key was used; all LIVE
  evidence is fixture-based, as for every sibling family.
