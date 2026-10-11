// G-1c4 synthetic TEST-only top-up: never use an unverified real bank.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields,id} from './billing-shared.js';
const syntheticBank='btok_us_verified';
const defs=[
  {name:'money_create_topup',description:'Create owner-approved TEST top-up using only Stripe synthetic bank token.',
    props:{amountCents:{type:'integer',minimum:1,maximum:100000000}},
    required:['amountCents'],money:true},
  {name:'money_cancel_topup',description:'Cancel a pending TEST top-up, never debit an account.',
    props:{topupId:id('tu'),outsideApp:{type:'boolean'}},
    required:['topupId'],destructive:true}
];
async function account(ctx){
  const s=await client(ctx),own=await s.accounts.retrieve();
  if(own?.object!=='account'||own.id!==ctx.connection.stripeAccount||
    own.livemode!==false||own.country!=='US')
    throw new TypeError('Own US TEST account identity unavailable');
  return {s,own};
}
async function target(def,args,ctx){
  validateFields(args,def.props,def.required);
  const {s,own}=await account(ctx);
  if(def.money)return {id:own.id,object:'account',metadata:{},
    amount:args.amountCents,currency:'usd',livemode:false};
  const v=await s.topups.retrieve(args.topupId);
  if(v?.object!=='topup'||v.id!==args.topupId||
    v.livemode!==false||v.status!=='pending'||v.currency!=='usd'||
    !Number.isSafeInteger(v.amount)||v.amount<=0||v.amount>100000000)
    throw new TypeError('Only exact pending USD TEST top-up can be canceled');
  return v;
}
function make(def){
  let createdId=null;
  return defineWrite({
    name:def.name,
    read:(a,ctx)=>target(def,a,ctx),
    summarize:(b,a)=>def.money?
      'TEST MODE. Initiate synthetic bank top-up $'+(b.amount/100).toFixed(2)+
      ' USD to selected account '+b.id+' using fixed Stripe TEST source '+
      syntheticBank+'. Independent owner approval is required; no real bank selected.':
      'TEST MODE. Cancel pending top-up '+b.id+' for $'+
      (b.amount/100).toFixed(2)+' USD. Provider read-back required.',
    money:def.money?async(_a,_ctx,b)=>({
      amountCents:b.amount,currency:'usd',direction:'out',targetId:b.id,
      description:'TEST top-up from fixed synthetic bank token '+syntheticBank
    }):undefined,
    apply:async(a,ctx,{idempotencyKey,before})=>{
      const s=await client(ctx);
      if(def.money){
        const result=await s.topups.create({amount:before.amount,
          currency:'usd',source:syntheticBank,
          description:'Synthetic TEST balance top-up'}, {idempotencyKey});
        if(result?.object!=='topup'||!/^tu_[A-Za-z0-9]{2,100}$/.test(result.id))
          throw new TypeError('Top-up source provider receipt cannot be validated');
        createdId=result.id;
      }else{
        await s.topups.cancel(before.id,{}, {idempotencyKey});
      }
    },
    readAfter:async(a,ctx)=>{
      const id=def.money?createdId:a.topupId;
      return id?(await client(ctx)).topups.retrieve(id):null;
    },
    verify:(b,after)=>after?.object==='topup'&&after.id===(def.money?createdId:b.id)&&
      after.livemode===false&&after.currency==='usd'&&after.amount===b.amount&&
      (def.money?['pending','succeeded'].includes(after.status):
        after.status==='canceled')
  });
}
export const tools=defs.map(d=>{
  const op=make(d);
  return {...op.tool,area:'money',profiles:fullProfiles,
    description:d.description,annotations:{destructiveHint:d.destructive===true},
    inputSchema:{type:'object',properties:{...d.props,
      dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:d.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(defs.map(d=>[
  d.name,(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Top-up writes require TEST mode'):make(d).handler(a,ctx)
]));
export function makeTopupWrite(name){
  const def=defs.find(d=>d.name===name);
  if(!def)throw new TypeError('Unknown top-up write');
  return make(def);
}
