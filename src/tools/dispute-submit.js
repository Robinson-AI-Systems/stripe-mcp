// G-2d1: final TEST dispute evidence submission is separate from draft saving.
// Preflight enumerates ALL staged evidence fields without revealing their text.
import {defineWrite,gone} from './write.js';
import {client,writeProfiles,validateFields,ref,local} from './billing-shared.js';
const id=(kind,v)=>typeof v==='string'&&new RegExp('^'+kind+'_[A-Za-z0-9]{2,100}$').test(v);
const invalid=message=>{throw new TypeError(message);};
const props={disputeId:{type:'string',pattern:'^du_[A-Za-z0-9]{2,100}$'},
  outsideApp:{type:'boolean'}};
function checkArgs(args){
  validateFields(args,props,['disputeId']);
  if(!id('du',args.disputeId))invalid('Exact dispute ID required');
}
async function preflight(args,ctx){
  checkArgs(args);
  const s=await client(ctx),d=await s.disputes.retrieve(args.disputeId),details=d?.evidence_details;
  if(d?.object!=='dispute'||d.id!==args.disputeId||d.livemode!==false||
    !['needs_response','warning_needs_response'].includes(d.status)||
    !Number.isSafeInteger(details?.due_by)||details.due_by<=Math.floor(Date.now()/1000)||
    details.past_due===true||details.submission_count!==0||
    !Number.isSafeInteger(d.amount)||d.amount<1||d.currency!=='usd')
    invalid('Only unsubmitted, unexpired USD TEST disputes can submit evidence');
  const chargeId=ref(d.charge);
  if(!id('ch',chargeId))invalid('Exact disputed charge is required');
  const charge=await s.charges.retrieve(chargeId);
  if(charge?.object!=='charge'||charge.id!==chargeId||charge.livemode!==false||
    charge.currency!==d.currency||!Number.isSafeInteger(charge.amount)||
    charge.amount<d.amount)
    invalid('Disputed charge identity or amount cannot be verified');
  // Never skip fields added in Dashboard: fail closed on unsupported structure.
  const evidence=d.evidence;
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||
    Object.keys(evidence).length>40)invalid('Full staged evidence inventory unavailable');
  const inventory=[];
  for(const [name,value] of Object.entries(evidence)){
    if(!/^[a-z][a-z0-9_]{0,70}$/.test(name))
      invalid('Unknown staged evidence field');
    if(value===null||value===undefined||value==='')continue;
    if(typeof value!=='string'||value.length>12000||!value.trim())
      invalid('Unsupported staged evidence data; review in Stripe Dashboard');
    const fileId=id('file',value)?value:null;
    if(fileId){
      const file=await s.files.retrieve(fileId);
      if(file?.object!=='file'||file.id!==fileId||file.purpose!=='dispute_evidence'||
        file.livemode===true||!Number.isSafeInteger(file.size)||
        file.size<1||file.size>10*1024*1024)
        invalid('Staged evidence file identity or purpose cannot be verified');
    }
    inventory.push(fileId?name+': file '+fileId:name+': text '+value.length+' chars');
  }
  if(inventory.length===0||details.has_evidence===false)
    invalid('Stage evidence before submitting the dispute');
  const summary='TEST ONLY. IRREVERSIBLE evidence submission for '+d.id+
    '; due '+local(details.due_by)+'; fields: '+inventory.join(', ')+
    '. Submit ONCE to issuing bank; not a draft and cannot be undone.';
  if(summary.length>1024)invalid('Evidence inventory too large for safe preview; review in Dashboard');
  return {...d,_summary:summary,charge:chargeId,
    metadata:{...(charge.metadata??{}),...(d.metadata??{})},customer:charge.customer??null};
}
export function makeDisputeSubmit(){
  return defineWrite({
    name:'dispute_submit_evidence',read:preflight,
    summarize:b=>b._summary,
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).disputes.update(a.disputeId,{submit:true},{idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).disputes.retrieve(a.disputeId),
    verify:(b,a)=>a?.object==='dispute'&&a.id===b.id&&a.livemode===false&&
      a.currency===b.currency&&a.amount===b.amount&&ref(a.charge)===b.charge&&
      ['under_review','warning_under_review'].includes(a.status)&&
      Number.isSafeInteger(a.evidence_details?.submission_count)&&
      a.evidence_details.submission_count>b.evidence_details.submission_count
  });
}
const op=makeDisputeSubmit();
export const tools=[{...op.tool,area:'disputes',profiles:writeProfiles,
  description:'Irreversibly submit staged TEST dispute evidence only after guarded confirmation.',
  annotations:{destructiveHint:true},
  inputSchema:{type:'object',properties:{...props,dryRun:{type:'boolean'},
    confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['disputeId'],additionalProperties:false}}];
export const handlers={dispute_submit_evidence:(a,ctx)=>
  ctx?.connection?.mode!=='test'?gone('Dispute evidence submission requires TEST mode'):
  makeDisputeSubmit().handler(a,{...ctx,
    getCustomer:async id=>(await client(ctx)).customers.retrieve(id)})};
