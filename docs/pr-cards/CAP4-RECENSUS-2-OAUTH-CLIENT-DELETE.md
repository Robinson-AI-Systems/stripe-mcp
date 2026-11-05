# CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE — OAuth client management: the missing update/delete legs

Status: **SOURCE COMPLETE (2026-11-04), pending merge and the
CAP-5 live proof below.** Filed by the fleet completeness
re-census of 2026-11-04 (conformance row 15, re-opened and
re-issued under the RAS MCP Standard's capability-completeness
grading amendment, Library D-001, Library PR #5). This card is
the plan for a MISSING disposition in that re-census; the item
counts as missing until this card lands. It joins the CAP-4
sequence at the coordinator's direction; it is not part of the
frozen Phase 1 family order.

## Outcome (2026-11-04, built from main `a894b262`)

The delete leg and the owner visibility exist, in the ceremony
shape this card froze (the CAP4-RECENSUS-1 sibling pattern):

- **Visibility (owner page only; no registry tool — the registry
  stands at 344):** the owner setup page gains a
  `list-oauth-clients` action and a Registered OAuth clients
  group. After the passphrase gate, the page lists every
  registered client — client id, client name, token-endpoint
  auth method, registration timestamp, and the LIVE (unrevoked)
  connector-token and pass counts a deletion would revoke —
  read from the existing store (`db.listOAuthClients`). Safe
  fields only: no client secret or secret hash is ever read or
  shown, and malformed inventory rows refuse the whole list
  rather than printing unverified records.
- **Delete ceremony:** `request-delete-client` →
  `confirm-delete-client` intent pair on the existing intent
  machinery (10-minute expiry; new table
  `owner_delete_client_intents` snapshots the evaluated state
  at request — `db.getDeleteClientEvaluation` is the single
  evaluated shape). The confirmation fingerprint
  (`deleteClientFingerprint`, `DELC-XXXXX-…`, in
  `src/tools/live-guard.js` beside `deenrollFingerprint`) is
  computed fresh from the evaluated state — client id, name,
  auth method, and the exact counts of tokens and passes the
  deletion will revoke, plus intent expiry — and re-checked at
  consumption: the page recomputes it from the current
  evaluation (a wrong or stale fingerprint is one refusal; the
  intent stays open showing the current facts, the live-enable
  pattern), and `consumeDeleteClientIntent` re-checks the
  owner-confirmed expected state atomically in its single
  statement.
- **The deletion, one statement:** every `oauth_tokens` row
  issued to the client (connector and pass kinds, every
  account — the revocation machinery's effect composed across
  accounts) is revoked; the client's outstanding
  `oauth_codes` are deleted; its delete intents are consumed
  by deletion; the `oauth_clients` row is deleted; and the
  deletion is journaled in `change_log`
  (`stripe_delete_oauth_client`, the fingerprint and the
  revoked counts in the summary, **IRREVERSIBLE** stated, no
  inverse recorded and no owning account — `stripe_undo_change`
  refuses it by its existing irreversible-action rule; the
  Postgres suite proves the undo candidate read finds nothing
  and the claim gate returns false for the journal row).
  Authorization attempts naming the deleted client refuse
  (proven at both OAuth doors in the unit suite: the consent
  page answers 400 and the token endpoint refuses
  `invalid_client` with the once-correct secret).
- **Update leg — RECORDED DEFERRAL (disposition, not build):**
  as this card planned, the update leg is deliberately
  deferred with its reason: no consumer has needed to edit a
  registration; name/auth-method changes are served by
  delete-and-re-register now that the delete leg exists; an
  RFC 7592 read/update endpoint is its own future card if a
  consumer arises. The re-census disposition for the update
  leg moves from MISSING to this recorded deferral in this
  change. No RFC 7592 endpoint is built.

Proof: `tests/unit/cap4-recensus2-client-delete.test.js` (13
tests: list truthfulness and non-disclosure, request
non-mutation, forged origin/CSRF/passphrase/consent refusals,
wrong and stale fingerprints, full deletion + journal, pass
revocation, expiry, double-consume, and post-deletion refusal
at both OAuth doors) and
`tests/db/cap4-recensus2-client-delete.test.js` (6 tests:
truthful counts, snapshot non-mutation, stale expected-state
atomic refusal, concurrent two-connection consumption with
code/intent cleanup and the undo-gate refusal, pass-client
deletion, expired intent). **Baseline accounting: 12 of the
13 unit tests fail at pristine baseline `a894b262` as
surface-missing; the one baseline pass is named in the suite
(the wrong-passphrase list refusal — the shared owner login
gate's pre-existing behavior, unchanged by this card). All 6
Postgres tests fail at baseline as surface-missing.** Full
unit suite 222 files / 2,489 tests green; the Postgres suite
also ran green against a disposable local Postgres on this
VM (the repo launcher's binaries are absent here; exact-head
CI carries the db proof as usual). Two existing-suite census
pins were updated in this change and are flagged in the PR:
the setup-page form census (the new Registered OAuth clients
group is a 14th owner group, adding the `list-oauth-clients`
and `request-delete-client` actions) and the schema pin
(`owner_delete_client_intents` added to `SCHEMA_TABLES`).
The registry is unchanged at 344 tools and
`src/tools/write.js` / `src/money.js` are byte-untouched.

## CAP-5 obligation (verbatim from this card's plan)

CAP-5 obligation: live proof on the owner's own connection —
register a throwaway client, delete it through the ceremony,
read back its absence — queued with the family's other live
proofs.

## The absence, as evidenced

OAuth clients register dynamically
(`src/oauth/register-route.js` → `db.createOAuthClient`;
`client_secret_post` / `client_secret_basic` / `none`) and are
read internally (`db.getOAuthClient`). That is the whole
lifecycle:

- No update leg exists — a registered client cannot be edited
  through any surface.
- No delete leg exists — no client-management (RFC 7592-style)
  endpoint and no data-layer function removes a client.
- No owner-facing surface lists the registered clients at all;
  the only visibility is indirect, through connection metadata
  for a selected account.

Baseline: `main` `2688228fe8593ac7db36f7b43bfb94142d54eb9d`
(the re-census inventory's frozen head; the inventory's section 5
is the evidence record). Tokens for a client can be revoked pair
by pair, but the client record itself is permanent: a client
registered by mistake, by a probe, or by a retired integration
can never be removed.

## Scope, as planned

Owner-surface client management, in this server's established
pattern (owner page ceremonies; tools prepare, the owner page
completes — the V4 precedent):

1. **Visibility:** the owner setup page lists registered
   clients — client id, client name, auth method, created
   timestamp, and live token/pass counts — read from the
   existing store. No registry tool is required for the list;
   if the coordinator wants one, it is a read in the `admin`
   area's masked style and is named here as optional, not
   assumed.
2. **Delete ceremony:** `request-delete-client` →
   `confirm-delete-client` intent pair (existing intent
   machinery, 10-minute-class expiry). The confirmation
   fingerprint is computed fresh from the evaluated state:
   client id, name, auth method, and the exact counts of tokens
   and passes the deletion will revoke.
3. **The deletion itself, one transaction:** revoke every
   token issued to the client (the existing revocation
   machinery), then delete the `oauth_clients` row, and journal
   the deletion in the change log with the fingerprint.
   Deletion is **irreversible** and says so on the page; no
   undo is built.
4. **Update leg — disposition, not silence:** this card records
   the update leg as deliberately deferred with a reason: no
   consumer has needed to edit a registration (name/auth-method
   changes are served by delete-and-re-register once the delete
   leg exists). If a consumer arises, an RFC 7592 read/update
   endpoint is its own card. The re-census disposition for the
   update leg updates from MISSING to this recorded deferral
   when this card lands.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| Clients are create/read(internal) only | Proven by the re-census inventory's read of the register route, OAuth handlers and data layer at `2688228f` | This card builds the delete leg and the owner visibility; the update leg is dispositioned, not silently dropped |
| Deleting a client orphans its tokens | The token store keys tokens to clients and the revocation machinery already revokes per (account, client) pair | Deletion revokes the client's tokens first, in the same transaction; a token whose client is gone must refuse, and the suites prove it |
| An RFC 7592 endpoint is the obvious route | This server's established pattern completes destructive registration changes on the owner page (pass/revoke preparation, V4) | Owner page is the default route; a 7592 endpoint is named as future work with its own card, not smuggled into this one |

## Acceptance

- New suites prove: a confirmed deletion removes the client
  row; every token and pass issued to the client refuses
  afterwards; authorization attempts naming the deleted client
  refuse; a wrong or stale fingerprint refuses and removes
  nothing; the request step creates and removes nothing; the
  owner-page list shows a seeded client with truthful counts.
- Existing suites pass unedited, including the OAuth,
  owner-revoke and registry suites; `npm run check` exit 0.
- Row 15's missing-with-plan register is updated in the same
  change that lands this card.
- CAP-5 obligation: live proof on the owner's own connection —
  register a throwaway client, delete it through the ceremony,
  read back its absence — queued with the family's other live
  proofs.

## What is NOT in this card

- Enrolled-account removal is the sibling card
  CAP4-RECENSUS-1-ACCOUNT-DEENROLL.
- No RFC 7592 endpoint is built here (see the update-leg
  disposition above).
- Token and pass revocation themselves are unchanged; this
  card composes them.
- No real client is deleted by the building of this card; all
  evidence is fixture-based until the CAP-5 proof.
