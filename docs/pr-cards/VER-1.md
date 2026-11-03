# VER-1 — Release provenance, front door and fleet health (RAS MCP Standard)

Owner-directed implementation of the release-identity workstream from the
2026-11-02 RAS MCP Standard conformance pass
([RAS-MCP-CONFORMANCE](../RAS-MCP-CONFORMANCE.md) rows 5, 6, 8 and 9;
Library D-001 VER-1, identity anchoring, branded front door and Stage-1
health contract). Chris's direction (main chat, 2026-11-02): after the
plan conformance landed (PR #292), implementation begins; this card is
the RELEASE-IDENTITY workstream only. The connection contract
(CAP-3/CAP-5) and the developer access boundary are separate workstreams
on their own branches; this card does not edit the connect/consent or
developer surfaces.

## Drift check
- Follows [DRIFT-PROTOCOL](../implementation-contracts/DRIFT-PROTOCOL.md):
  checklist A run before this PR; the index and this card are updated as
  if merged; STATUS records implementation and live acceptance as
  separate ledgers.
- One checked release source, `src/release.js`: the installed package
  version from `package.json`, and the deployed commit only from
  verified build-time deployment metadata (`VERCEL_GIT_COMMIT_SHA`).
  Never `main` HEAD, request data, a guessed tag or the last CI run;
  an unknown commit is reported as unknown, never synthesised.
- Reuses the existing one-source origin rule (`publicOrigin` /
  `PUBLIC_BASE_URL`) for identity anchoring; no issuer logic is copied
  from another fleet server, and no origin is ever derived from a
  request Host header.
- No `PUBLIC_BASE_URL`, DNS, domain-attachment or deployment change in
  this card: the branded cutover stays behind the gates in
  [STRIPE-BRAND-DOMAIN](../designs/STRIPE-BRAND-DOMAIN.md) and is
  recorded as owed live work, not performed here.

## What is built (source)
- `initialize` `serverInfo.version`, `stripe_whoami`'s `server_release`
  (`version`, `commit` or `null`, `source`, `what_changed` naming the
  checked daily `main` → `live` promotion and the `live` branch
  history), the RTC manifest `version` + `revision`, `/health` and the
  front door all resolve from `src/release.js` and therefore agree.
- Fleet Stage-1 health: `GET /api/health` (also `/health`) returns the
  pinned shape — `status` (`ok`/`degraded`), `version`, `commit`,
  `tools`, `timestamp` — 200 when healthy, 503 when the checked store
  dependency is degraded; the check is a bounded `select 1` that can
  genuinely fail; no credentials, user data, hostnames or configuration
  values (booleans at most). The RTC manifest advertises the health
  path (RTC 2 ruling D4).
- Front door at `/` renders the public name **Stripe Unleashed by
  Robinson AI Systems**, the release identity, store posture, tool
  counts and the fleet disclaimer from live state — no hardcoded
  version or status.
- Identity anchoring proof: a unit test fetches the OAuth discovery
  documents with a platform-alias Host and verifies every issuer
  surface still names the one configured origin.

## Acceptance split (implementation ≠ live proof)
- **Source/unit (this PR):** the CAP-5 VER-1 agreement check runs as a
  no-provider-calls unit test — a real in-memory `initialize` handshake,
  `stripe_whoami` against the fake DB, the manifest, the health readout
  and handler, and the front door must all report one checked release;
  the unknown-SHA case must state unknown on every surface.
- **Live (owed, not claimed):** after the scheduled `main` → `live`
  promotion serves this build, re-read `initialize`, `stripe_whoami`,
  `/api/contract` and `/api/health` at the deployed SHA and confirm
  they agree with the checked release; the conformance rows close only
  on that evidence. The branded-origin cutover (domain attachment,
  `PUBLIC_BASE_URL` change, re-proof) remains a separate ruled step
  through the STRIPE-BRAND-DOMAIN gates.

## Resume note
Implementation complete in source on branch
`ai/vivienne/ver1-release-provenance`. Remaining: exact-head CI, merge,
then the owed live re-read after the next daily promotion.
