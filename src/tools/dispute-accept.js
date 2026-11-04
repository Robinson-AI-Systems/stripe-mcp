// G-2d2: bank-loss acceptance is a separate, independently owner-approved money-out.
import {defineWrite} from './write.js';
import {client,writeProfiles,validateFields,ref} from './billing-shared.js';
const props={disputeId:{type:'string',pattern:'^du_[A-Za-z0-9]{2,100}$'},
  outsideApp:{type:'boolean'}};
const invalid=message=>{throw new TypeError(message);};
async function preflight(args,ctx){
  // previewFingerprint is a core write-lifecycle control field (V2
  // shared card, ruling 5: uniform across modes); src/core/write.js
  // consumes it, so it is stripped before field validation and
  // declared in the tool schema instead.
  const {previewFingerprint:_control,...fields}=args??{};
  validateFields(fields,props,['disputeId']);
  if(typeof args.disputeId!=='string'||!/^du_[A-Za-z0-9]{2,100}$/.test(args.disputeId))
    invalid('Exact dispute ID required');
  const live=ctx?.connection?.mode==='live';
  const s=await client(ctx),d=await s.disputes.retrieve(args.disputeId);
  if(d?.object!=='dispute'||d.id!==args.disputeId||d.livemode!==live||
    d.status!=='needs_response'||!Number.isSafeInteger(d.amount)||
    d.amount<1||d.amount>100000000||d.currency!=='usd')
    invalid('Only ordinary, open USD '+(live?'LIVE':'TEST')+' disputes with verified positive loss can be accepted');
  const chargeId=ref(d.charge);
  if(typeof chargeId!=='string'||!/^ch_[A-Za-z0-9]{2,100}$/.test(chargeId))
    invalid('Verified dispute charge required');
  const charge=await s.charges.retrieve(chargeId);
  if(charge?.object!=='charge'||charge.id!==chargeId||charge.livemode!==live||
    charge.currency!=='usd'||!Number.isSafeInteger(charge.amount)||
    charge.amount<d.amount)
    invalid('Selected '+(live?'LIVE':'TEST')+' charge identity or disputed amount invalid');
  return {...d,charge:chargeId,
    metadata:{...(charge.metadata??{}),...(d.metadata??{})},
    customer:charge.customer??null};
}
export function makeDisputeAccept(){
  return defineWrite({
    name:'dispute_accept',
    read:preflight,
    summarize:(b,_args,ctx)=>(ctx?.connection?.mode==='live'?'LIVE MODE':'TEST MODE')+
      '. IRREVERSIBLY ACCEPT and LOSE dispute '+b.id+
      '. The issuing bank receives the exact disputed amount. Accepting concedes'+
      ' the full disputed amount plus Stripe\u2019s dispute fee, which is not returned.'+
      ' This is NOT a refund.'+
      ' Independent authenticated owner money-out approval is required for this'+
      ' exact account, dispute and amount, plus a separate override above the shared daily cap.',
    money:async(_args,_ctx,b)=>({amountCents:b.amount,currency:b.currency,
      direction:'out',targetId:b.id,
      description:'Irreversible acceptance of '+
        (_ctx?.connection?.mode==='live'?'LIVE':'TEST')+' dispute '+b.id}),
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).disputes.close(a.disputeId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).disputes.retrieve(a.disputeId),
    verify:(b,a,_args,ctx)=>a?.object==='dispute'&&a.id===b.id&&
      a.livemode===(ctx?.connection?.mode==='live')&&
      a.status==='lost'&&a.amount===b.amount&&a.currency===b.currency&&
      ref(a.charge)===b.charge
  });
}
const op=makeDisputeAccept();
export const tools=[{...op.tool,area:'disputes',profiles:writeProfiles,
  description:'Accept and lose an ordinary dispute after separate owner money-out approval.',
  annotations:{destructiveHint:true},
  inputSchema:{type:'object',properties:{...props,dryRun:{type:'boolean'},
    confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128},
    previewFingerprint:{type:'string',maxLength:64}},
    required:['disputeId'],additionalProperties:false}}];
export const handlers={dispute_accept:(a,ctx)=>
  makeDisputeAccept().handler(a,{...ctx,
    getCustomer:async id=>(await client(ctx)).customers.retrieve(id)})};
