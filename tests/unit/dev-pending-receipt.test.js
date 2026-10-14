import {describe,expect,it} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {pendingTriggerReceipt} from '../../src/dev/trigger-pending-receipt.js';
const account='acct_PENDING123';
const args={type:'customer.created',requestKey:'incomplete-provider-attempt',confirm:true};
const plan=planTrigger(args,account);
const parse=x=>JSON.parse(x.content[0].text);
function fixture(){
  const run={id:plan.runId,stripe_account:account,
    request_key:args.requestKey,plan_digest:plan.planDigest,
    scenario:plan.scenario,status:'running',size:1};
  const rows=[{step_name:'customer_1',object_type:'customer',
    object_id:'cus_PENDING123',cleaned:false}];
  const response={content:[{type:'text',text:JSON.stringify({
    done:false,confirmed:false,idempotencyKey:'rmcp_dev_trigger_event_SAFE123',
    warning:'Provider outcome unverified'
  })}]};
  let lookups=0;
  const ctx={connection:{mode:'test',stripeAccount:account,profile:'full'},
    db:{getDevRun:async({account:a,requestKey})=>{
      lookups++;return a===account&&requestKey===run.request_key?run:null;},
    getDevRunObjects:async({account:a,id})=>{
      lookups++;return a===account&&id===run.id?rows:null;}}};
  return {run,rows,response,ctx,lookups:()=>lookups};
}
describe('guarded incomplete TEST trigger run receipt',()=>{
  it('recovers a durable original-run ID without treating the attempted write as successful',async()=>{
    const f=fixture(),after=await pendingTriggerReceipt(args,f.ctx,f.response);
    expect(parse(after)).toMatchObject({done:false,confirmed:false,
      pendingRunId:plan.runId,pendingRunStatus:'running',recordedSteps:1,
      recoveryTool:'dev_inspect_incomplete_run'});
    expect(parse(after)).not.toHaveProperty('resourceId');
    expect(f.lookups()).toBe(2);
    expect(parse(f.response)).not.toHaveProperty('pendingRunId');
  });
  it('denies previews, unconfirmed requests, rejected auth and LIVE without ledger lookup',async()=>{
    for(const variant of ['preview','not_confirmed','is_error','live',
      'confirmed_success','missing_idempotency']){
      const f=fixture(),a={...args},r={...f.response};
      if(variant==='preview')a.dryRun=true;
      if(variant==='not_confirmed')a.confirm=false;
      if(variant==='is_error')r.isError=true;
      if(variant==='live')f.ctx.connection.mode='live';
      if(variant==='confirmed_success')r.content=[{type:'text',
        text:JSON.stringify({done:true,confirmed:true,resourceId:'run_SAFE'})}];
      if(variant==='missing_idempotency')r.content=[{type:'text',
        text:JSON.stringify({done:false,confirmed:false})}];
      const result=await pendingTriggerReceipt(a,f.ctx,r);
      expect(result,variant).toBe(r);
      expect(f.lookups(),variant).toBe(0);
    }
  });
  it('does not reveal a forged or different selected-account run ID',async()=>{
    for(const field of ['stripe_account','plan_digest','scenario','status',
      'request_key','size']){
      const f=fixture(),old=f.run[field];
      f.run[field]=field==='status'?'completed':
        field==='size'?2:field==='stripe_account'?'acct_FOREIGN123':'tampered';
      expect(await pendingTriggerReceipt(args,f.ctx,f.response),field)
        .toBe(f.response);
      expect(f.run[field]).not.toBe(old);
    }
  });
  it('fails closed on extra or duplicate steps, forged provider IDs and cleaned shape',async()=>{
    for(const fault of ['duplicate','unexpected','invalid_id','bad_cleaned','zero']){
      const f=fixture();
      if(fault==='duplicate')f.rows.push({...f.rows[0]});
      if(fault==='unexpected')f.rows[0].step_name='payment_intent_1';
      if(fault==='invalid_id')f.rows[0].object_id='sk_test_NOT_A_RESOURCE';
      if(fault==='bad_cleaned')f.rows[0].cleaned='yes';
      if(fault==='zero')f.rows.pop();
      expect(await pendingTriggerReceipt(args,f.ctx,f.response),fault)
        .toBe(f.response);
    }
  });
  it('returns the original response when the durable ledger refuses the read',async()=>{
    const f=fixture();
    f.ctx.db.getDevRun=async()=>{throw Error('secret DB credentials');};
    const after=await pendingTriggerReceipt(args,f.ctx,f.response);
    expect(after).toBe(f.response);
    expect(JSON.stringify(after)).not.toContain('secret DB credentials');
  });
});
