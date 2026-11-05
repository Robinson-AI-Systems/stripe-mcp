# CAP4-RECENSUS-1-ACCOUNT-DEENROLL — Enrolled-account de-enrollment (the missing delete leg)

Status: **SOURCE COMPLETE (2026-11-04), pending merge and the
CAP-5 live proof below.** Filed by the fleet completeness
re-census of 2026-11-04 (conformance row 15, re-opened and
re-issued under the RAS MCP Standard's capability-completeness
grading amendment, Library D-001, Library PR #5). This card is
the plan for a MISSING disposition in that re-census; the item
counts as missing until this card lands. It joins the CAP-4
sequence at the coordinator's direction; it is not part of the
frozen Phase 1 family order.

## Outcome (2026-11-04, built from main `9daf3f38`)

The delete leg exists, in the ceremony shape this card froze:

- **Preparation (registry):** `stripe_deenroll_account`
  (registry 343 → 344; `profiles:['full']` like its siblings
  `stripe_create_pass` / `stripe_revoke_connection`, so the
  everyday catalog budget is untouched at 19,999/20,000). It
  evaluates the exact selected account through
  `db.getDeenrollEvaluation` and returns the confirmation
  payload — label, each credential's kind/last4 and presence,
  LIVE enabled/connected state, default state, the counts of
  live connector tokens and passes removal would revoke, the
  unsettled-reservation count, the guard blockers, and the
  selection consequence verbatim (a connection currently
  selecting the account loses its selection target). It
  creates and removes nothing.
- **Owner page ceremony:** `request-deenroll` →
  `confirm-deenroll` on the existing intent machinery
  (10-minute expiry; new table `owner_deenroll_intents`
  snapshots the evaluated state at request). The confirmation
  fingerprint (`deenrollFingerprint`, `DEEN-XXXXX-…`, in
  `src/tools/live-guard.js` beside `liveEnableFingerprint`)
  is computed fresh from the evaluated state — account id +
  label, credential kinds and last4s present, LIVE
  enabled/connected state, default-account state, counts of
  live tokens and passes, unsettled count, intent expiry —
  and re-checked at consumption: the page recomputes it from
  the current evaluation (a wrong or stale fingerprint is one
  refusal; the intent stays open showing the current facts,
  the live-enable pattern), and `consumeDeenrollIntent`
  re-checks the owner-confirmed expected state atomically in
  its single statement.
- **The removal, one statement:** every `oauth_tokens` row
  for the account (connector and pass kinds, every client —
  the connection-revoke machinery's effect composed
  per-client) is revoked; the account's dependent records
  are deleted (the schema's foreign keys to `stripe_accounts`
  require it: owner intent tables, money approvals and
  settled reservations, webhook intents/secrets/receipts,
  brand kits, app-scope and project-setup rows, meter claims,
  dev runs/forwarders and their children, auth codes,
  one-time secrets, the tax index, and the de-enrollment
  intents themselves, consumed by deletion); the
  `stripe_accounts` row — the stored key material with it —
  is deleted; and the removal is journaled in `change_log`
  (`stripe_deenroll_account`, the fingerprint and the revoked
  counts in the summary, **IRREVERSIBLE** stated, no inverse
  recorded — `stripe_undo_change` refuses it by its existing
  irreversible-action rule; the Postgres suite proves the
  undo claim gate returns false for the journal row).
- **Guards, as frozen:** request and consumption both refuse
  while LIVE is enabled (disable-LIVE first, through its own
  ceremony — untouched), while an unsettled money reservation
  exists (`reserved`/`uncertain`), and while the account is
  the recorded default (the default moves first, through its
  own ceremony — untouched). `src/tools/write.js` and
  `src/money.js` are byte-untouched; no money surface was
  needed — the reservation guard reads `money_reservations`
  state only.

Proof: `tests/unit/cap4-recensus1-deenroll.test.js` (12
tests: preparation payload and non-mutation, guard blockers,
page ceremony, wrong/stale fingerprint, full removal +
journal, expiry, double-consume) and
`tests/db/cap4-recensus1-deenroll.test.js` (5 tests:
per-guard request refusal, snapshot non-mutation, stale
expected-state atomic refusal, concurrent two-connection
consumption with FK-dependent cleanup and the undo-claim
refusal, expired intent). **Baseline accounting: all 17
tests fail at pristine baseline `9daf3f38` as
surface-missing; no by-design baseline passes.** Full unit
suite 226 files / 2,455 tests green; the db suite ran green
against a disposable local Postgres on this VM (the repo
launcher's binaries are absent here; exact-head CI carries
the db proof as usual). Two existing-suite census pins were
updated in this change and are flagged in the PR: the
setup-page form census (the new `request-deenroll` form is
a 13th owner group) and the registry/schema count pins
(343 → 344 tools; `owner_deenroll_intents` added to
`SCHEMA_TABLES`).

## CAP-5 obligation (verbatim from this card's plan)

CAP-5 obligation: live proof on the owner's own connection —
enroll a throwaway TEST account, de-enroll it, read back its
absence — queued with the family's other live proofs.

## The absence, as evidenced

The server's own enrollment records have no exit. An enrolled
Stripe account (`stripe_accounts`) is created by the owner setup
page actions `add-key` (TEST key) and `add-live-key` (LIVE key),
read by `stripe_list_accounts` / `stripe_whoami`, and updated by
re-enrollment upsert, `db.updateKeyPermissions`, and the
enable/disable-LIVE intent ceremonies. Nothing removes one:

- No `DELETE FROM stripe_accounts` exists anywhere in `src/` or
  `api/` (the codebase's only `DELETE FROM` statements target
  `oauth_codes`, `rtc_pass_rates`, `one_time_secrets`,
  `result_store` and `webhook_signing_secrets`).
- No key-removal write exists (no `*_key_enc = NULL` anywhere).
- The setup page's action list has no remove / de-enroll action.

Baseline: `main` `2688228fe8593ac7db36f7b43bfb94142d54eb9d`
(the re-census inventory's frozen head; the inventory's section 5
is the evidence record). An owner who enrolls the wrong account,
or retires one, can disable its LIVE state and revoke its tokens
but can never remove the account or its stored keys.

## Scope, as planned

A de-enrollment path built with this server's own ceremony
discipline (the owner-intent pattern and the V1/V4 precedents —
preparation on a tool surface creates nothing; completion happens
only on the passphrase-authenticated owner page):

1. **Preparation (registry):** a prepare-only tool in the
   `stripe_create_pass` / `stripe_revoke_connection` shape —
   it evaluates the exact account and returns the confirmation
   payload; it creates nothing and removes nothing.
2. **Owner page ceremony:** `request-deenroll` →
   `confirm-deenroll` intent pair (10-minute-class expiry, the
   existing intent machinery). The confirmation fingerprint is
   computed fresh from the evaluated state at request and
   re-checked atomically at consumption: account id and label,
   credential kinds and last4s present, LIVE enabled/connected
   state, default-account state, and the counts of live tokens
   and passes the removal will revoke.
3. **The removal itself, one transaction:** revoke every token
   for the account (connector and pass kinds — the existing
   revocation machinery), delete the stored key material, and
   delete the `stripe_accounts` row. Journal the removal in the
   change log with the fingerprint, in the journal's existing
   shape. De-enrollment is **irreversible** and must say so on
   the page and in the journal; `stripe_undo_change` refuses it
   by its existing irreversible-action rule — no undo is built.
4. **Guards (conservative defaults; the coordinator rules any
   change):** de-enrollment refuses while LIVE is enabled for
   the account (disable-LIVE first, through its own ceremony),
   while the account carries an unsettled money reservation,
   and while it is the recorded default account (the default
   must move first, through the existing default-account
   ceremony). A connection currently selecting the account
   loses its selection target; that consequence is stated in
   the confirmation payload, not discovered after.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| Enrollment is create/read/update only | Proven by the re-census inventory's full-source `DELETE FROM` sweep and the setup page's action list at `2688228f` | This card builds the delete leg; no existing leg is re-characterized |
| Token revocation can be reused for the account's tokens | The owner connection-revoke already revokes all tokens for one (account, client) pair and journals it | The removal composes that machinery per client, then deletes keys and row in the same transaction |
| De-enrollment is just a row delete | Keys, LIVE state, default state, reservations and selections all hang off the row | The guard set and the fingerprint's evaluated state exist precisely because it is not; each is named in the scope |

## Acceptance

- New suites prove: a confirmed de-enrollment removes the row
  and its key material; every token and pass for the account
  refuses afterwards; a wrong or stale fingerprint refuses and
  removes nothing; preparation (tool and request step) creates
  and removes nothing; each guard refuses in its stated state.
- Existing suites pass unedited, including the setup-page,
  owner-revoke and registry suites; `npm run check` exit 0
  (registry count changes only if the preparation tool is added,
  and then the census surfaces are updated in the same change,
  as sibling cards do).
- Row 15's missing-with-plan register is updated in the same
  change that lands this card (the item stops counting as
  missing only when the leg exists at a merged head).
- CAP-5 obligation: live proof on the owner's own connection —
  enroll a throwaway TEST account, de-enroll it, read back its
  absence — queued with the family's other live proofs.

## What is NOT in this card

- No change to the disable-LIVE, default-account or money-limit
  ceremonies; they are inputs to the guards, not rebuilt here.
- No bulk or multi-account removal; one account per ceremony.
- OAuth client removal is the sibling card
  CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE.
- No deployment, no LIVE enablement, and no real account is
  de-enrolled by the building of this card; all evidence is
  fixture-based until the CAP-5 proof.
