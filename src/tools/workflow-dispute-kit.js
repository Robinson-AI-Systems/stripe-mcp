// W-6: safe TEST dispute preparation and optional guarded draft stage.
// Never submit dispute evidence to a bank or disclose evidence text in output.
import {createHash} from 'node:crypto';
import {allProfiles,reply,fail} from './billing-shared.js';
import {nativeRead,collect,verifyContext,deadline,expired} from './workflow-read-common.js';
import {writable,nativeWrite,readyStep} from './workflow-customer-actions.js';

const disputeId={type:'string',pattern:'^du_[A-Za-z0-9]{2,100}$'};
const invoiceId={type:'string',pattern:'^in_[A-Za-z0-9]{2,100}$'};
const profileId={type:'string',pattern:'^[a-z][a-z0-9-]{2,63}$'};
const fields={
  productDescription:{type:'string',minLength:1,maxLength:500},
  shippingTrackingNumber:{type:'string',minLength:1,maxLength:200},
  uncategorizedText:{type:'string',minLength:1,maxLength:5000},
  receiptFileId:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'},
  customerCommunicationFileId:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'},
  shippingDocumentationFileId:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'},
  serviceDocumentationFileId:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'},
  uncategorizedFileId:{type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'}
};
const readFields={disputeId,invoiceId,app:profileId};
const writeFields={...readFields,evidence:{type:'object'},outsideApp:{type:'boolean'},
  dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:100},
  previewToken:{type:'string',pattern:'^[a-f0-9]{64}$'}};
export const tools=[
  {name:'workflow_dispute_kit',area:'workflows',profiles:allProfiles,writes:false,
    description:'Prepare verified TEST dispute deadline, charge, invoice and app agreement checklist without submission.',
    annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:readFields,
      required:['disputeId'],additionalProperties:false}},
  {name:'workflow_dispute_kit_save',area:'workflows',profiles:['everyday','full'],
    writes:true,writeContract:'defineWrite-v1',safety:'P',moneySpec:null,
    description:'Preview and stage only selected TEST dispute draft evidence through guarded native writer.',
    annotations:{destructiveHint:true},inputSchema:{type:'object',
      properties:writeFields,required:['disputeId','evidence'],additionalProperties:false}}
];
const du=/^du_[A-Za-z0-9]{2,100}$/,inv=/^in_[A-Za-z0-9]{2,100}$/;
function validate(a,write=false){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!(write?Object.keys(writeFields):Object.keys(readFields)).includes(k))||
    !du.test(a.disputeId??'')||
    (a.invoiceId!==undefined&&!inv.test(a.invoiceId))||
    (a.app!==undefined&&!/^[a-z][a-z0-9-]{2,63}$/.test(a.app)))
    throw new TypeError('Exact TEST dispute selection and documented inputs required');
  if(!write)return;
  if(!a.evidence||typeof a.evidence!=='object'||Array.isArray(a.evidence)||
    !Object.keys(a.evidence).length||
    Object.keys(a.evidence).some(k=>!Object.hasOwn(fields,k)))
    throw new TypeError('Only named draft evidence fields may be staged');
  for(const [key,value] of Object.entries(a.evidence)){
    const shape=fields[key];
    if(typeof value!=='string'||value.length<(shape.minLength??1)||
      value.length>(shape.maxLength??110)||!value.trim()||/[\u0000]/.test(value)||
      shape.pattern&&!new RegExp(shape.pattern).test(value))
      throw new TypeError('Invalid '+key+' draft input');
  }
  if(a.outsideApp!==undefined&&typeof a.outsideApp!=='boolean')
    throw new TypeError('Invalid app owner override');
  if(a.confirm===true&&(!a.previewToken||!a.requestKey||a.dryRun===true))
    throw new TypeError('A fresh preview and a stable requestKey are required');
}
const token=(account,facts,stage,preview)=>createHash('sha256')
  .update(JSON.stringify({account,workflow:'dispute-kit',facts,stage,preview}))
  .digest('hex');
async function examine(a,ctx){
  verifyContext(ctx);validate(a);
  const end=deadline(),gaps=[],missing=[];
  const dispute=await nativeRead('dispute_get',{disputeId:a.disputeId},ctx);
  if(dispute.id!==a.disputeId||dispute.currency!=='usd')
    throw new TypeError('Verified selected TEST USD dispute unavailable');
  const charge=dispute.charge?await nativeRead('charge_get',{chargeId:dispute.charge},ctx):null;
  if(!charge||charge.id!==dispute.charge||charge.currency!=='usd'||
    !Number.isSafeInteger(charge.amount)||charge.amount<dispute.amountMinor||
    !/^cus_[A-Za-z0-9]{2,100}$/.test(charge.customer??''))
    throw new TypeError('Original disputed charge/customer or amount cannot be verified');
  const customer=await nativeRead('customer_get',{customerId:charge.customer},ctx);
  if(customer.id!==charge.customer||customer.deleted===true)
    throw new TypeError('Original dispute customer is unavailable');
  let invoice=null;
  if(a.invoiceId){
    const payments=await collect('invoice_list_payments',
      {invoiceId:a.invoiceId,limit:100},ctx,{end});
    if(!payments.complete)gaps.push({section:'invoice_payment_link',reason:payments.reason});
    else if(!payments.data.some(x=>x.charge===charge.id||
      (charge.paymentIntent&&x.paymentIntent===charge.paymentIntent)))
      throw new TypeError('Selected invoice is not linked to disputed payment');
    else{
      const selected=await nativeRead('invoice_get',{invoiceId:a.invoiceId},ctx);
      if(selected.id!==a.invoiceId||selected.customer!==charge.customer)
        throw new TypeError('Selected invoice/customer association unavailable');
      invoice={id:selected.id,status:selected.status,currency:selected.currency,
        amountDueCents:selected.amount_due,amountPaidCents:selected.amount_paid};
    }
  }else{
    const invoices=await collect('invoice_list',
      {customerId:charge.customer,limit:100},ctx,{end});
    if(!invoices.complete)gaps.push({section:'customer_invoices',reason:invoices.reason});
    else{
      const linked=[];
      // Never infer invoice ownership from customer alone; verify allocated payment.
      if(invoices.data.length>10)gaps.push({section:'invoice_payment_links',
        reason:'more_than_10_invoices_select_exact_invoiceId'});
      else for(const item of invoices.data){
        const rows=await collect('invoice_list_payments',
          {invoiceId:item.id,limit:100},ctx,{end});
        if(!rows.complete){gaps.push({section:'invoice_payment_'+item.id,reason:rows.reason});break;}
        if(rows.data.some(x=>x.charge===charge.id||
          (charge.paymentIntent&&x.paymentIntent===charge.paymentIntent)))linked.push(item);
      }
      if(linked.length===1)invoice={id:linked[0].id,status:linked[0].status,
        currency:linked[0].currency,amountDueCents:linked[0].amount_due,
        amountPaidCents:linked[0].amount_paid};
      else if(linked.length>1)gaps.push({section:'invoice_match',
        reason:'multiple_linked_invoices_select_exact_invoiceId'});
    }
  }
  if(!invoice)missing.push('Verified invoice linked by allocated Stripe payment');
  let agreement=null;
  const marker=charge.metadata?.agreementId??customer.metadata?.agreementId;
  if(a.app&&typeof marker==='string'&&/^[A-Za-z0-9_-]{3,100}$/.test(marker)){
    try{const result=await nativeRead('project_record_link',
      {app:a.app,metadataKey:'agreementId',value:marker},ctx);
      if(result.verifiedAppRecord===false&&result.metadataKey==='agreementId'&&
        typeof result.url==='string'&&result.url.startsWith('https://'))
        agreement={url:result.url,source:'declared_app_route',verifiedDocument:false};
    }catch{gaps.push({section:'app_agreement_link',reason:'guarded_profile_route_unavailable'});}
  }
  if(!agreement)missing.push('Signed agreement: open verified app record and attach actual document');
  const expiredDue=dispute.evidenceDueUnix===null||
    dispute.evidenceDueUnix<=Math.floor(Date.now()/1000)||
    dispute.pastDue===true;
  if(!dispute.hasEvidence)missing.push('Supporting charge/receipt and customer communication evidence');
  if(expiredDue)missing.push('Deadline elapsed/unknown: bank response needs manual owner review');
  if(dispute.submissionCount>0)missing.push('Evidence previously submitted: never submit again automatically');
  return {account:ctx.connection.stripeAccount,mode:'test',complete:gaps.length===0&&!expired(end),
    gaps,dispute:{id:dispute.id,status:dispute.status,reason:dispute.reason,
      currency:dispute.currency,amountMinor:dispute.amountMinor,
      deadlineUnix:dispute.evidenceDueUnix,deadlineLocal:dispute.evidenceDueAt,
      daysLeft:dispute.daysLeft,submissionCount:dispute.submissionCount,
      needsResponse:dispute.needsResponse,pastDue:dispute.pastDue},
    charge:{id:charge.id,customerId:charge.customer,paymentIntent:charge.paymentIntent,
      amountMinor:charge.amount,currency:charge.currency},
    invoice,agreement,
    checklist:missing,canStageDraft:gaps.length===0&&
      !expiredDue&&dispute.needsResponse===true&&dispute.submissionCount===0,
    actualBankSubmission:false,submitAvailableOnlySeparately:true,
    note:'Never automatically submit, accept, or expose raw dispute evidence.'};
}
async function save(a,ctx){
  writable(ctx);validate(a,true);
  const observed=await examine({disputeId:a.disputeId,
    ...(a.invoiceId?{invoiceId:a.invoiceId}:{}),
    ...(a.app?{app:a.app}:{})},ctx);
  if(!observed.canStageDraft||!observed.complete)
    throw new TypeError('Original dispute has unmet staging prerequisites');
  const stage={disputeId:a.disputeId,...a.evidence,
    ...(a.outsideApp!==undefined?{outsideApp:a.outsideApp}:{})};
  const native=await readyStep('dispute_save_evidence',stage,ctx);
  const fingerprint=token(ctx.connection.stripeAccount,observed,stage,native.preview);
  const response={...observed,previewToken:fingerprint,stageFields:Object.keys(a.evidence),
    nativePreview:native.preview,done:false,needsConfirmation:true};
  if(a.confirm!==true)return response;
  if(fingerprint!==a.previewToken)
    throw new TypeError('Dispute evidence or provider state changed; preview again');
  try{
    const out=await nativeWrite('dispute_save_evidence',
      {...stage,confirm:true,requestKey:a.requestKey+':draft'},ctx);
    const passed=out.isError!==true&&out.value.done===true&&
      out.value.confirmed===true&&out.value.evidenceSubmitted===false;
    return {...response,needsConfirmation:false,done:passed,confirmed:passed,
      draftFields:passed?out.value.draftFields??Object.keys(a.evidence):[],
      warning:passed?null:'Native draft was denied or outcome is uncertain: inspect original audit; never retry automatically'};
  }catch{return {...response,needsConfirmation:false,done:false,confirmed:false,
    warning:'Native dispute stage returned uncertain outcome; inspect original audit before retry'};}
}
export const handlers={
  async workflow_dispute_kit(a,ctx){
    try{return reply(await examine(a,ctx));}catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  async workflow_dispute_kit_save(a,ctx){
    try{return reply(await save(a,ctx));}catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
