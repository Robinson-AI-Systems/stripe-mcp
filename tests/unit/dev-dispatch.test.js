// Verify actual developer write dispatch on MCP and stripe_call doors.
import {describe,it,expect} from 'vitest';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import * as ach from '../../src/tools/dev-ach-confirm.js';
import * as meta from '../../src/tools/meta.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_safefixture',runId='run_'+'a'.repeat(24);
const paymentId='pi_FAKE123',customerId='cus_FAKE123';
const args={runId,paymentStep:'payment_1',requestKey:'ach-dispatch'};
const result=x=>{try{return JSON.parse(x.content[0].text);}catch{return null;}};
function fixture(){
  const db=createFakeDb({accounts:[{id:account,label:'TEST'}]});
  db.getDevRunById=async({account:a,id})=>a===account&&id===runId?{
    id:runId,stripe_account:account,status:'completed',
    scenario:'ach-awaiting-confirmation',size:1}:null;
  db.getDevRunObjects=async({account:a,id})=>a===account&&id===runId?[
    {step_name:'customer_1',object_type:'customer',object_id:customerId,cleaned:false},
    {step_name:'payment_1',object_type:'payment_intent',object_id:paymentId,cleaned:false}
  ]:[];
  const calls={confirm:0,reads:0};
  let state='requires_confirmation';
  const sdk={
    customers:{retrieve:async id=>({id,object:'customer',metadata:{rtc_run:runId}})},
    paymentIntents:{
      retrieve:async id=>{
        calls.reads++;
        return {id,object:'payment_intent',livemode:false,
          metadata:{rtc_run:runId},customer:customerId,currency:'usd',
          amount:3600,amount_received:0,status:state,
          payment_method_types:['us_bank_account'],payment_method:'pm_usBankAccount'};
      },
      confirm:async (id,params,opts)=>{
        expect(id).toBe(paymentId);
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        expect(params.mandate_data.customer_acceptance.type).toBe('online');
        calls.confirm++;
        state='processing';
        return {id,object:'payment_intent',livemode:false,status:state};
      }
    }
  };
  const services={stripeForConnection:async()=>sdk};
  const registry={tools:[...ach.tools,...meta.tools],
    handlers:{...ach.handlers,...meta.handlers}};
  const connection={stripeAccount:account,mode:'test',
    profile:'full',resultScope:'ach-indirect'};
  const dispatch=(name,arguments_,override={})=>dispatchReadOnlyTool({
    registry,name,args:arguments_,connection:{...connection,...override},db,services
  });
  return {dispatch,calls,db,registry};
}
describe('developer writes use the same direct and indirect safety gates',()=>{
  it('lists and previews a guarded TEST write through the MCP dispatcher',async()=>{
    const f=fixture();
    const discovery=result(await f.dispatch('stripe_describe_tool',{
      name:'dev_confirm_seed_ach'}));
    expect(discovery.safety).toBe('GUARDED TEST WRITE');
    const preview=result(await f.dispatch('dev_confirm_seed_ach',{
      ...args,dryRun:true}));
    expect(preview.preview).toContain('TEST MODE');
    expect(preview.preview).toContain('$36.00');
    expect(f.calls.confirm).toBe(0);
  });
  it('runs actual guarded confirmation through stripe_call, not a bypass',async()=>{
    const f=fixture();
    const preview=result(await f.dispatch('stripe_call',{
      name:'dev_confirm_seed_ach',args}));
    expect(preview.needsConfirmation).toBe(true);
    expect(f.calls.confirm).toBe(0);
    const applied=result(await f.dispatch('stripe_call',{
      name:'dev_confirm_seed_ach',args:{...args,confirm:true}}));
    expect(applied.done).toBe(true);
    expect(f.calls.confirm).toBe(1);
  });
  it('refuses read_only and LIVE on both direct and indirect routes',async()=>{
    for(const c of [{profile:'read_only'},{mode:'live'}]){
      const f=fixture();
      for(const [name,value] of [
        ['dev_confirm_seed_ach',{...args,confirm:true}],
        ['stripe_call',{name:'dev_confirm_seed_ach',args:{...args,confirm:true}}]
      ]){
        const r=await f.dispatch(name,value,c);
        expect(r.isError).toBe(true);
      }
      expect(f.calls.confirm).toBe(0);
      expect(f.calls.reads).toBe(0);
    }
  });
  it('denies unguarded or fake-contract developer writes before handler',async()=>{
    const f=fixture();let called=0;
    for(const bad of [
      {name:'fake_developer',writes:true,profiles:['full'],area:'developer'},
      {name:'fake_developer',writes:true,profiles:['full'],area:'developer',
        writeContract:'legacy-no-guard'}
    ]){
      const registry={tools:[bad],handlers:{fake_developer:()=>{called++;}}};
      const r=await dispatchReadOnlyTool({registry,name:bad.name,
        args:{confirm:true},connection:{mode:'test',profile:'full'},db:f.db});
      expect(r.isError).toBe(true);
    }
    expect(called).toBe(0);
  });
  it('stripe_batch still rejects developer writes even with TEST confirmation',async()=>{
    const f=fixture();
    const r=await f.dispatch('stripe_batch',{calls:[{
      name:'dev_confirm_seed_ach',args:{...args,confirm:true}
    }]});
    expect(r.isError).toBe(true);
    expect(f.calls.confirm).toBe(0);
  });
});
