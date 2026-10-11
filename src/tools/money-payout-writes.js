// G-1c1 TEST-only manual payout lifecycle writes. No payout creation or bank debit.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields,validateMetadata,ownership,id}
  from './billing-shared.js';

const definitions=[
  {name:'money_update_payout',description:'Update only metadata on a verified TEST payout.',
    props:{payoutId:id('po'),metadata:{type:'object'},...ownership},
    required:['payoutId','metadata']},
  {name:'money_cancel_payout',description:'Cancel only a pending manual TEST payout after confirmation.',
    props:{payoutId:id('po'),...ownership},required:['payoutId'],destructive:true}
];
function payout(v,requestedId){
  if(v?.object!=='payout'||v.id!==requestedId||v.livemode!==false||
    v.currency!=='usd'||!Number.isSafeInteger(v.amount)||
    v.amount<=0||v.amount>100000000)
    throw new TypeError('Verified USD TEST payout required');
  return v;
}
function make(def){
  return defineWrite({
    name:def.name,
    read:async(a,ctx)=>{
      validateFields(a,def.props,def.required);
      if(def.name==='money_update_payout'){
        validateMetadata(a.metadata);
        if(Object.keys(a.metadata).length===0)
          throw new TypeError('Non-empty metadata update required');
      }
      const s=await client(ctx);
      return payout(await s.payouts.retrieve(a.payoutId),a.payoutId);
    },
    summarize:(before,a)=>def.destructive?
      'TEST MODE. Cancel manual pending payout '+before.id+' for '+
        (before.amount/100).toFixed(2)+' USD; Stripe returns funds to the Stripe balance.':
      'TEST MODE. Update only metadata keys on payout '+before.id+': '+
        Object.keys(a.metadata).sort().join(', ')+'.',
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
      await (await client(ctx)).payouts.retrieve(a.payoutId),a.payoutId),
    verify:(before,after,a)=>after.id===before.id&&
      after.currency===before.currency&&after.amount===before.amount&&
      after.livemode===false&&
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
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:d.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(definitions.map(d=>[
  d.name,(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Payout writes require TEST mode'):make(d).handler(a,ctx)
]));
export function makePayoutWrite(name){
  const d=definitions.find(x=>x.name===name);
  if(!d)throw new TypeError('Unknown payout write');
  return make(d);
}
