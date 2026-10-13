// Owner opt-in, credential-free route preflight. This is not a signed
// Stripe webhook delivery, an authenticated owner read, or a Hub D-4 test.
import {approvedOrigin,verifyDeployment} from './rtc-service-check.js';
import {accountOk,endpointOk} from '../webhooks/signature-store.js';

const MAX_RESPONSE=2048;
async function boundedJson(reply){
  const type=reply.headers?.get?.('content-type')??'';
  if(!/^application\/json\b/i.test(type))throw new Error('protected_or_non_json');
  const length=reply.headers?.get?.('content-length');
  if(length!=null&&(!/^\d+$/.test(length)||Number(length)>MAX_RESPONSE))
    throw new Error('unexpected_ingress_reply');
  const text=await reply.text();
  if(Buffer.byteLength(text,'utf8')>MAX_RESPONSE)
    throw new Error('unexpected_ingress_reply');
  try{return JSON.parse(text);}catch{throw new Error('unexpected_ingress_reply');}
}

/**
 * Do not send a bearer, webhook secret, account key or event to this preflight.
 * A successful 405 confirms the deployed route exists and is reachable by
 * this caller. It cannot prove the receiver has its TEST secret, can reach SQL,
 * or has accepted a genuine Stripe-signed delivery.
 */
export async function preflightWebhookIngress({
  origin,approvedOrigin:pin,expectedDeploymentSha,account,endpoint,fetcher=fetch
}={}){
  let stage='setup';
  try{
    const base=approvedOrigin(origin,pin);
    if(!accountOk(account)||!endpointOk(endpoint))
      throw new Error('selector_invalid');
    const get=path=>fetcher(base+path,{method:'GET',redirect:'manual',
      headers:{accept:'application/json'},cache:'no-store'});
    stage='deployment';
    const manifestReply=await get('/api/contract');
    if(manifestReply.status!==200)throw new Error('deployment_unverified');
    const manifest=await boundedJson(manifestReply);
    verifyDeployment(manifest,expectedDeploymentSha);
    stage='receiver_route';
    const route='/api/stripe/test-webhooks/'+
      encodeURIComponent(account)+'/'+encodeURIComponent(endpoint);
    const ingressReply=await get(route);
    const envelope=await boundedJson(ingressReply);
    if(ingressReply.status!==405||envelope?.error!=='method_not_allowed')
      throw new Error('receiver_route_unverified');
    return {status:'passed',checks:['exact_live_deployment','test_receiver_route'],
      signedWebhookDelivery:'not_run',receiverSecret:'not_checked',
      note:'Reachable 405 only. No signed TEST event, database receipt, or owner authentication was verified.'};
  }catch(error){
    const known=['origin_not_pinned','origin_invalid','selector_invalid',
      'deployment_unverified','deployment_mismatch','protected_or_non_json',
      'unexpected_ingress_reply','receiver_route_unverified'];
    return {status:'failed',stage,
      code:known.includes(error?.message)?error.message:'ingress_unavailable',
      signedWebhookDelivery:'not_run'};
  }
}
