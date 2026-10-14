import {describe, expect, it} from 'vitest';
import {defineWrite} from '../../src/tools/write.js';

describe('safe optional verified resource ID contract',()=>{
  it('rejects nonfunction hooks during registration',()=>{
    expect(()=>defineWrite({name:'stripe_bad_receipt',read:async()=>({}),
      summarize:async()=> 'TEST MODE preview',apply:async()=>{},
      readAfter:async()=>({}),verify:async()=>true,resultId:'unsafe'}))
      .toThrow(/must be a function/);
  });
  it('does not export arbitrary provider text or ID until verification and audit',async()=>{
    let verified=true;
    const f=()=>defineWrite({name:'stripe_resource_receipt',read:async()=>({}),
      summarize:async()=> 'TEST MODE safe operation',
      apply:async()=>{},readAfter:async()=>({id:'cus_RECEIPT123',email:'private@example.com'}),
      verify:async()=>verified,resultId:(_before,after)=>after.id});
    const ctx={connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'},
      db:{recordChange:async()=>1}};
    const op=f();
    const parse=r=>JSON.parse(r.content[0].text);
    expect(parse(await op.handler({dryRun:true},ctx)).resourceId).toBeUndefined();
    const done=parse(await op.handler({confirm:true,requestKey:'receipt-valid'},ctx));
    expect(done.resourceId).toBe('cus_RECEIPT123');
    expect(JSON.stringify(done)).not.toContain('private@example.com');
    verified=false;
    expect(parse(await op.handler({confirm:true,requestKey:'receipt-unverified'},ctx))
      .resourceId).toBeUndefined();
  });
  it('keeps confirmed provider state truthful when a receipt is unsafe',async()=>{
    const op=defineWrite({name:'stripe_unsafe_receipt',read:async()=>({}),
      summarize:async()=> 'TEST MODE safe operation',apply:async()=>{},
      readAfter:async()=>({id:'sk_test_private'}),verify:async()=>true,
      resultId:(_before,after)=>after.id});
    const ctx={connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'},
      db:{recordChange:async()=>1}};
    const res=JSON.parse((await op.handler({confirm:true,requestKey:'unsafe-receipt'},ctx)).content[0].text);
    expect(res.done).toBe(true);
    expect(res.resourceId).toBeUndefined();
    expect(res.warning).toMatch(/safe resource ID is unavailable/);
  });
});
