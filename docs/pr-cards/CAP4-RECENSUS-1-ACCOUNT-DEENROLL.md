# CAP4-RECENSUS-1-ACCOUNT-DEENROLL — Enrolled-account de-enrollment (the missing delete leg)

Status: **FILED, not started.** Filed by the fleet completeness
re-census of 2026-11-04 (conformance row 15, re-opened and
re-issued under the RAS MCP Standard's capability-completeness
grading amendment, Library D-001, Library PR #5). This card is
the plan for a MISSING disposition in that re-census; the item
counts as missing until this card lands. It joins the CAP-4
sequence at the coordinator's direction; it is not part of the
frozen Phase 1 family order.

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
