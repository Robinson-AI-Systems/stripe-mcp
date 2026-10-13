import { createDb } from '../../src/db.js';
import {incomingBodyWithinLimit,only,send} from '../../src/core/http.js';
import {createSchemaOnce} from '../../src/core/schema-once.js';
import { createKeyStore } from '../../src/keys.js';
import { createOneTimeStore } from '../../src/core/one-time-secrets.js';
import { createSetupHandler } from '../../src/stripe/setup-page.js';
import { createReportDownloader } from '../../src/stripe/report-download.js';
import { createWebhookSignatureStore, createOwnerWebhookProvisioner } from '../../src/webhooks/signature-store.js';
import { makeStripeClient } from '../../src/stripe/client.js';
import {createOwnerSmokeRunner} from '../../src/acceptance/owner-smoke-runner.js';
import {createReadOnlyTestPassIssuer} from '../../src/core/rtc-passes.js';
import {registry} from '../../src/tools/index.js';

// A serverless isolate shares one schema gate across its warm requests.
// Fresh deployments/isolate cold starts still perform the complete additive schema init.
const ensureSchema=createSchemaOnce();

export default async function handler(req, res) {
  // Preflight the original HTTP request before starting Neon/schema work.
  if(!only(res,req,['GET','POST']))return;
  if(!incomingBodyWithinLimit(req))
    return send(res,413,{error:'invalid_owner_request',description:'Owner form body length invalid or oversized'});
  if(req.method==='POST'){
    const type=String(req.headers?.['content-type']||'').split(';')[0].trim().toLowerCase();
    if(!['application/x-www-form-urlencoded','application/json'].includes(type))
      return send(res,415,{error:'unsupported_content_type'});
  }
  try {
    const db = createDb();
    await ensureSchema(()=>db.initSchema());
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
    // No provider errors, encrypted keys or account IDs enter the browser.
    const runTestSmoke=configured?createOwnerSmokeRunner({db,keyStore}):null;
    return await createSetupHandler({ db, keyStore, oneTimeStore,provisionWebhookSecret,forgetWebhookSecret,
      runTestSmoke,
      lookupTestReceipt:configured?async({account,endpoint,eventId})=>{
        // Never expose a raw event: only scoped TEST signature-receipt metadata.
        const selected=await db.getStripeAccount(account);
        if(!selected?.test_connected||selected.live_enabled===true)return null;
        return db.getTestWebhookReceipt({account,endpoint,eventId});
      }:null,
      issueRtcPass:configured?createReadOnlyTestPassIssuer({db,oneTimeStore,
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
