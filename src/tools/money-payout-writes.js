// G-1c1 manual payout lifecycle writes in the connection's mode. No
// payout creation or bank debit. The payout proof demands the
// connection's own mode on every read (owner-obedience V2, Money).
import {defineWrite} from './write.js';
import {client,fullProfiles,validateFields,validateMetadata,ownership,id}
  from './billing-shared.js';

const definitions=[
  {name:'money_update_payout',description:'Update only metadata on a verified payout.',
    props:{payoutId:id('po'),metadata:{type:'object'},...ownership},
    required:['payoutId','metadata']},
  {name:'money_cancel_payout',description:'Cancel only a pending manual payout after confirmation.',
    props:{payoutId:id('po'),...ownership},required:['payoutId'],destructive:true}
];
function payout(v,requestedId,live){
  if(v?.object!=='payout'||v.id!==requestedId||v.livemode!==live||
    v.currency!=='usd'||!Number.isSafeInteger(v.amount)||
    v.amount<=0||v.amount>100000000)
    throw new TypeError('Verified USD '+(live?'LIVE':'TEST')+' payout required');
  return v;
}
function make(def){
  return defineWrite({
    name:def.name,
    read:async(a,ctx)=>{
      // previewFingerprint is a core write-lifecycle control field
      // (ruling 5), not a provider field; validate the rest.
      const {previewFingerprint:_control,...fields}=a??{};
      validateFields(fields,def.props,def.required);
      if(def.name==='money_update_payout'){
        validateMetadata(a.metadata);
        if(Object.keys(a.metadata).length===0)
          throw new TypeError('Non-empty metadata update required');
      }
      const s=await client(ctx);
      return payout(await s.payouts.retrieve(a.payoutId),a.payoutId,
        ctx.connection.mode==='live');
    },
    summarize:(before,a,ctx)=>(ctx.connection.mode==='live'?'LIVE MODE':'TEST MODE')+
      (def.destructive?
      '. Cancel manual pending payout '+before.id+' for '+
        (before.amount/100).toFixed(2)+' USD; Stripe returns funds to the Stripe balance.':
      '. Update only metadata keys on payout '+before.id+': '+
        Object.keys(a.metadata).sort().join(', ')+'.'),
    targetGuard:(_a,_ctx,b)=>def.destructive?
      (b.status==='pending'&&b.automatic===false?true:
        'Only pending, nonautomatic payouts may be canceled'):true,
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await client(ctx);
      if(def.destructive)
        await s.payouts.cancel(a.payoutId,{}, {idempotencyKey});
      else
        await s.payouts.update(a.payoutId,{metadata:a.metadata},{idempotencyKey});
    },
    readAfter:async(a,ctx)=>payout(
      await (await client(ctx)).payouts.retrieve(a.payoutId),a.payoutId,
      ctx.connection.mode==='live'),
    verify:(before,after,a,ctx)=>after.id===before.id&&
      after.currency===before.currency&&after.amount===before.amount&&
      after.livemode===(ctx.connection.mode==='live')&&
      (def.destructive?after.status==='canceled':
        Object.entries(a.metadata).every(([k,v])=>after.metadata?.[k]===v))
  });
}
export const tools=definitions.map(d=>{
  const op=make(d);
  return {...op.tool,description:d.description,area:'money',profiles:fullProfiles,
    annotations:{destructiveHint:d.destructive===true},
    inputSchema:{type:'object',properties:{...d.props,
      dryRun:{type:'boolean'},confirm:{type:'boolean'},
      previewFingerprint:{type:'string',maxLength:64},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:d.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(definitions.map(d=>[
  d.name,(a,ctx)=>make(d).handler(a,ctx)
]));
export function makePayoutWrite(name){
  const d=definitions.find(x=>x.name===name);
  if(!d)throw new TypeError('Unknown payout write');
  return make(d);
}
