// G-2a: expose only minimal, verified TEST dispute identity and response deadlines.
import {allProfiles,guarded,fail,local,pageResult,paging,ref} from './billing-shared.js';
const id=s=>typeof s==='string'&&/^dp_[A-Za-z0-9]{2,100}$/.test(s);
const validTime=s=>Number.isSafeInteger(s)&&s>=946684800&&s<=4102444800;
const failShape=s=>{throw new TypeError(s);};
export function disputeSafe(d,now=Date.now()) {
  if(d?.object!=='dispute'||!id(d.id)||d.livemode!==false||
     !Number.isSafeInteger(d.amount)||d.amount<0||
     !/^[a-z]{3}$/.test(d.currency)||!validTime(d.created)||
     !['warning_needs_response','warning_under_review','warning_closed',
       'needs_response','under_review','won','lost'].includes(d.status))
    failShape('Stripe TEST dispute metadata could not be verified');
  const due=d.evidence_details?.due_by??null;
  if(due!==null&&!validTime(due))failShape('Dispute evidence deadline invalid');
  const submission=d.evidence_details?.submission_count??0;
  if(!Number.isSafeInteger(submission)||submission<0||submission>100)
    failShape('Dispute submission count invalid');
  const charge=ref(d.charge),intent=ref(d.payment_intent);
  if((charge!==null&&!/^ch_[A-Za-z0-9]{2,100}$/.test(charge))||
     (intent!==null&&!/^pi_[A-Za-z0-9]{2,100}$/.test(intent)))
    failShape('Dispute payment target invalid');
  const needsResponse=['needs_response','warning_needs_response'].includes(d.status);
  const daysLeft=due===null?null:Math.ceil((due*1000-now)/86400000);
  return {id:d.id,charge,paymentIntent:intent,amountMinor:d.amount,
    currency:d.currency,status:d.status,reason:typeof d.reason==='string'&&
      /^[a-z_]{2,50}$/.test(d.reason)?d.reason:null,
    createdAt:local(d.created),evidenceDueAt:local(due),
    evidenceDueUnix:due,daysLeft,needsResponse,
    pastDue:d.evidence_details?.past_due===true,
    hasEvidence:d.evidence_details?.has_evidence===true,
    submissionCount:submission,
    evidenceFields:null,note:'Evidence contents and cardholder personal data are not returned.'};
}
const def=(name,description,props,required=[])=>({
  name,description,area:'disputes',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:props,required,additionalProperties:false}
});
const limit={type:'integer',minimum:1,maximum:100};
const cursor={type:'string',pattern:'^dp_[A-Za-z0-9]{2,100}$'};
export const tools=[
  def('dispute_list','List TEST disputes, status, amounts, and Colorado evidence deadlines.',
    {limit,starting_after:cursor}),
  def('dispute_get','Read one TEST dispute and response deadline without private evidence.',
    {disputeId:cursor},['disputeId'])
];
function validate(a,allowed,required=[]) {
  if(!a||typeof a!=='object'||Array.isArray(a)||
     Object.keys(a).some(k=>!allowed.includes(k))||
     required.some(k=>a[k]===undefined))
    failShape('Exact dispute read arguments required');
}
export const handlers={
  dispute_list:(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('Dispute reads require TEST mode'):guarded(ctx,async s=>{
      validate(a,['limit','starting_after']);
      if(a.starting_after!==undefined&&!id(a.starting_after))
        failShape('Invalid dispute cursor');
      return pageResult(await s.disputes.list(paging(a)),disputeSafe);
    }),
  dispute_get:(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('Dispute reads require TEST mode'):guarded(ctx,async s=>{
      validate(a,['disputeId'],['disputeId']);
      if(!id(a.disputeId))failShape('Exact dispute ID required');
      const dispute=await s.disputes.retrieve(a.disputeId);
      if(dispute?.id!==a.disputeId)failShape('Dispute identity mismatch');
      return disputeSafe(dispute);
    })
};
