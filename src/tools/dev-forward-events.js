// V-4c2 guarded original TEST Stripe Event forwarding. No LIVE, no fabricated events.
import {randomBytes,createHash} from 'node:crypto';
import {decryptSecret} from '../core/crypto.js';
import {selectOriginalTestEvents,deliverOriginalTestEvent}
  from '../dev/forwarder-delivery.js';
import {client,reply,writeProfiles} from './billing-shared.js';
import {defineWrite,gone} from './write.js';
const account=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const forwarder=x=>typeof x==='string'&&/^fwd_[a-f0-9]{32}$/.test(x);
const retry=x=>typeof x==='string'&&x.length>=1&&x.length<=128;
function validate(a,ctx){
  if(ctx?.connection?.mode!=='test'||!account(ctx.connection.stripeAccount))
    throw new TypeError('TEST account required for event forwarding');
  if(!a||typeof a!=='object'||Array.isArray(a)||!forwarder(a.forwarderId)||
    !retry(a.requestKey)||Object.keys(a).some(k=>![
      'forwarderId','requestKey','eventIds','since','types',
      'startingAfter','confirm','dryRun'
    ].includes(k)))
    throw new TypeError('Exact forwarder, replay selector and retry key required');
  if((a.eventIds===undefined)===(a.since===undefined))
    throw new TypeError('Select either exact original Event IDs or a since window');
}
function requireDb(ctx){
  for(const method of ['getDevForwarderForDelivery','getDevForwarderReplay',
    'reserveDevForwarderReplay','markDevForwarderReplayAttempt',
    'recordDevForwarderReplayReceipt','markDevForwarderUsed'])
    if(typeof ctx.db?.[method]!=='function')
      throw new TypeError('Durable TEST delivery ledger unavailable');
  return ctx.db;
}
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function makeDevForwardEventsWrite({encryptionKey}={}){
  let replayId=null;
  const op=defineWrite({
    name:'dev_forward_events',
    read:async(a,ctx)=>{
      validate(a,ctx);
      const db=requireDb(ctx),accountId=ctx.connection.stripeAccount;
      const row=await db.getDevForwarderForDelivery({
        accountId,id:a.forwarderId});
      if(!row||row.id!==a.forwarderId||!row.secret_enc||
        !Array.isArray(row.types)||row.url.length>550)
        throw new TypeError('Active TEST forwarder missing or URL too long for exact preview');
      const selected=await selectOriginalTestEvents({
        stripe:await client(ctx),accountId,forwarderTypes:row.types,
        eventIds:a.eventIds,since:a.since,types:a.types,
        startingAfter:a.startingAfter
      });
      if(selected.events.length===0)
        throw new TypeError('No matching original Stripe TEST Events in this selection');
      const ids=selected.events.map(x=>x.id);
      const configDigest=digest([a.forwarderId,row.url,row.types,
        a.eventIds??null,a.since??null,a.types??null,
        a.startingAfter??null,ids]);
      const prior=await db.getDevForwarderReplay({
        accountId,requestKey:a.requestKey});
      if(prior&&(prior.forwarderId!==a.forwarderId||
        prior.configDigest!==configDigest||
        prior.eventIds.join('|')!==ids.join('|')))
        throw new TypeError('This replay key belongs to a different event selection');
      return {accountId,row,selected,ids,configDigest,prior};
    },
    summarize:p=>'TEST MODE. Send exact original Stripe Events '+p.ids.join(', ')+
      ' to '+p.row.url+'. Each HTTPS POST resolves/pins public DNS, preserves '+
      'TLS verification and uses a generated Stripe-Signature. A 2xx proves only '+
      'HTTP acceptance, not app processing. No automatic resend under the same '+
      'requestKey after interruption; an explicit NEW key is needed for a replay. '+
      (p.selected.hasMore?'More matching events exist; use next cursor.':'No omitted result page.'),
    apply:async(a,ctx,{before})=>{
      const db=ctx.db;
      const reserved=await db.reserveDevForwarderReplay({
        accountId:before.accountId,forwarderId:a.forwarderId,
        id:'rpl_'+randomBytes(12).toString('hex'),
        requestKey:a.requestKey,configDigest:before.configDigest,
        eventIds:before.ids
      });
      replayId=reserved.id;
      // A replay of the same requestKey only reads saved receipts.
      if(!reserved.newlyReserved)return;
      const secret=decryptSecret(before.row.secret_enc,{
        aad:'stripe-dev-forwarder/'+before.accountId+'/'+a.forwarderId,
        ...(encryptionKey?{key:encryptionKey}:{})
      });
      for(const event of before.selected.events){
        const started=await db.markDevForwarderReplayAttempt({
          accountId:before.accountId,requestKey:a.requestKey,
          id:replayId,eventId:event.id
        });
        if(!started)throw new Error('Forwarder was deleted or replay event already attempted');
        let delivered;
        try{
          delivered=await deliverOriginalTestEvent({
            url:before.row.url,event,accountId:before.accountId,
            types:before.row.types,secret,
            ...(ctx.services?.forwarderDnsLookup?
              {lookup:ctx.services.forwarderDnsLookup}:{}),
            ...(ctx.services?.forwarderHttpRequest?
              {requestHttps:ctx.services.forwarderHttpRequest}:{})
          });
        }catch{
          // Timeout/transport failure cannot prove no POST reached the target.
          // Leave durable status 'uncertain' and DO NOT send the next event.
          throw new Error('TEST webhook outcome uncertain: no automatic replay');
        }
        const saved=await db.recordDevForwarderReplayReceipt({
          accountId:before.accountId,requestKey:a.requestKey,
          id:replayId,eventId:event.id,
          status:delivered.accepted?'accepted':'rejected',
          statusCode:delivered.statusCode
        });
        if(!saved)throw new Error('HTTP receipt could not be durably recorded');
      }
      await db.markDevForwarderUsed({accountId:before.accountId,
        id:a.forwarderId});
    },
    readAfter:(a,ctx)=>ctx.db.getDevForwarderReplay({
      accountId:ctx.connection.stripeAccount,requestKey:a.requestKey}),
    verify:(before,after)=>after?.id===replayId&&
      after.configDigest===before.configDigest&&
      Array.isArray(after.receipts)&&after.receipts.length===before.ids.length&&
      after.receipts.every(x=>before.ids.includes(x.eventId)&&x.status==='accepted')
  });
  return {...op,async handler(a,ctx){
    replayId=null;
    if(ctx?.connection?.mode!=='test')return gone('Event forwarding is TEST only');
    const response=await op.handler(a,ctx);
    if(response?.isError||!replayId)return response;
    const summary=JSON.parse(response.content[0].text);
    const record=await ctx.db.getDevForwarderReplay({
      accountId:ctx.connection.stripeAccount,requestKey:a.requestKey});
    if(!record)return response;
    return reply({...summary,replayId:record.id,
      receipts:record.receipts.map(x=>({eventId:x.eventId,status:x.status,
        statusCode:x.statusCode??null})),
      note:'HTTP 2xx is a target receipt, not proof of application processing. Reserved/uncertain entries were not automatically resent.'});
  }};
}
export const tools=[{
  ...makeDevForwardEventsWrite().tool,area:'developer',profiles:writeProfiles,
  description:'Guarded, durable TEST-only replay of verified original Stripe Events to a saved HTTPS forwarder; HTTP receipt per event, no silent retry.',
  inputSchema:{type:'object',properties:{
    forwarderId:{type:'string',pattern:'^fwd_[a-f0-9]{32}$'},
    requestKey:{type:'string',minLength:1,maxLength:128},
    eventIds:{type:'array',minItems:1,maxItems:5,uniqueItems:true,
      items:{type:'string',pattern:'^evt_[A-Za-z0-9]{2,100}$'}},
    since:{type:'integer',minimum:946684800},
    types:{type:'array',minItems:1,maxItems:20,uniqueItems:true,
      items:{type:'string',minLength:3,maxLength:142}},
    startingAfter:{type:'string',pattern:'^evt_[A-Za-z0-9]{2,100}$'},
    confirm:{type:'boolean'},dryRun:{type:'boolean'}
  },required:['forwarderId','requestKey'],additionalProperties:false}
}];
export const handlers={
  dev_forward_events:(args,ctx)=>makeDevForwardEventsWrite().handler(args,ctx)
};
