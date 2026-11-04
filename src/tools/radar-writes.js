// G-3b: two full-profile Radar writes in the connection's own mode;
// independent preflight and read-back.
import {defineWrite} from './write.js';
import {client,fullProfiles,validateFields,ref} from './billing-shared.js';
import {assertAccountResourceMode} from './account-mode.js';
import {reviewSafe,valueListSafe} from './radar-reads.js';
const invalid=m=>{throw new TypeError(m);};
const modeOf=ctx=>ctx?.connection?.mode;
const modeLabel=ctx=>modeOf(ctx)==='live'?'LIVE':'TEST';
// previewFingerprint is a core control field (owner-obedience V2
// shared machinery); the family validator must not reject it.
const stripControl=a=>{if(!a||typeof a!=='object'||Array.isArray(a))return a;
  const {previewFingerprint:_f,...rest}=a;return rest;};
const reviewProps={reviewId:{type:'string',pattern:'^prv_[A-Za-z0-9]{2,100}$'},
  outsideApp:{type:'boolean'}};
const listTypes=['card_bin','card_fingerprint','case_sensitive_string','country',
  'customer_id','email','ip_address','sepa_debit_fingerprint','string',
  'us_bank_account_fingerprint'];
const listProps={name:{type:'string',minLength:3,maxLength:80},
  alias:{type:'string',pattern:'^[a-z][a-z0-9_]{2,39}$'},
  itemType:{type:'string',enum:listTypes}};
async function readReview(a,ctx){
  validateFields(stripControl(a),reviewProps,['reviewId']);
  const mode=modeOf(ctx);
  const s=await client(ctx);
  const rev=await s.reviews.retrieve(a.reviewId);
  if(rev?.id!==a.reviewId||reviewSafe(rev,mode).open!==true)
    invalid('Only an exact open '+modeLabel(ctx)+' Radar review may be approved');
  const chargeId=ref(rev.charge),intentId=ref(rev.payment_intent);
  let p;
  if(typeof chargeId==='string'&&/^ch_[A-Za-z0-9]{2,100}$/.test(chargeId)){
    p=await s.charges.retrieve(chargeId);
    if(p?.object!=='charge'||p.id!==chargeId)
      invalid('Review charge identity unavailable');
    assertAccountResourceMode(p,mode,{required:true});
  }else if(typeof intentId==='string'&&/^pi_[A-Za-z0-9]{2,100}$/.test(intentId)){
    p=await s.paymentIntents.retrieve(intentId);
    if(p?.object!=='payment_intent'||p.id!==intentId)
      invalid('Review payment identity unavailable');
    assertAccountResourceMode(p,mode,{required:true});
  }else invalid('Review requires verified linked charge or payment');
  return {...rev,metadata:{...(p.metadata??{}),...(rev.metadata??{})},
    customer:p.customer??null,_sourceId:p.id};
}
export function makeRadarApprove(){
  return defineWrite({
    name:'radar_approve_review',read:readReview,
    summarize:(b,_a,ctx)=>modeLabel(ctx)+' MODE. Approve open fraud review '+b.id+
      ' for verified payment '+b._sourceId+'. Approving releases the held'+
      ' payment: this irrevocably closes manual review and may allow the'+
      ' pending payment to be captured and settled.',
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).reviews.approve(a.reviewId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).reviews.retrieve(a.reviewId),
    verify:(b,a,_args,ctx)=>a?.object==='review'&&a.id===b.id&&
      a.livemode===(modeOf(ctx)==='live')&&
      a.open===false&&a.reason==='approved'&&
      ref(a.charge)===ref(b.charge)&&ref(a.payment_intent)===ref(b.payment_intent)
  });
}
const listId=x=>typeof x==='string'&&/^rsl_[A-Za-z0-9]{2,100}$/.test(x);
async function readListCreate(a,ctx){
  validateFields(stripControl(a),listProps,['name','alias','itemType']);
  if(!/^[a-z][a-z0-9_]{2,39}$/.test(a.alias)||!a.name.trim()||
    /[\r\n\0]/.test(a.name))invalid('Safe Radar list name and alias required');
  const result=await (await client(ctx)).radar.valueLists.list({alias:a.alias,limit:1});
  if(!Array.isArray(result?.data)||typeof result.has_more!=='boolean'||
    result.data.length>0||result.has_more)
    invalid('Cannot verify new '+modeLabel(ctx)+' Radar list alias is unused');
  return {id:'radar_new_list',metadata:{},customer:null};
}
export function makeRadarListCreate(){
  let createdId=null;
  return defineWrite({
    name:'radar_create_value_list',read:readListCreate,
    summarize:(_b,a,ctx)=>modeLabel(ctx)+' MODE. Create Radar value list with alias '+a.alias+
      ' and item type '+a.itemType+'. Name length '+a.name.length+
      '; actual values are never included in audit.'+
      (modeOf(ctx)==='live'?' In LIVE mode, rules using this list act on real'+
      ' payments: a block rule refuses real customers whose payment matches'+
      ' a listed value, and an allow rule lets them through.':''),
    apply:async(a,ctx,{idempotencyKey})=>{
      const v=await (await client(ctx)).radar.valueLists.create({
        name:a.name,alias:a.alias,item_type:a.itemType},{idempotencyKey});
      if(!listId(v?.id)||v.object!=='radar.value_list'||
        v.livemode!==(modeOf(ctx)==='live'))
        invalid('Radar value list creation identity unavailable');
      createdId=v.id;
    },
    readAfter:async(_a,ctx)=>createdId?
      (await client(ctx)).radar.valueLists.retrieve(createdId):null,
    verify:(_b,a,args,ctx)=>!!createdId&&a?.id===createdId&&
      valueListSafe(a,modeOf(ctx)).alias===args.alias&&a.name===args.name&&
      a.item_type===args.itemType
  });
}
const approve=makeRadarApprove(),create=makeRadarListCreate();
const control={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128},
  previewFingerprint:{type:'string',maxLength:64}};
export const tools=[
  {...approve.tool,area:'risk',profiles:fullProfiles,safety:'C',
    description:'Approve an open fraud review with guarded confirmation and payment ownership check.',
    annotations:{destructiveHint:true},
    inputSchema:{type:'object',properties:{...reviewProps,...control},
      required:['reviewId'],additionalProperties:false}},
  {...create.tool,area:'risk',profiles:fullProfiles,
    description:'Create a new verified Radar value list with safe alias and type.',
    inputSchema:{type:'object',properties:{...listProps,...control},
      required:['name','alias','itemType'],additionalProperties:false}}
];
const withCustomer=(ctx)=>({...ctx,getCustomer:async id=>
  (await client(ctx)).customers.retrieve(id)});
export const handlers={
  radar_approve_review:(a,ctx)=>makeRadarApprove().handler(a,withCustomer(ctx)),
  radar_create_value_list:(a,ctx)=>makeRadarListCreate().handler(a,ctx)
};
