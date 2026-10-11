// G-2c: stage evidence in TEST without submitting to a bank.
// Safe provider read-back; no private evidence appears in the MCP response.
import {defineWrite,gone} from './write.js';
import {client,writeProfiles,validateFields,ref,local} from './billing-shared.js';
const id=(name,value)=>typeof value==='string'&&new RegExp(
  '^'+name+'_[A-Za-z0-9]{2,100}$').test(value);
const textFields=Object.freeze({
  productDescription:{field:'product_description',limit:500},
  shippingTrackingNumber:{field:'shipping_tracking_number',limit:200},
  uncategorizedText:{field:'uncategorized_text',limit:5000}
});
const fileFields=Object.freeze({
  receiptFileId:'receipt',customerCommunicationFileId:'customer_communication',
  shippingDocumentationFileId:'shipping_documentation',
  serviceDocumentationFileId:'service_documentation',
  uncategorizedFileId:'uncategorized_file'
});
const props={disputeId:{type:'string',pattern:'^du_[A-Za-z0-9]{2,100}$'},
  outsideApp:{type:'boolean'}};
for(const [name,rule] of Object.entries(textFields))
  props[name]={type:'string',minLength:1,maxLength:rule.limit};
for(const name of Object.keys(fileFields))
  props[name]={type:'string',pattern:'^file_[A-Za-z0-9]{2,100}$'};
const fields=Object.keys(textFields).concat(Object.keys(fileFields));
function invalid(message){throw new TypeError(message);}
function validate(args){
  validateFields(args,props,['disputeId']);
  if(!id('du',args.disputeId))invalid('Exact dispute ID required');
  if(!fields.some(k=>args[k]!==undefined))
    invalid('Provide at least one evidence field to stage');
  for(const [key,v] of Object.entries(args)){
    if(fields.includes(key)&&(!String(v).trim()||/[\0]/.test(v)))
      invalid('Evidence cannot be blank or contain NUL');
    if(fileFields[key]&&!id('file',v))invalid('Exact evidence file ID required');
  }
}
const mapFields=args=>Object.fromEntries([
  ...Object.entries(textFields).filter(([key])=>args[key]!==undefined)
    .map(([key,rule])=>[rule.field,args[key]]),
  ...Object.entries(fileFields).filter(([key])=>args[key]!==undefined)
    .map(([key,field])=>[field,args[key]])
]);
function target(d,idValue) {
  if(d?.object!=='dispute'||d.id!==idValue||d.livemode!==false||
    !['needs_response','warning_needs_response'].includes(d.status)||
    d.evidence_details?.past_due===true||
    !Number.isSafeInteger(d.evidence_details?.due_by)||
    d.evidence_details.due_by<=Math.floor(Date.now()/1000)||
    !Number.isSafeInteger(d.evidence_details?.submission_count)||
    d.evidence_details.submission_count!==0)
    invalid('Only unsubmitted TEST disputes before the evidence deadline may be drafted');
  return d;
}
export function makeDisputeDraft() {
  let staged=null;
  const operation=defineWrite({
    name:'dispute_save_evidence',
    read:async(a,ctx)=>{
      validate(a);
      const stripe=await client(ctx),d=target(
        await stripe.disputes.retrieve(a.disputeId),a.disputeId);
      const charge=ref(d.charge);
      if(!id('ch',charge))invalid('Verified dispute charge required');
      const payment=await stripe.charges.retrieve(charge);
      if(payment?.object!=='charge'||payment.id!==charge||
        payment.livemode===true)invalid('Dispute charge cannot be verified');
      for(const key of Object.keys(fileFields).filter(k=>a[k]!==undefined)){
        const f=await stripe.files.retrieve(a[key]);
        if(f?.object!=='file'||f.id!==a[key]||
          f.purpose!=='dispute_evidence'||f.livemode===true||
          !Number.isSafeInteger(f.size)||f.size<1||f.size>10*1024*1024)
          invalid('Uploaded TEST evidence file identity/purpose is invalid');
      }
      // Preserve both direct and charge/customer app ownership markers.
      return {...d,metadata:{...(payment.metadata??{}),...(d.metadata??{})},
        customer:payment.customer??null};
    },
    summarize:(before,a)=>{
      const selected=mapFields(a);
      const summaries=Object.entries(selected).map(([key,v])=>
        key+' ('+(key.endsWith('_file')||Object.values(fileFields).includes(key)?
          'verified file '+v:'text '+v.length+' characters')+')');
      return 'TEST ONLY. Save draft evidence for '+before.id+' (deadline '+
        local(before.evidence_details.due_by)+'), fields: '+summaries.join(', ')+
        '. Explicit submit:false; nothing is submitted to the bank.';
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const payload=mapFields(a);
      await (await client(ctx)).disputes.update(a.disputeId,{
        evidence:payload,submit:false},{idempotencyKey});
      staged=payload;
    },
    readAfter:async(a,ctx)=>
      (await client(ctx)).disputes.retrieve(a.disputeId),
    verify:(before,after)=>after?.object==='dispute'&&
      after.id===before.id&&after.livemode===false&&
      ['needs_response','warning_needs_response'].includes(after.status)&&
      after.evidence_details?.submission_count===0&&
      Object.entries(staged??{}).every(([key,v])=>
        (Object.values(fileFields).includes(key)?ref(after.evidence?.[key]):
          after.evidence?.[key])===v)
  });
  return {...operation,async handler(args,ctx){
    const result=await operation.handler(args,ctx);
    if(result?.isError||!staged)return result;
    const body=JSON.parse(result.content[0].text);
    if(body.confirmed!==true)return result;
    return {...result,content:[{type:'text',text:JSON.stringify({...body,
      disputeId:args.disputeId,draftFields:Object.keys(staged),
      evidenceSubmitted:false,needsBankSubmission:true})}]};
  }};
}
export const tools=[{...makeDisputeDraft().tool,area:'disputes',profiles:writeProfiles,
  description:'Stage TEST dispute evidence with submit:false, guarded preview and verified read-back.',
  inputSchema:{type:'object',properties:{...props,dryRun:{type:'boolean'},
    confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['disputeId'],additionalProperties:false}}];
export const handlers={dispute_save_evidence:(a,ctx)=>ctx?.connection?.mode!=='test'?
  gone('Dispute evidence drafts require TEST mode'):
  makeDisputeDraft().handler(a,{...ctx,
    getCustomer:async id=>(await client(ctx)).customers.retrieve(id)})};
