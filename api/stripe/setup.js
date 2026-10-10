import { createDb } from '../../src/db.js';
import { createKeyStore } from '../../src/keys.js';
import { createOneTimeStore } from '../../src/core/one-time-secrets.js';
import { createSetupHandler } from '../../src/stripe/setup-page.js';

export default async function handler(req, res) {
  try {
    const db = createDb();
    await db.initSchema();
    // On GET there is no need to read the encryption secret; missing configuration
    // prevents key storage/reveal but never leaks a plaintext alternative.
    const configured = req.method === 'POST';
    const keyStore = configured ? createKeyStore({ db }) : null;
    const oneTimeStore = configured ? createOneTimeStore({ db }) : null;
    return await createSetupHandler({ db, keyStore, oneTimeStore })(req, res);
  } catch {
    if (!res.headersSent) return res.status(503).json({
      error: 'temporarily_unavailable', description: 'Configure the private Stripe MCP server before setup'
    });
  }
}
