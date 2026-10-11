// V-1b4e: real guarded TEST ACH initiation; event and bank outcome are separate.
import {describe,it,expect} from 'vitest';
import {makeDevSeedAchConfirmWrite,handlers} from '../../src/tools/dev-ach-confirm.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_safefixture',runId='run_'+'a'.repeat(24);
const args={runId,paymentStep:'payment_1',requestKey:'ach-mandate-test'};
const parse=x=>JSON.parse(x.content[0].text);
function fixture({mode='test',status='requires_confirmation',readStatus='processing',
  accountMatch=true,changedAmount=false,readReceived=0,
  missing=false}={}){
  const db=createFakeDb({accounts:[{id:account,label:'Test',money_limit_cents:50000}]});
  const calls=[];
  const run={id:runId,stripe_account:accountMatch?account:'acct_OTHER123',
    scenario:'ach-awaiting-confirmation',size:1,status:'completed'};
  const rows=[
    {step_name:'payment_1',object_type:'payment_intent',
      object_id:'pi_FAKE123',cleaned:false},
    {step_name:'customer_1',object_type:'customer',
      object_id:'cus_FAKE123',cleaned:false}
  ];
  const original={id:'pi_FAKE123',object:'payment_intent',
    livemode:false,customer:'cus_FAKE123',metadata:{rtc_run:runId},
    currency:'usd',amount:3600,amount_received:0,
    status,payment_method_types:['us_bank_account'],
    payment_method:'pm_usBankAccount'};
  let current=original;
  const sdk={
    paymentIntents:{
      retrieve:async _id=>{calls.push('retrieve');return {...current,
        ...(changedAmount?{amount:3700}:{})};},
      confirm:async(id,p,o)=>{
        calls.push('confirm');
        if(id!=='pi_FAKE123'||!o?.idempotencyKey||
          p.payment_method!=='pm_usBankAccount'||
          p.mandate_data?.customer_acceptance?.type!=='online')
          throw new Error('Synthetic TEST mandate was not independently validated');
        current={...current,status:readStatus,amount_received:readReceived};
        return {...current};
      }
    },
    customers:{retrieve:async id=>({
      id,object:'customer',metadata:{rtc_run:runId},livemode:false
    })}
  };
  db.getDevRunById=async()=>missing?null:run;
  db.getDevRunObjects=async()=>rows;
  const ctx={connection:{stripeAccount:account,mode,profile:'full'},
    connectionId:'test-ach',db,services:{stripeForConnection:async()=>sdk},
    getCustomer:id=>sdk.customers.retrieve(id)};
  return {ctx,calls,run,rows,sdk};
}
describe('V-1b4e tracked synthetic TEST ACH confirmation contract',()=>{
  it('dryRun previews exact incoming synthetic debit and touches no provider writes',async()=>{
    const f=fixture(),op=makeDevSeedAchConfirmWrite();
    const v=parse(await op.handler({...args,dryRun:true},f.ctx));
    expect(v.preview).toContain('TEST MODE');
    expect(v.preview).toContain('$36.00');
    expect(f.calls).toEqual(['retrieve']);
  });
  it('does not initiate ACH before explicit confirmation',async()=>{
    const f=fixture(),op=makeDevSeedAchConfirmWrite();
    const v=parse(await op.handler(args,f.ctx));
    expect(v.needsConfirmation).toBe(true);
    expect(f.calls).toEqual(['retrieve']);
  });
  it('confirms an independently verified TEST processing transition, not settlement',async()=>{
    const f=fixture();
    const v=parse(await handlers.dev_confirm_seed_ach({...args,confirm:true},f.ctx));
    expect(v.done).toBe(true);
    expect(f.calls).toEqual(['retrieve','confirm','retrieve']);
    const audit=await f.ctx.db.listAuditForTest();
    expect(audit.some(x=>x.tool==='dev_confirm_seed_ach'&&x.dry_run===false)).toBe(true);
  });
  it('does not call a provider money transition successful when its cents do not match',async()=>{
    const f=fixture({readStatus:'succeeded',readReceived:0});
    const out=parse(await handlers.dev_confirm_seed_ach({...args,confirm:true},f.ctx));
    expect(out.done).toBe(false);
    expect(f.calls.filter(x=>x==='confirm')).toHaveLength(1);
  });
  it('can independently report a full Stripe provider success without claiming bank settlement',async()=>{
    const f=fixture({readStatus:'succeeded',readReceived:3600});
    const out=parse(await handlers.dev_confirm_seed_ach({...args,confirm:true},f.ctx));
    expect(out.done).toBe(true);
  });
  it('rejects foreign accounts, missing run and changed payment amount before confirmation',async()=>{
    for(const opts of [{accountMatch:false},{missing:true},{changedAmount:true}]){
      const f=fixture(opts);
      await expect(makeDevSeedAchConfirmWrite().handler({...args,confirm:true},f.ctx))
        .rejects.toThrow();
      expect(f.calls.filter(x=>x==='confirm')).toHaveLength(0);
    }
  });
  it('rejects an intent already processing and never recharges on rerun',async()=>{
    const f=fixture({status:'processing'});
    await expect(makeDevSeedAchConfirmWrite().handler({...args,confirm:true},f.ctx))
      .rejects.toThrow();
    expect(f.calls.filter(x=>x==='confirm')).toHaveLength(0);
  });
  it('refuses malformed payment step, wrong run and unknown properties',async()=>{
    for(const bad of [
      {...args,paymentStep:'payment_6'},
      {...args,runId:'run_wrong'},
      {...args,amountCents:1}
    ]){
      const f=fixture();
      await expect(makeDevSeedAchConfirmWrite().handler({...bad,confirm:true},f.ctx))
        .rejects.toThrow();
      expect(f.calls.filter(x=>x==='confirm')).toHaveLength(0);
    }
  });
  it('refuses LIVE without any Stripe or money ledger action',async()=>{
    const f=fixture({mode:'live'});
    const v=await handlers.dev_confirm_seed_ach({...args,confirm:true},f.ctx);
    expect(v.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('read_only profiles and missing audit database cannot confirm synthetic ACH',async()=>{
    const f=fixture();
    f.ctx.connection.profile='read_only';
    expect(parse(await makeDevSeedAchConfirmWrite().handler({...args,confirm:true},f.ctx))
      .done).toBe(false);
    f.ctx.connection.profile='full';f.ctx.db={};
    expect(parse(await makeDevSeedAchConfirmWrite().handler({...args,confirm:true},f.ctx))
      .done).toBe(false);
    expect(f.calls.filter(x=>x==='confirm')).toHaveLength(0);
  });
});
