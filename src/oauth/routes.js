// Stripe MCP composition boundary: reusable core handlers are dependency injected.
import { createDb } from '../db.js';
import { createOAuthHandlers } from '../core/oauth-handlers.js';
import { allowBrowserProtocol } from '../core/browser-cors.js';
import { incomingBodyWithinLimit, send } from '../core/http.js';

export async function handleOAuth(which, req, res) {
  try {
    // Browser clients may discover/register/exchange through CORS; never enable
    // cross-origin AJAX on the owner passphrase authorization form.
    if (which !== 'authorize' && allowBrowserProtocol(req, res,
      { methods: ['metadata','resourceMetadata'].includes(which) ? ['GET'] : ['POST'] })) return;
    if (!incomingBodyWithinLimit(req)) {
      return send(res, 413, { error: 'invalid_request',
        error_description: 'Request body exceeds the 16 KiB transport limit or has no verifiable size' });
    }
    const db = createDb();
    await db.initSchema();
    return await createOAuthHandlers({ db })[which](req, res);
  } catch {
    // Never send SQL statements, tokens, passphrase or other internal error details.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'temporarily_unavailable',
      error_description: 'Stripe MCP is not configured or its database is unavailable' });
  }
}
