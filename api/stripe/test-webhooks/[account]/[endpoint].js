// Isolated TEST receiver. Its only public authorization is a valid Stripe HMAC.
// Vercel must route raw request bytes; it is NOT an OAuth/owner setup endpoint.
import {createDb} from '../../../../src/db.js';
import {createWebhookSignatureStore} from '../../../../src/webhooks/signature-store.js';
import {makeTestWebhookReceiver} from '../../../../src/webhooks/test-receiver.js';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  try{
    const db=createDb();
    await db.initSchema();
    const signatureStore=createWebhookSignatureStore({db});
    return await makeTestWebhookReceiver({db,signatureStore})(req,res);
  }catch{
    return res.status(503).json({error:'receiver_unavailable'});
  }
}
