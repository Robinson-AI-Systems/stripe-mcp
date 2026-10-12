import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeMethodPreferenceWrite,handlers,tools} from '../../src/tools/account-payment-settings-write.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const id='pmc_TESTOWN',acct='acct_safefixture';
const parse=r=>JSON.parse(r.content[0].text);
const method=preference=>({available:true,
  display_preference:{preference,value:preference}});
function fixture({direct=true,readBackMatches=true,appOwned=false,identityLivemode=false}={}){
  const db=createFakeDb({accounts:[{id:acct,label:'Fixture',money_limit_cents:50000}]});
  const provider={writes:[],retrieves:0,afterCalls:0};
  let record={id,object:'payment_method_configuration',active:true,livemode:false,
    parent:direct?null:'pmc_PARENT',metadata:appOwned?{agreementId:'ag_TEST'}:{},card:method('on'),
    us_bank_account:method('off')};
  const stripe={accounts:{retrieve:async()=>({object:'account',id:acct,livemode:identityLivemode==='missing'?undefined:identityLivemode})},
    paymentMethodConfigurations:{
      retrieve:async()=>{provider.retrieves++;if(provider.writes.length)provider.afterCalls++;return record;},
      update:async(k,p,opts)=>{
        provider.writes.push({id:k,params:p,idempotencyKey:opts.idempotencyKey});
        if(readBackMatches)record={...record,us_bank_account:method(p.us_bank_account.display_preference.preference)};
        return record;
      }
    }};
  const ctx={db,connection:{mode:'test',profile:'full',stripeAccount:acct},
    connectionId:'G5c-preference-test',services:{stripeForConnection:async()=>stripe}};
  return {db,provider,ctx,stripe};
}
const args={configuration:id,method:'us_bank_account',preference:'on'};
describe('G-5c2 independent guarded payment settings writes',()=>{
  runWriteContract({withMoney:false,strictArgs:true,args,
    tool:makeMethodPreferenceWrite,fixtures:fixture});
  it('uses guarded write metadata and exact registry full-only permission',()=>{
    expect(tools[0]).toMatchObject({writes:true,profiles:['full'],
      name:'account_update_payment_method_settings',writeContract:'defineWrite-v1'});
    expect(registry.tools.filter(x=>x.name===tools[0].name)).toHaveLength(1);
  });
  it('refuses Connect child, foreign identity, LIVE and unknown method before writes',async()=>{
    const child=fixture({direct:false});
    await expect(handlers.account_update_payment_method_settings(args,child.ctx)).rejects.toThrow();
    expect(child.provider.writes).toHaveLength(0);
    const f=fixture();
    for(const a of [{...args,method:'bitcoin'},{...args,configuration:'pmc_!'}]){
      await expect(handlers.account_update_payment_method_settings(a,f.ctx)).rejects.toThrow();
    }
    const live={...f.ctx,connection:{...f.ctx.connection,mode:'live'}};
    expect((await handlers.account_update_payment_method_settings(args,live)).isError)
      .toBe(true);
    expect(f.provider.writes).toHaveLength(0);
  });
  it('never plans or writes against unknown provider TEST mode',async()=>{
    for(const identityLivemode of ['missing',null,'false']){
      const f=fixture({identityLivemode});
      await expect(handlers.account_update_payment_method_settings({...args,
        confirm:true},f.ctx)).rejects.toThrow();
      expect(f.provider.writes).toHaveLength(0);
    }
  });
  it('does not assert success when readback stays off',async()=>{
    const f=fixture({readBackMatches:false});
    const r=parse(await handlers.account_update_payment_method_settings({...args,
      confirm:true},f.ctx));
    expect(r.done).toBe(false);
    expect(r.verified).toBe(false);
    expect(r.verifyWith).toBe('account_list_payment_method_settings');
  });
  it('strips account secrets from preview and neither infers actual ACH availability',async()=>{
    const f=fixture();
    const preview=await handlers.account_update_payment_method_settings(args,f.ctx);
    expect(JSON.stringify(preview)).not.toMatch(/sk_test|client_secret/);
    expect(f.provider.writes).toHaveLength(0);
  });
});
