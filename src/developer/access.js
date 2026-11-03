// DeveloperAccess — the fleet developer access boundary resolver.
// Library D-001 (fleet developer access boundary) and
// docs/RAS-MCP-CONFORMANCE.md row 4 are the governing contract.
//
// Three identity contexts exist and never silently merge:
//   customer  — grants from the public sign-in/consent journey;
//   developer — grants minted through the operator developer connection
//               (api/developer/connect), for TEST contexts and fixtures
//               only: never LIVE customer authority, never LIVE
//               acceptance evidence;
//   operator  — the owner acting through the passphrase-gated setup and
//               consent surfaces. Operator is a browser session context,
//               never a bearer grant, so it is never resolved here.
//
// A grant's context is derived ONLY from server-side records: the context
// stamped on the grant at issuance, or the registered client the grant was
// issued to. Caller input — a mode, header, tool argument or role
// parameter — never proves or changes context. Developer determination is
// sticky (either server-side proof suffices, so a developer client can
// never launder its grants into customer context), and there is no
// public-user fallback that can raise a customer grant to developer.
import { callbackPath } from './handoff.js';

export const DEVELOPER_CALLBACK_PATH = callbackPath;
export const GRANT_CONTEXT_CUSTOMER = 'customer';
export const GRANT_CONTEXT_DEVELOPER = 'developer';
export const GRANT_CONTEXTS = Object.freeze([GRANT_CONTEXT_CUSTOMER, GRANT_CONTEXT_DEVELOPER]);

// A client is a developer client when its registered redirects include this
// service's own developer handoff callback — the same registration rule the
// handoff endpoint enforces before it will start a connection.
export function isDeveloperClient(client, origin) {
  return Array.isArray(client?.redirect_uris) &&
    client.redirect_uris.includes(origin + DEVELOPER_CALLBACK_PATH);
}

// Context of an authorization code at token issuance. The handoff builds
// its authorization request with this service's developer callback as the
// exact redirect URI, and that callback is verified against the code
// record before any sealed code is released, so an exact match here is
// server-proven, not caller-claimed.
export function contextForAuthorizationCode({ redirectUri, origin }) {
  return redirectUri === origin + DEVELOPER_CALLBACK_PATH
    ? GRANT_CONTEXT_DEVELOPER : GRANT_CONTEXT_CUSTOMER;
}

// Resolve the context of a stored grant record. Grants minted before
// context typing carry no stamp; theirs is derived from the registered
// client they were issued to (derived at read time, never written back
// from caller input).
export function resolveGrantContext({ record, client, origin }) {
  if (record?.context === GRANT_CONTEXT_DEVELOPER) return GRANT_CONTEXT_DEVELOPER;
  if (isDeveloperClient(client, origin)) return GRANT_CONTEXT_DEVELOPER;
  return GRANT_CONTEXT_CUSTOMER;
}

// The boundary itself: developer-context grants are confined to TEST.
// Public LIVE customer operations always require a customer context.
export function contextMayOperate({ context, mode }) {
  return context !== GRANT_CONTEXT_DEVELOPER || mode === 'test';
}

// Boundary refusals are journaled without secrets (surface, context, mode,
// reason code, client id — never a token, code or credential). Journaling
// is evidence, not enforcement: its failure must never change an outcome.
export async function journalBoundaryEvent(db, event) {
  try {
    if (typeof db?.recordDeveloperBoundaryEvent === 'function') {
      await db.recordDeveloperBoundaryEvent(event);
    }
  } catch { /* the refusal stands whether or not the journal write lands */ }
}
