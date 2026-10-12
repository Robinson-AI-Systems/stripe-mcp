import {describe,it,expect} from 'vitest';
import {tools,handlers} from '../../src/tools/account-apple-pay-domain-add.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const acct='acct_safefixture',domain='payments.example.com';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({duplicate=false,readBackMatches=true,foreign=false,denied=false,
  identityLivemode=false}={}){
  const provider={writes:[],retrieves:0};
  const initial={id:'pmd_FIXTURE',object:'payment_method_domain',domain_name:domain,
    enabled:true,livemode:false,apple_pay:{status:'pending'}};
  const sdk={
    accounts:{retrieve:async()=>({id:foreign?'acct_FOREIGN':acct,object:'account',livemode:identityLivemode})},
    paymentMethodDomains:{
      list:async()=>({object:'list',has_more:false,data:
        duplicate||provider.writes.length&&readBackMatches?[initial]:[]}),
      create:async(params,opts)=>{
        if(denied)throw {statusCode:403,code:'permission_denied'};
        provider.writes.push({params,idempotencyKey:opts.idempotencyKey});return initial;
      },
      retrieve:async()=>{provider.retrieves++;return initial;}
    }};
  const db=createFakeDb({accounts:[{id:acct,label:'Fake',money_limit_cents:50000}]});
  const ctx={db,connection:{mode:'test',profile:'full',stripeAccount:acct},
    connectionId:'domain-add-test',services:{stripeForConnection:async()=>sdk}};
  return {ctx,provider,sdk};
}
describe('G-5d2 TEST payment-method domain add',()=>{
  it('registers one guarded FULL-only tool using defineWrite contract',()=>{
    expect(tools[0]).toMatchObject({name:'account_add_apple_pay_domain',
      writes:true,profiles:['full'],writeContract:'defineWrite-v1'});
    expect(registry.tools.filter(x=>x.name===tools[0].name)).toHaveLength(1);
  });
  it('preview and missing confirm never create a provider domain',async()=>{
    const f=fixture();
    const preview=parse(await handlers.account_add_apple_pay_domain({domain,
      dryRun:true,confirm:true},f.ctx));
    expect(preview).toMatchObject({done:false,verified:false});
    expect(preview.preview).toContain('TEST MODE');
    const notConfirmed=parse(await handlers.account_add_apple_pay_domain({domain},f.ctx));
    expect(notConfirmed.needsConfirmation).toBe(true);
    expect(f.provider.writes).toHaveLength(0);
  });
  it('confirmed registration uses TEST native idempotent create and independent provider retrieve',async()=>{
    const f=fixture();
    const value=parse(await handlers.account_add_apple_pay_domain({
      domain,confirm:true,requestKey:'register-domain'},f.ctx));
    expect(value).toMatchObject({done:true,confirmed:true,
      verifyWith:'account_list_apple_pay_domains'});
    expect(value.note).toContain('not guaranteed');
    expect(f.provider.writes).toHaveLength(1);
    expect(f.provider.writes[0]).toMatchObject({params:{domain_name:domain,enabled:true},
      idempotencyKey:value.idempotencyKey});
    expect(f.provider.retrieves).toBe(1);
  });
  it('duplicate, foreign identity and invalid nonhost inputs never write',async()=>{
    const d=fixture({duplicate:true});
    await expect(handlers.account_add_apple_pay_domain({domain,confirm:true},d.ctx))
      .rejects.toThrow(/already registered/);
    expect(d.provider.writes).toHaveLength(0);
    const f=fixture({foreign:true});
    await expect(handlers.account_add_apple_pay_domain({domain,confirm:true},f.ctx))
      .rejects.toThrow();
    for(const bad of ['https://payments.example.com','payments.example.com/path',
      'a.localhost','A.Example.COM','evil.com:443','xn--spoof.example.com']){
      const v=fixture();
      await expect(handlers.account_add_apple_pay_domain({domain:bad,confirm:true},v.ctx))
        .rejects.toThrow();
      expect(v.provider.writes).toHaveLength(0);
    }
  });
  it('never creates a domain after missing/malformed provider TEST mode',async()=>{
    for(const identityLivemode of [undefined,null,'false']){
      const f=fixture({identityLivemode});
      await expect(handlers.account_add_apple_pay_domain({domain,confirm:true},f.ctx))
        .rejects.toThrow();
      expect(f.provider.writes).toHaveLength(0);
    }
  });
  it('unobserved provider result and refused permissions never report registration',async()=>{
    for(const v of [{readBackMatches:false},{denied:true}]){
      const f=fixture(v);
      const result=parse(await handlers.account_add_apple_pay_domain({domain,confirm:true},f.ctx));
      expect(result.done).toBe(false);
      expect(result.verified).toBe(false);
    }
  });
  it('LIVE never contacts provider',async()=>{
    const f=fixture();
    const r=await handlers.account_add_apple_pay_domain({domain,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(parse(r).done).toBe(false);
    expect(f.provider.writes).toHaveLength(0);
  });
});
