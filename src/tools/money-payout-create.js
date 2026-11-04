// G-1c2 verified manual payout in the connection's mode; owner consent
// is enforced by money.js. Every mode proof below demands that provider
// objects carry the connection's own mode (owner-obedience V2, Money).
import {defineWrite} from './write.js';
import {client,fullProfiles,validateFields,id,ref} from './billing-shared.js';
const props={amountCents:{type:'integer',minimum:1,maximum:100000000},
  destinationId:id('ba'),sourceType:{type:'string',enum:['card','bank_account']}};
const required=Object.keys(props);
function ensure(ok,message){if(!ok)throw new TypeError(message);}
async function preflight(a,ctx){
  // previewFingerprint is a core write-lifecycle control field (ruling
  // 5), not a provider field; the family validator sees the rest.
  const {previewFingerprint:_control,...fields}=a??{};
  validateFields(fields,props,required);
  const live=ctx.connection.mode==='live';
  const s=await client(ctx),account=await s.accounts.retrieve();
  ensure(account?.object==='account'&&account.id===ctx.connection.stripeAccount&&
    account.livemode===live&&account.country==='US','Own US account not verified');
  const bank=await s.accounts.retrieveExternalAccount(account.id,a.destinationId);
  ensure(bank?.object==='bank_account'&&bank.id===a.destinationId&&
    ref(bank.account)===account.id&&bank.currency==='usd'&&
    bank.country==='US'&&bank.status==='verified'&&/^[0-9]{4}$/.test(bank.last4??''),
    'Verified bank destination inaccessible; use Stripe Dashboard');
  const balance=await s.balance.retrieve(),b=balance?.available;
  ensure(balance?.object==='balance'&&balance.livemode===live&&
    Array.isArray(b)&&b.length<=100,'Selected account balance unavailable');
  const usd=b.filter(x=>x.currency==='usd');
  ensure(usd.length===1&&Number.isSafeInteger(usd[0].amount)&&
    usd[0].amount>=a.amountCents&&
    Number.isSafeInteger(usd[0].source_types?.[a.sourceType])&&
    usd[0].source_types[a.sourceType]>=a.amountCents,
    'Verified USD source-type funds unavailable or insufficient');
  return {id:bank.id,object:'bank_account',metadata:{},
    amount:a.amountCents,sourceType:a.sourceType,last4:bank.last4};
}
function make(){
  let created=null;
  return defineWrite({
    name:'money_create_payout',read:preflight,
    summarize:(b,a,ctx)=>(ctx.connection.mode==='live'?'LIVE MODE':'TEST MODE')+
      '. Send standard manual payout $'+
      (a.amountCents/100).toFixed(2)+' USD to bank '+b.id+
      ' ending '+b.last4+' from '+b.sourceType+
      '. Stripe reports the arrival date on the payout once it is created;'+
      ' once a payout is paid it cannot be pulled back by this server.'+
      ' Requires independent authenticated owner approval.',
    money:async(_a,ctx,b)=>({amountCents:b.amount,currency:'usd',
      direction:'out',targetId:b.id,
      description:(ctx.connection.mode==='live'?'LIVE':'TEST')+
        ' manual payout to verified bank '+b.id}),
    apply:async(_a,ctx,{before:b,idempotencyKey})=>{
      created=await (await client(ctx)).payouts.create({
        amount:b.amount,currency:'usd',destination:b.id,
        source_type:b.sourceType,method:'standard'},{idempotencyKey});
      ensure(created?.object==='payout'&&
        /^po_[A-Za-z0-9]{2,100}$/.test(created.id),
        'Provider payout identity unavailable');
    },
    readAfter:async(_a,ctx)=>created?.id?
      (await client(ctx)).payouts.retrieve(created.id):null,
    verify:(b,v,_a,ctx)=>v?.object==='payout'&&v.id===created?.id&&
      v.livemode===(ctx.connection.mode==='live')&&v.automatic===false&&v.currency==='usd'&&
      v.amount===b.amount&&ref(v.destination)===b.id&&
      v.source_type===b.sourceType&&v.method==='standard'&&
      ['pending','in_transit','paid'].includes(v.status)
  });
}
const write=make();
export const tools=[{...write.tool,area:'money',profiles:fullProfiles,
  description:'Create a standard manual payout to a verified bank in the connection mode, requiring independent owner approval.',
  inputSchema:{type:'object',properties:{...props,
    dryRun:{type:'boolean'},confirm:{type:'boolean'},
    previewFingerprint:{type:'string',maxLength:64},
    requestKey:{type:'string',minLength:1,maxLength:128}},
    required,additionalProperties:false}}];
export const handlers={money_create_payout:(a,ctx)=>make().handler(a,ctx)};
export const makePayoutCreateWrite=make;
