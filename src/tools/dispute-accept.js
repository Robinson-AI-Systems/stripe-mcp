// G-2d2: bank-loss acceptance is a separate, independently owner-approved money-out.
import {defineWrite,gone} from './write.js';
import {client,writeProfiles,validateFields,ref} from './billing-shared.js';
const props={disputeId:{type:'string',pattern:'^du_[A-Za-z0-9]{2,100}$'},
  outsideApp:{type:'boolean'}};
const invalid=message=>{throw new TypeError(message);};
async function preflight(args,ctx){
  validateFields(args,props,['disputeId']);
  if(typeof args.disputeId!=='string'||!/^du_[A-Za-z0-9]{2,100}$/.test(args.disputeId))
    invalid('Exact dispute ID required');
  const s=await client(ctx),d=await s.disputes.retrieve(args.disputeId);
  if(d?.object!=='dispute'||d.id!==args.disputeId||d.livemode!==false||
    d.status!=='needs_response'||!Number.isSafeInteger(d.amount)||
    d.amount<1||d.amount>100000000||d.currency!=='usd')
    invalid('Only ordinary, open USD TEST disputes with verified positive loss can be accepted');
  const chargeId=ref(d.charge);
  if(typeof chargeId!=='string'||!/^ch_[A-Za-z0-9]{2,100}$/.test(chargeId))
    invalid('Verified dispute charge required');
  const charge=await s.charges.retrieve(chargeId);
  if(charge?.object!=='charge'||charge.id!==chargeId||charge.livemode!==false||
    charge.currency!=='usd'||!Number.isSafeInteger(charge.amount)||
    charge.amount<d.amount)
    invalid('Selected TEST charge identity or disputed amount invalid');
  return {...d,charge:chargeId,
    metadata:{...(charge.metadata??{}),...(d.metadata??{})},
    customer:charge.customer??null};
}
export function makeDisputeAccept(){
  return defineWrite({
    name:'dispute_accept',
    read:preflight,
    summarize:b=>'TEST MODE. IRREVERSIBLY ACCEPT and LOSE dispute '+b.id+
      '. The issuing bank receives the exact disputed amount. This is NOT a refund.'+
      ' Independent authenticated owner money-out approval is required for this'+
      ' exact account, dispute and amount, plus a separate override above the shared daily cap.',
    money:async(_args,_ctx,b)=>({amountCents:b.amount,currency:b.currency,
      direction:'out',targetId:b.id,
      description:'Irreversible acceptance of TEST dispute '+b.id}),
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).disputes.close(a.disputeId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).disputes.retrieve(a.disputeId),
    verify:(b,a)=>a?.object==='dispute'&&a.id===b.id&&a.livemode===false&&
      a.status==='lost'&&a.amount===b.amount&&a.currency===b.currency&&
      ref(a.charge)===b.charge
  });
}
const op=makeDisputeAccept();
export const tools=[{...op.tool,area:'disputes',profiles:writeProfiles,
  description:'Accept and lose an ordinary TEST dispute after separate owner money-out approval.',
  annotations:{destructiveHint:true},
  inputSchema:{type:'object',properties:{...props,dryRun:{type:'boolean'},
    confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['disputeId'],additionalProperties:false}}];
export const handlers={dispute_accept:(a,ctx)=>
  ctx?.connection?.mode!=='test'?gone('Dispute acceptance requires TEST mode'):
  makeDisputeAccept().handler(a,{...ctx,
    getCustomer:async id=>(await client(ctx)).customers.retrieve(id)})};
