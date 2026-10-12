// Public incoming endpoint. Authentication is exclusively a valid, fresh Stripe
// HMAC for an owner-provisioned, encrypted TEST webhook signing secret.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {accountOk,endpointOk} from './signature-store.js';

const MAX=65536;
const validType=x=>typeof x==='string'&&x.length<=120&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(x);
const headerOk=s=>typeof s==='string'&&s.length<2048&&
  /^t=[0-9]{10,12},v1=[a-f0-9]{64}(?:,v1=[a-f0-9]{64})*$/.test(s);
async function rawBody(req){
  const header=req.headers?.['content-length'];
  if(header!==undefined&&(!/^[0-9]{1,8}$/.test(String(header))||Number(header)>MAX))
    throw new TypeError('Invalid payload');
  let size=0;
  const chunks=[];
  for await(const part of req){
    if(!Buffer.isBuffer(part)&&typeof part!=='string')throw new TypeError('Invalid stream');
    const data=Buffer.from(part);
    size+=data.length;
    if(size>MAX)throw new TypeError('Oversized body');
    chunks.push(data);
  }
  if(size<2)throw new TypeError('Empty payload');
  return Buffer.concat(chunks);
}
export function verifyInboundTestEvent({payload,signature,secret,now=Date.now()}){
  if(!Buffer.isBuffer(payload)||payload.length>MAX||payload.length<2||
    !headerOk(signature)||typeof secret!=='string'||
    !/^whsec_[A-Za-z0-9_+\-/=]{12,256}$/.test(secret)||
    !Number.isSafeInteger(now))throw new TypeError('Unverified webhook');
  const parts=signature.split(',');
  const ts=Number(parts[0].slice(2));
  if(!Number.isSafeInteger(ts)||Math.abs(now/1000-ts)>300)
    throw new TypeError('Unverified webhook');
  const signed=Buffer.concat([Buffer.from(String(ts)+'.'),payload]);
  const actual=createHmac('sha256',secret).update(signed).digest();
  if(!parts.slice(1).some(piece=>{
    const supplied=Buffer.from(piece.slice(3),'hex');
    return supplied.length===actual.length&&timingSafeEqual(supplied,actual);
  }))throw new TypeError('Unverified webhook');
  let event;
  try{event=JSON.parse(payload.toString('utf8'));}catch{throw new TypeError('Unverified webhook');}
  if(event?.object!=='event'||event.livemode!==false||event.account!=null||
    typeof event.id!=='string'||!/^evt_[A-Za-z0-9]{2,100}$/.test(event.id)||
    !validType(event.type)||!event.data?.object||
    typeof event.data.object!=='object'||Array.isArray(event.data.object))
    throw new TypeError('Unverified TEST event');
  // Never return the event object or its data outside this verifier.
  return {eventId:event.id,eventType:event.type};
}
export function makeTestWebhookReceiver({db,signatureStore,now=()=>Date.now()}){
  if(typeof db?.recordTestWebhookReceipt!=='function'||
    typeof signatureStore?.load!=='function')throw new TypeError('Receiver dependencies required');
  return async function receiver(req,res){
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='POST'){
      res.setHeader('Allow','POST');
      return res.status(405).json({error:'method_not_allowed'});
    }
    const account=req.query?.account,endpoint=req.query?.endpoint;
    if(!accountOk(account)||!endpointOk(endpoint)||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers?.['content-type']??'')||
      !headerOk(req.headers?.['stripe-signature']))
      return res.status(400).json({error:'unverified_test_delivery'});
    try{
      const payload=await rawBody(req);
      const secret=await signatureStore.load({account,endpoint});
      const safe=verifyInboundTestEvent({payload,signature:req.headers['stripe-signature'],
        secret,now:now()});
      // A 2xx means verified and durably recorded. Duplicate delivery is idempotent.
      const inserted=await db.recordTestWebhookReceipt({account,endpoint,...safe});
      if(typeof inserted!=='boolean')throw new TypeError('Receipt record unavailable');
      return res.status(200).json({accepted:true,duplicate:!inserted,mode:'test'});
    }catch{
      // No request body, signature, account, event ID, or decrypt/SQL errors in public responses.
      return res.status(400).json({error:'unverified_test_delivery'});
    }
  };
}
