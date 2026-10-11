// V-4c1: bounded genuine TEST Event reads and strict pinned TLS delivery.
// Internal-only primitives; V-4c2 adds guarded MCP workflows and receipts.
import {request as nativeHttpsRequest} from 'node:https';
import {resolveForwardTarget,signTestStripeEvent} from './forwarder-security.js';

const fail=x=>{throw new TypeError(x);};
const account=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const eventId=x=>typeof x==='string'&&/^evt_[A-Za-z0-9]{2,100}$/.test(x);
const eventType=x=>typeof x==='string'&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,80}$/.test(x);
const typeList=x=>Array.isArray(x)&&x.length>=1&&x.length<=25&&
  x.every(eventType)&&new Set(x).size===x.length;
const maxEvents=5;

export function verifyOriginalTestEvent(event,{accountId,types,id,since}){
  if(!account(accountId)||!typeList(types)||!eventId(event?.id)||
    (id!==undefined&&event.id!==id)||
    event.object!=='event'||event.livemode!==false||
    (event.account!==undefined&&event.account!==null&&event.account!==accountId)||
    !types.includes(event.type)||!Number.isSafeInteger(event.created)||
    event.created<946684800||event.created>4102444800||
    (since!==undefined&&event.created<since)||
    !event.data||typeof event.data.object!=='object'||!event.data.object||
    event.data.object.livemode===true)
    fail('Stripe TEST Event evidence is missing, disallowed or belongs to another account');
  return event;
}

export async function selectOriginalTestEvents({
  stripe,accountId,forwarderTypes,eventIds,since,types,startingAfter,now=Math.floor(Date.now()/1000)
}){
  if(!account(accountId)||!typeList(forwarderTypes)||
    typeof stripe?.events?.retrieve!=='function'||
    typeof stripe?.events?.list!=='function')
    fail('Selected TEST Stripe account and Event API required');
  if(types!==undefined&&(!typeList(types)||types.some(t=>!forwarderTypes.includes(t))))
    fail('Requested event types must be a subset of this forwarder');
  const filter=types??forwarderTypes;
  if(!Number.isSafeInteger(now)||now<946684800)
    fail('Valid current time required');
  const byIds=eventIds!==undefined;
  if(byIds){
    if(since!==undefined||startingAfter!==undefined||
      !Array.isArray(eventIds)||eventIds.length<1||eventIds.length>maxEvents||
      !eventIds.every(eventId)||new Set(eventIds).size!==eventIds.length)
      fail('Provide one to five distinct original Stripe Event IDs');
    const events=[];
    for(const id of eventIds){
      const found=await stripe.events.retrieve(id);
      events.push(verifyOriginalTestEvent(found,{accountId,types:filter,id}));
    }
    return {events,hasMore:false,nextCursor:null,selection:'ids'};
  }
  if(!Number.isSafeInteger(since)||since>now||
    since<now-30*86400||
    filter.length>20||
    (startingAfter!==undefined&&!eventId(startingAfter)))
    fail('A last-30-days since timestamp, at most twenty event filters and valid cursor required');
  const result=await stripe.events.list({created:{gte:since},
    types:filter,limit:maxEvents,
    ...(startingAfter?{starting_after:startingAfter}:{})});
  if(!result||!Array.isArray(result.data)||result.data.length>maxEvents||
    typeof result.has_more!=='boolean'||
    result.data.some(e=>!eventId(e?.id))||
    new Set(result.data.map(e=>e.id)).size!==result.data.length||
    (result.has_more&&result.data.length===0))
    fail('Stripe Events listing was incomplete or unverifiable');
  const events=[];
  for(const item of result.data){
    const found=await stripe.events.retrieve(item.id);
    verifyOriginalTestEvent(found,{accountId,types:filter,id:item.id,since});
    if(item.type!==found.type||item.created!==found.created||
      item.livemode!==false)
      fail('Stripe Event listing and independent retrieval disagree');
    events.push(found);
  }
  return {events,hasMore:result.has_more,
    nextCursor:result.has_more?result.data.at(-1).id:null,
    selection:'since'};
}

export async function deliverOriginalTestEvent({
  url,event,accountId,types,secret,
  lookup,requestHttps=nativeHttpsRequest,timeoutMs=10000
}){
  verifyOriginalTestEvent(event,{accountId,types});
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000||
    typeof requestHttps!=='function')
    fail('Bounded TLS webhook sender is required');
  // Every POST resolves the complete DNS answer anew. A prior registration
  // preflight is never treated as a delivery-time authorization.
  const pinned=await resolveForwardTarget(url,lookup?{lookup}:{});
  const signed=signTestStripeEvent(event,secret);
  const path=new URL(pinned.url).pathname;
  const options={
    protocol:'https:',hostname:pinned.hostname,port:443,path,method:'POST',
    rejectUnauthorized:true,servername:pinned.hostname,
    agent:false,autoSelectFamily:false,family:pinned.family,
    timeout:timeoutMs,maxHeaderSize:8192,
    headers:{
      Host:pinned.hostname,'Content-Type':signed.contentType,
      'Stripe-Signature':signed.signature,
      'Content-Length':Buffer.byteLength(signed.body)
    },
    lookup:(hostname,_options,callback)=>{
      if(hostname!==pinned.hostname)
        return callback(new Error('Pinned webhook hostname mismatch'));
      return callback(null,pinned.address,pinned.family);
    }
  };
  // Node HTTPS does not automatically follow redirects. A 3xx is a failed
  // delivery and MUST NOT result in a second request to Location.
  return await new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,result)=>{
      if(settled)return;
      settled=true;
      if(error)reject(new Error('TEST webhook delivery failed or was interrupted'));
      else resolve(result);
    };
    let req;
    try{
      req=requestHttps(options,res=>{
        const status=res.statusCode;
        let bytes=0;
        res.on('data',part=>{
          bytes+=Buffer.byteLength(part);
          if(bytes>1024)req.destroy(new Error('Response exceeds safe limit'));
        });
        res.on('end',()=>{
          if(!Number.isInteger(status)||status<100||status>599)
            return finish(new Error('Invalid HTTP status'));
          finish(null,{eventId:event.id,statusCode:status,
            accepted:status>=200&&status<300,
            note:status>=200&&status<300?
              'Target HTTP server accepted the POST; application processing is not confirmed':
              'Target HTTP response was not successful; no redirect followed'});
        });
        res.on('error',finish);
        res.on('aborted',()=>finish(new Error('Truncated HTTPS response')));
      });
      req.on('error',finish);
      req.on('timeout',()=>req.destroy(new Error('Webhook timeout')));
      req.end(signed.body);
    }catch(error){finish(error);}
  });
}
