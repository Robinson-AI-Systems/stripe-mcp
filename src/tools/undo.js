// X-1: a stored verified inverse is a proposal, NEVER permission to bypass
// the original guarded handler, account mode, profile, app or money policies.
import {defineWrite,gone} from './write.js';
import {isGuardedTestWrite,isGuardedLiveWrite} from '../core/profiles.js';

const schema={type:'object',properties:{
  changeId:{type:'integer',minimum:1,maximum:9007199254740991},
  dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:110}
},required:['changeId'],additionalProperties:false};
const possible={
  product_archive:'product_get',product_unarchive:'product_get',
  product_update:'product_get',price_update:'price_get',
  billing_cancel_subscription:'billing_get_subscription',
  billing_undo_cancel:'billing_get_subscription',
  billing_pause_collection:'billing_get_subscription',
  billing_resume_collection:'billing_get_subscription',
  webhook_add_events:'webhook_get',webhook_remove_events:'webhook_get',
  webhook_update:'webhook_get',customer_update:'customer_get'
};
const fail=m=>{throw new TypeError(m);};
const parsed=result=>{
  if(result?.isError||!Array.isArray(result?.content)||result.content.length!==1||
    result.content[0]?.type!=='text')fail('Original protected tool denied or could not be verified');
  let v;try{v=JSON.parse(result.content[0].text);}
  catch{fail('Tool produced no independently verifiable JSON');}
  if(v?.done===false&&v?.error||v?.confirmed===false)
    fail('Original protected tool refused the operation');
  return v;
};
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
function matches(state,expected){
  if(!expected||typeof expected!=='object'||Array.isArray(expected))return false;
  return Object.entries(expected).every(([field,wanted])=>{
    if(['__proto__','constructor','prototype'].includes(field))return false;
    return same(state?.[field],wanted);
  });
}
function validInverse(v){
  if(!v||v.version!==1||typeof v.tool!=='string'||
    !Object.hasOwn(possible,v.tool)||v.readTool!==possible[v.tool]||
    !v.args||typeof v.args!=='object'||Array.isArray(v.args)||
    !v.readArgs||typeof v.readArgs!=='object'||Array.isArray(v.readArgs)||
    !v.expected||!v.restored||Object.keys(v.expected).length<1||
    Object.keys(v.restored).length<1||
    JSON.stringify(v).length>3200)
    fail('No supported safe opposite exists; money movement, finalized invoices, deletions and submitted dispute evidence require separate corrective workflows');
  const allowed={product_archive:['productId'],product_unarchive:['productId'],
    product_update:['productId','metadata','name','description'],
    price_update:['priceId','nickname','lookupKey','metadata','active'],
    billing_cancel_subscription:['subscriptionId','timing'],
    billing_undo_cancel:['subscriptionId'],
    billing_pause_collection:['subscriptionId','behavior','resumesAt'],
    billing_resume_collection:['subscriptionId'],
    webhook_add_events:['endpointId','events'],
    webhook_remove_events:['endpointId','events'],
    webhook_update:['endpointId','url','description','enabledEvents','metadata'],
    customer_update:['customerId','metadata','name','description','email','phone','address']};
  if(Object.keys(v.args).some(k=>!allowed[v.tool]?.includes(k))||
    Object.keys(v.readArgs).some(k=>!['productId','priceId','subscriptionId',
      'endpointId','customerId','detail'].includes(k)))
    fail('Stored inverse contains an unapproved resource field');
  const inverseId=v.args.productId??v.args.priceId??v.args.subscriptionId??
    v.args.endpointId??v.args.customerId;
  const readId=v.readArgs.productId??v.readArgs.priceId??
    v.readArgs.subscriptionId??v.readArgs.endpointId??v.readArgs.customerId;
  if(typeof inverseId!=='string'||!inverseId||inverseId!==readId)
    fail('Stored inverse target does not match its readback target');
  return v;
}
async function view(v,ctx){
  const read=parsed(await ctx.runRead(v.readTool,v.readArgs));
  if(!matches(read,v.expected))
    fail('Original record changed since the logged mutation; an automatic undo would overwrite newer changes');
  return read;
}
function action(){
  let inverse=null,innerReceipt=null,claimMade=false,original=null;
  return defineWrite({
    name:'stripe_undo_change',
    resultId:null,
    read:async(args,ctx)=>{
      inverse=null;innerReceipt=null;claimMade=false;original=null;
      if(!Number.isSafeInteger(args?.changeId)||args.changeId<1||
        Object.keys(args).some(k=>!['changeId','dryRun','confirm','requestKey'].includes(k)))
        fail('A positive exact changeId and supported confirmation controls are required');
      if(typeof ctx.db?.getUndoCandidate!=='function'||
        typeof ctx.db?.claimUndoCandidate!=='function'||
        typeof ctx.db?.finishUndoCandidate!=='function')
        fail('Durable account-scoped undo ledger unavailable');
      const row=await ctx.db.getUndoCandidate({
        account:ctx.connection.stripeAccount,mode:ctx.connection.mode,id:args.changeId});
      if(!row||row.undone_by!==null||row.inverse===null||row.dry_run===true||
        row.amount_cents!==null&&row.amount_cents!==undefined||
        row.direction==='out'||row.direction==='in')
        fail('No reversible change found for this exact account and mode. For money, finalized invoices, deletions or submitted evidence, use a separate authorized corrective workflow');
      inverse=validInverse(row.inverse);original=row;
      const tool=ctx.registry?.tools?.find(t=>t.name===inverse.tool);
      const permitted=isGuardedTestWrite(tool,ctx.connection)||
        isGuardedLiveWrite(tool,ctx.connection);
      if(!permitted||tool?.writeContract!=='defineWrite-v1')
        fail('Inverse is outside this connection delegated permissions');
      return await view(inverse,ctx);
    },
    summarize:(_before,args,ctx)=>ctx.connection.mode.toUpperCase()+
      ' MODE: undo exactly logged change '+args.changeId+
      ' using original protected '+inverse.tool+' for '+
      String(Object.values(inverse.readArgs)[0]).slice(0,105)+
      '. Original mode, app ownership, provider preview, confirmation, idempotency and readback remain mandatory.'+
      ' Money, deletion and irreversible effects are not reversible.',
    targetGuard:async()=>true,
    apply:async(args,ctx)=>{
      // An atomic account+mode row claim prevents duplicate / concurrent undo,
      // even if the underlying Stripe retry key expires. Failures remain claimed
      // for manual reconciliation rather than risking a second provider mutation.
      const accepted=await ctx.db.claimUndoCandidate({
        account:ctx.connection.stripeAccount,mode:ctx.connection.mode,id:args.changeId});
      if(accepted!==true)fail('Change already claimed or undone; inspect before retrying');
      claimMade=true;
      // Only one nested write from this exact parent is allowed by the normal
      // dispatch boundary, and the original defineWrite does ALL safety checks.
      const reply=await ctx.runRead(inverse.tool,{
        ...inverse.args,confirm:true,dryRun:false,
        requestKey:'undo-'+args.changeId+'-'+(args.requestKey??'original')});
      innerReceipt=parsed(reply);
      if(innerReceipt.done!==true||innerReceipt.confirmed!==true||
        !Number.isSafeInteger(Number(innerReceipt.logged?.id)))
        fail('Original guarded handler did not confirm the reversal; claim remains reserved');
    },
    readAfter:async(_args,ctx)=>{
      if(!claimMade||innerReceipt?.done!==true)return null;
      return parsed(await ctx.runRead(inverse.readTool,inverse.readArgs));
    },
    verify:(_before,after)=>innerReceipt?.confirmed===true&&
      matches(after,inverse.restored),
    afterApply:async({ctx,args,status})=>{
      if(status==='confirmed'&&innerReceipt?.logged?.id){
        const finished=await ctx.db.finishUndoCandidate({
          account:ctx.connection.stripeAccount,mode:ctx.connection.mode,
          id:args.changeId,undoId:Number(innerReceipt.logged.id)});
        if(finished!==true)fail('Undo verified, but permanent original link is uncertain');
      }
    }
  });
}
export const tools=[{
  ...action().tool,name:'stripe_undo_change',area:'server',
  profiles:['everyday','full'],
  description:'Preview and confirm a verified clean inverse already recorded for this account; irreversible actions refuse.',
  inputSchema:schema,
  annotations:{destructiveHint:true}
}];
export const handlers={
  stripe_undo_change:(args,ctx)=>{
    if(!['test','live'].includes(ctx?.connection?.mode))return gone('Selected TEST/LIVE connection required');
    return action().handler(args,ctx);
  }
};
