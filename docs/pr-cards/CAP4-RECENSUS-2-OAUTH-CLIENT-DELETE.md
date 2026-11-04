# CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE — OAuth client management: the missing update/delete legs

Status: **FILED, not started.** Filed by the fleet completeness
re-census of 2026-11-04 (conformance row 15, re-opened and
re-issued under the RAS MCP Standard's capability-completeness
grading amendment, Library D-001, Library PR #5). This card is
the plan for a MISSING disposition in that re-census; the item
counts as missing until this card lands. It joins the CAP-4
sequence at the coordinator's direction; it is not part of the
frozen Phase 1 family order.

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
