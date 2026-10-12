// Browser OAuth/MCP clients use explicit bearer tokens, never cookie credentials.
// Never call this at the owner authorization page or at private setup routes.
export function allowBrowserProtocol(req, res, { methods = ['GET'], mcp = false } = {}) {
  if (typeof req?.headers?.origin !== 'string' || !req.headers.origin) return false;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
  res.setHeader('Access-Control-Allow-Headers', mcp
    ? 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id'
    : 'authorization, content-type');
  res.setHeader('Access-Control-Expose-Headers', mcp
    ? 'www-authenticate, mcp-session-id' : 'www-authenticate');
  res.setHeader('Access-Control-Max-Age', '600');
  // No Access-Control-Allow-Credentials: we do not use cookies or browser ambient auth.
  if (req.method !== 'OPTIONS') return false;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', [...methods, 'OPTIONS'].join(', '));
  res.status(204).end();
  return true;
}
