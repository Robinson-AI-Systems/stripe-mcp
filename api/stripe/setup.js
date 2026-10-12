import { createDb } from '../../src/db.js';
import { createKeyStore } from '../../src/keys.js';
import { createOneTimeStore } from '../../src/core/one-time-secrets.js';
import { createSetupHandler } from '../../src/stripe/setup-page.js';
import { createReportDownloader } from '../../src/stripe/report-download.js';
import { createWebhookSignatureStore, createOwnerWebhookProvisioner } from '../../src/webhooks/signature-store.js';
import { makeStripeClient } from '../../src/stripe/client.js';
import { runOwnerTestSmoke } from '../../src/acceptance/owner-test-smoke.js';
import {createReadOnlyTestPassIssuer} from '../../src/core/rtc-passes.js';
import {registry} from '../../src/tools/index.js';

export default async function handler(req, res) {
  try {
    const db = createDb();
    await db.initSchema();
    // On GET there is no need to read the encryption secret; missing configuration
    // prevents key storage/reveal but never leaks a plaintext alternative.
    const configured = req.method === 'POST';
    const keyStore = configured ? createKeyStore({ db }) : null;
    const oneTimeStore = configured ? createOneTimeStore({ db }) : null;
    const provisionWebhookSecret=configured?createOwnerWebhookProvisioner({db,keyStore,
      makeClient:makeStripeClient,store:createWebhookSignatureStore({db})}):null;
    const forgetWebhookSecret=configured?async({account,endpoint})=>{
      const row=await db.getStripeAccount(account);
      if(!row)return false;
      return createWebhookSignatureStore({db}).remove({account,endpoint});
    }:null;
    // This owner-authenticated form alone may invoke the standard server key
    // loader. Raw credentials never enter the browser, AI connector or report.
    const runTestSmoke=configured?async({account,focus})=>{
      const selected=await db.getStripeAccount(account);
      if(!selected?.test_connected)throw new Error('No encrypted TEST key for selected account');
      const key=await keyStore.loadKey({account,mode:'test'});
      return runOwnerTestSmoke({account,key,focus});
    }:null;
    return await createSetupHandler({ db, keyStore, oneTimeStore,provisionWebhookSecret,forgetWebhookSecret,
      runTestSmoke,issueRtcPass:configured?createReadOnlyTestPassIssuer({db,oneTimeStore,
        availableAreas:[...new Set(registry.tools.filter(t=>t.writes===false&&
          t.money!==true&&t.destructive!==true&&
          t.profiles?.includes('read_only')).map(t=>t.area??'server'))]}):null,
      reportDownload:configured?createReportDownloader({db,keyStore}):null })(req, res);
  } catch {
    if (!res.headersSent) return res.status(503).json({
      error: 'temporarily_unavailable', description: 'Configure the private Stripe MCP server before setup'
    });
  }
}
