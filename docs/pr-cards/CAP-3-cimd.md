# CAP-3 continuation — client ID cards (CIMD) and the one-sign-in consent journey

Original CAP-3 remains **IN_PROGRESS**. Baseline main
`04d2fdf9635b7c6a4871a7067431101b85c571e8`; merged PRs #289/#290 built
the inactive tenancy store and encrypted vault, and PR #292 recorded
the RAS MCP Standard conformance plan (Library D-001 at `063eeff2`).
This packet implements the conformance record's connection rows 2 and
3 inside the same original CAP-3 — it is not a new roadmap unit, and
it completes **zero** CAP-3 subsections: provider-backed human OIDC,
Stripe App installation and live client acceptance remain open.

## Drift check

- Reuse the existing owner OAuth surface (`src/core/oauth-handlers.js`,
  `src/core/oauth.js`, `src/db.js` client store) — the connection this
  packet governs is the server's current public sign-in. No new
  database table, no migration, no change to stored client rows,
  token records, money-out approvals or the $500/day guard.
- Reference pattern for card validation is PenPal's
  `resolveCimdClient` (live 2026-11-01), adopted as a pattern, not
  copied: this server's resolver adds the Standard's full SSRF bound
  (DNS answers classified public-only before fetch, same-host bounded
  redirects) and requires a client name, per D-001.
- The fleet developer connection and all developer surfaces are a
  separate workstream's boundary (conformance row 4); untouched here.
  Release identity (VER-1, row 5) and the front door (row 8) are also
  other workstreams; untouched here.

## Frozen complete packet outcome
<!-- bundle-plan:start -->
```json
{
  "baseRevision": "04d2fdf9635b7c6a4871a7067431101b85c571e8",
  "workKind": "ENGINEERING",
  "outcome": "Make client ID-card (CIMD) clients a first-class identification shape of the existing OAuth connection, and correct the consent journey to the one-public-sign-in contract: no profile choice on the connect journey, the screen displays the resulting effective access, and new connections default to the fullest grant.",
  "integrationBoundary": "Existing OAuth authorize/token/revoke handlers and discovery metadata only, plus connection documentation. No tenancy enrollment, no OIDC provider, no Stripe App installation, no LIVE change, no front-door or release-identity surface.",
  "newEngineering": "Add an SSRF-bounded CIMD card resolver (HTTPS-only fetch, public-only DNS classification, same-host bounded redirects, time/size caps, secret-holding and malformed cards refused, fail-closed) wired into authorize/token/revoke client resolution alongside dynamic registration; add the loopback port-relaxed redirect matcher for card clients; advertise client_id_metadata_document_supported; remove profile/listing choices from the consent page and display the resulting effective access with full as the default grant; deliver per-client setup snippets as CAP-3 connection material; unit and handler tests for every negative card case and the full card authorize/token flow.",
  "estimatedProductionLines": 360,
  "relatedWorkDecision": "One coherent safety-critical packet inside CAP-3 (the CAP-3-vault single-packet precedent). Below the 400-line guide average because the surface is authentication: it is kept deliberately small and reviewable rather than padded with the dependency-gated OIDC/Stripe App engineering that remains CAP-3's open remainder. CAP-5's live knock test for the card path is recorded as owed against the checked deployed release; it cannot pass from source and is not claimed here.",
  "subsections": [
    {
      "id": "CAP-3",
      "acceptance": [
        "Verified human identities and tenant memberships must be distinct from a Stripe account authorization; operator, production customer, product administrator and developer roles require explicit, current server-checked memberships.",
        "Typed Stripe account/Connect/organization grants must bind tenant, stable person, verified provider account, mode, issuer/resource, permission revision and credential kind, with no cross-tenant credential or operation fallback.",
        "Grant enrollment, ownership changes, revocation, replacement, expiry and concurrent use must be atomic and fail closed, without exposing provider bearer secrets or authorizing provider I/O based on metadata alone.",
        "Legacy owner-managed accounts/OAuth connections must remain compatible but unassigned; ownership migration requires independently proven owner identity, and ambiguous credentials must never become customer grants.",
        "Use disposable real PostgreSQL tests for independent identities, two tenants, same person different roles, foreign account/mode, stale membership, concurrent revocation, and negative provider-authority assumptions; keep signed-in independent money-out approval and LIVE safeguards unchanged."
      ],
      "remainingEngineering": [
        "Implement provider-backed human sign-in through a maintained OIDC verifier, with verified issuer/subject and PKCE/state/nonce, before calling identity-enrollment internals.",
        "Implement one-screen branded Stripe App account consent and automatic mobile client return using registered Stripe App OAuth grant and independent identity.",
        "Build encrypted tenant-bound credential lifecycle, real policy-based resolver, original OAuth connector migration and Full/God Mode upgrades with actual operation scope evidence.",
        "Prove every direct, RTC, indirect and HTTP door with real PostgreSQL/independent provider and client acceptance, without changing signed-in money-out policy.",
        "CAP-5 live knock test for the card path against the checked deployed release carrying this packet's code (status until then: FIXED IN SOURCE / NOT VERIFIED LIVE)."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Acceptance for this packet

- Card validation follows D-001 exactly: fetch over HTTPS from the
  exact `client_id` URL; the card's declared address equals the
  fetched URL; a client name is present; every redirect address used
  is printed on the card (loopback port relaxation preserved for
  native clients, never generalized); secret-holding cards refused;
  SSRF-bounded fetch (HTTPS only, no private/link-local/reserved
  targets — including via DNS answers — bounded redirects, time and
  size caps).
- Negative tests all fail closed without issuing credentials: unknown
  card host, fetched-address mismatch, redirect not on the card,
  secret-holding card, private-network card URL (literal and via
  DNS), oversized card, slow/failing card fetch.
- Dynamic registration is unchanged: stored clients resolve first and
  keep exact redirect matching and their existing auth methods.
- Consent journey: the authorize page renders no profile or listing
  choice; it displays the resulting effective access (account, mode,
  grant, and any read-only tightening set on the connection). A
  connection created without a profile setting defaults to `full`.
  Existing LIVE gates are unchanged: LIVE requires an activated
  account, production service and the separate write consent, and a
  read-only connection can never take LIVE write consent.
- Discovery metadata advertises `client_id_metadata_document_supported`.
- CAP-5 knock test: **owed, not run.** Card support is claimed only
  when a real card client connects against the checked deployed
  release; until then the status is `FIXED IN SOURCE / NOT VERIFIED
  LIVE` (conformance row 2).
