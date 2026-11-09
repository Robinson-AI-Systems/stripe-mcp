# MUSE-1 — Muse sign-in (RAS MCP Standard D-006)

**Commissioned:** 2026-11-09 by the owner. Every custom MCP server connects
Muse the same way: the Client ID people type is `muse`, and the server's own
Muse document address also works. The fleet design is D-006 in the Library
(`designs/ras-mcp-muse-connection.md`).

## Live finding (2026-11-09)

`/.well-known/muse-client.json` and `/.well-known/oauth-protected-resource/api/mcp`
answered 404. A Muse authorize with the document address, or with `muse`,
was refused "Unknown client or redirect address".

## Scope (D-006 MC-1, MC-2, MC-8)

- Serve both documents (rack routes and `vercel.json` in parity).
- Answer `muse` and the own document address locally, as one built-in public
  client, at every door through `resolveClient`.
- MC-3 (visiting cards), MC-4 (optional resource) and the MCP door already
  conformed.

## Acceptance

- `tests/unit/muse-own-document.test.js` passes and fails without the fix.
  `npm run check` and the full suite pass at the exact head.
- Live (after release): the D-006 §7 knock probe, then a real Muse connect
  with Client ID `muse`.
