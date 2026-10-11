// G-3b: two full-profile TEST Radar writes; independent preflight and read-back.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields,ref} from './billing-shared.js';
import {reviewSafe,valueListSafe} from './radar-reads.js';
const invalid=m=>{throw new TypeError(m);};
const reviewProps={reviewId:{type:'string',pattern:'^prv_[A-Za-z0-9]{2,100}$'},
  outsideApp:{type:'boolean'}};
const listTypes=['card_bin','card_fingerprint','case_sensitive_string','country',
  'customer_id','email','ip_address','sepa_debit_fingerprint','string',
  'us_bank_account_fingerprint'];
const listProps={name:{type:'string',minLength:3,maxLength:80},
  alias:{type:'string',pattern:'^[a-z][a-z0-9_]{2,39}$'},
  itemType:{type:'string',enum:listTypes}};
async function readReview(a,ctx){
  validateFields(a,reviewProps,['reviewId']);
  const s=await client(ctx);
  const rev=await s.reviews.retrieve(a.reviewId);
  if(rev?.id!==a.reviewId||reviewSafe(rev).open!==true)
    invalid('Only an exact open TEST Radar review may be approved');
  const chargeId=ref(rev.charge),intentId=ref(rev.payment_intent);
  let p;
  if(typeof chargeId==='string'&&/^ch_[A-Za-z0-9]{2,100}$/.test(chargeId)){
    p=await s.charges.retrieve(chargeId);
    if(p?.object!=='charge'||p.id!==chargeId||p.livemode!==false)
      invalid('Review charge identity unavailable');
  }else if(typeof intentId==='string'&&/^pi_[A-Za-z0-9]{2,100}$/.test(intentId)){
    p=await s.paymentIntents.retrieve(intentId);
    if(p?.object!=='payment_intent'||p.id!==intentId||p.livemode!==false)
      invalid('Review payment identity unavailable');
  }else invalid('Review requires verified linked charge or payment');
  return {...rev,metadata:{...(p.metadata??{}),...(rev.metadata??{})},
    customer:p.customer??null,_sourceId:p.id};
}
export function makeRadarApprove(){
  return defineWrite({
    name:'radar_approve_review',read:readReview,
    summarize:b=>'TEST MODE. Approve open fraud review '+b.id+
      ' for verified payment '+b._sourceId+'. This irrevocably closes manual'+
      ' review and may allow the pending payment to proceed.',
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).reviews.approve(a.reviewId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).reviews.retrieve(a.reviewId),
    verify:(b,a)=>a?.object==='review'&&a.id===b.id&&a.livemode===false&&
      a.open===false&&a.reason==='approved'&&
      ref(a.charge)===ref(b.charge)&&ref(a.payment_intent)===ref(b.payment_intent)
  });
}
const listId=x=>typeof x==='string'&&/^rsl_[A-Za-z0-9]{2,100}$/.test(x);
async function readListCreate(a,ctx){
  validateFields(a,listProps,['name','alias','itemType']);
  if(!/^[a-z][a-z0-9_]{2,39}$/.test(a.alias)||!a.name.trim()||
    /[\r\n\0]/.test(a.name))invalid('Safe Radar list name and alias required');
  const result=await (await client(ctx)).radar.valueLists.list({alias:a.alias,limit:1});
  if(!Array.isArray(result?.data)||typeof result.has_more!=='boolean'||
    result.data.length>0||result.has_more)
    invalid('Cannot verify new TEST Radar list alias is unused');
  return {id:'radar_new_list',metadata:{},customer:null};
}
export function makeRadarListCreate(){
  let createdId=null;
  return defineWrite({
    name:'radar_create_value_list',read:readListCreate,
    summarize:(_b,a)=>'TEST MODE. Create Radar value list with alias '+a.alias+
      ' and item type '+a.itemType+'. Name length '+a.name.length+
      '; actual values are never included in audit.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const v=await (await client(ctx)).radar.valueLists.create({
        name:a.name,alias:a.alias,item_type:a.itemType},{idempotencyKey});
      if(!listId(v?.id)||v.object!=='radar.value_list'||v.livemode!==false)
        invalid('Radar value list creation identity unavailable');
      createdId=v.id;
    },
    readAfter:async(_a,ctx)=>createdId?
      (await client(ctx)).radar.valueLists.retrieve(createdId):null,
    verify:(_b,a,args)=>!!createdId&&a?.id===createdId&&
      valueListSafe(a).alias===args.alias&&a.name===args.name&&
      a.item_type===args.itemType
  });
}
const approve=makeRadarApprove(),create=makeRadarListCreate();
const control={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
export const tools=[
  {...approve.tool,area:'risk',profiles:fullProfiles,safety:'C',
    description:'Approve an open TEST fraud review with guarded confirmation and payment ownership check.',
    annotations:{destructiveHint:true},
    inputSchema:{type:'object',properties:{...reviewProps,...control},
      required:['reviewId'],additionalProperties:false}},
  {...create.tool,area:'risk',profiles:fullProfiles,
    description:'Create a new verified TEST Radar value list with safe alias and type.',
    inputSchema:{type:'object',properties:{...listProps,...control},
      required:['name','alias','itemType'],additionalProperties:false}}
];
const withCustomer=(ctx)=>({...ctx,getCustomer:async id=>
  (await client(ctx)).customers.retrieve(id)});
export const handlers={
  radar_approve_review:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Radar review approval requires TEST mode'):
    makeRadarApprove().handler(a,withCustomer(ctx)),
  radar_create_value_list:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Radar value-list creation requires TEST mode'):
    makeRadarListCreate().handler(a,ctx)
};
