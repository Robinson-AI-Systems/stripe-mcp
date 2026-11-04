// G-1c3 bank-debit reversal in the connection's mode; separate
// authenticated owner approval required. Every mode proof demands the
// connection's own mode (owner-obedience V2, Money).
import {defineWrite} from './write.js';
import {client,fullProfiles,validateFields,id,ref} from './billing-shared.js';
const props={payoutId:id('po'),outsideApp:{type:'boolean'}};
async function preflight(a,ctx){
  // previewFingerprint is a core write-lifecycle control field (ruling
  // 5), not a provider field; the family validator sees the rest.
  const {previewFingerprint:_control,...fields}=a??{};
  validateFields(fields,props,['payoutId']);
  const live=ctx.connection.mode==='live';
  const s=await client(ctx);
  const own=await s.accounts.retrieve();
  if(own?.object!=='account'||own.id!==ctx.connection.stripeAccount||
    own.livemode!==live||own.country!=='US')
    throw new TypeError('Exact own US account unavailable');
  const p=await s.payouts.retrieve(a.payoutId),bankId=ref(p?.destination);
  if(p?.object!=='payout'||p.id!==a.payoutId||p.livemode!==live||
    p.status!=='paid'||p.automatic!==false||p.currency!=='usd'||
    !Number.isSafeInteger(p.amount)||p.amount<1||p.amount>100000000||
    !/^ba_[A-Za-z0-9]{2,100}$/.test(bankId??'')||
    ref(p.reversed_by)!=null||ref(p.original_payout)!=null)
    throw new TypeError('Only a paid, unreversed manual US-bank payout may be reversed');
  const bank=await s.accounts.retrieveExternalAccount(own.id,bankId);
  if(bank?.object!=='bank_account'||bank.id!==bankId||
    ref(bank.account)!==own.id||bank.country!=='US'||
    !/^[0-9]{4}$/.test(bank.last4??''))
    throw new TypeError('External bank debit target could not be verified');
  return {...p,_bankLast4:bank.last4,_bankId:bankId};
}
function make(){
  let reverseId=null;
  return defineWrite({
    name:'money_reverse_payout',read:preflight,
    summarize:(b,_a,ctx)=>(ctx.connection.mode==='live'?'LIVE MODE':'TEST MODE')+
      '. DEBIT external US bank '+b._bankId+
      ' ending '+b._bankLast4+' to reverse previously PAID manual payout '+b.id+
      ' for $'+(b.amount/100).toFixed(2)+
      ' USD. A separately authenticated bank-owner signatory must authorize this exact debit.',
    money:async(_a,ctx,b)=>({amountCents:b.amount,currency:'usd',
      direction:'out',targetId:b.id,
      description:'Bank-debit reversal of '+
        (ctx.connection.mode==='live'?'LIVE':'TEST')+' paid payout '+b.id}),
    apply:async(a,ctx,{idempotencyKey})=>{
      const result=await (await client(ctx)).payouts.reverse(
        a.payoutId,{}, {idempotencyKey});
      if(result?.object!=='payout'||
        !/^po_[A-Za-z0-9]{2,100}$/.test(result.id))
        throw new TypeError('Stripe reversal receipt lacks exact identity');
      reverseId=result.id;
    },
    readAfter:async(a,ctx)=>{
      if(!reverseId)return null;
      const s=await client(ctx);
      return {original:await s.payouts.retrieve(a.payoutId),
        reversal:await s.payouts.retrieve(reverseId)};
    },
    verify:(b,v,_a,ctx)=>v?.original?.id===b.id&&
      ref(v.original.reversed_by)===reverseId&&
      v.reversal?.id===reverseId&&v.reversal.object==='payout'&&
      v.reversal.livemode===(ctx.connection.mode==='live')&&v.reversal.currency==='usd'&&
      v.reversal.amount===-b.amount&&
      ref(v.reversal.original_payout)===b.id&&
      ref(v.reversal.destination)===b._bankId
  });
}
const op=make();
export const tools=[{...op.tool,area:'money',profiles:fullProfiles,
  description:'Reverse a paid manual US-bank payout in the connection mode only after independent owner bank-debit approval.',
  annotations:{destructiveHint:true},
  inputSchema:{type:'object',properties:{...props,
    dryRun:{type:'boolean'},confirm:{type:'boolean'},
    previewFingerprint:{type:'string',maxLength:64},
    requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['payoutId'],additionalProperties:false}}];
export const handlers={money_reverse_payout:(a,ctx)=>make().handler(a,ctx)};
export const makePayoutReverseWrite=make;
