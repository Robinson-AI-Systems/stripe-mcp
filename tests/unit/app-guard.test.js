import { describe, expect, it } from 'vitest';
import { defineWrite } from '../../src/tools/write.js';
import { idempotencyKey } from '../../src/stripe/client.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { findAppOwnership, protectAppOwnedTarget, annotateAppRead, APP_METADATA_KEYS } from
  '../../src/tools/app-guard.js';
const unpack = r => JSON.parse(r.content[0].text);

function fixture({before,refund=false,ctxExtras={}}={}) {
  const db=createFakeDb({accounts:[{id:'acct_APP_SAFE',label:'Fixture',money_limit_cents:50000}]});
  const calls={written:0};
  const ctx={db,connection:{stripeAccount:'acct_APP_SAFE',mode:'test',profile:'full'},
    connectionId:'owner-app-guard',...ctxExtras};
  const op=defineWrite({
    name:refund?'stripe_refund_app_fixture':'stripe_update_app_fixture',
    appOwnedRefundAllowed:refund,
    read:async()=>before,
    summarize:async()=> 'Update isolated Stripe fixture. TEST MODE.',
    money:refund?async(_args,_ctx,b)=>({amountCents:b.refundableCents,
      currency:'usd',direction:'out',description:'Refund app-owned fake charge'}):undefined,
    apply:async()=>{calls.written++;},
    readAfter:async()=>({done:true}),
    verify:async(_a,b)=>b.done===true
  });
  return {op,ctx,db,calls};
}
describe('B-3 default-deny app ownership guard',()=>{
  it('uses the metadata set published for the rental app',()=>{
    for(const key of ['agreementId','rentalLineId','rdf_record_id','rateVersionId']){
      expect(APP_METADATA_KEYS).toContain(key);
    }
  });
  it('blocks an app-owned subscription with agreement ID and recommended app screen',async()=>{
    const x=fixture({before:{id:'sub_APP',metadata:{agreementId:'agr_123'}}});
    const answer=unpack(await x.op.handler({confirm:true},x.ctx));
    expect(answer.done).toBe(false);
    expect(answer.reason).toContain('agr_123');
    expect(answer.reason).toContain('/desk/rentals');
    expect(x.calls.written).toBe(0);
    expect(await x.db.listAuditForTest()).toHaveLength(0);
  });
  it('allows explicit outsideApp override only after ordinary confirmation',async()=>{
    const x=fixture({before:{id:'sub_APP',metadata:{agreementId:'agr_123'}}});
    expect(unpack(await x.op.handler({outsideApp:true},x.ctx)).done).toBe(false);
    expect(x.calls.written).toBe(0);
    const answer=unpack(await x.op.handler({outsideApp:true,confirm:true},x.ctx));
    expect(answer.done).toBe(true);
    expect(x.calls.written).toBe(1);
  });
  it('inherits ownership from Stripe customer metadata, even if target metadata is empty',async()=>{
    let lookedUp=0;
    const x=fixture({before:{id:'sub_CHILD',metadata:{},customer:'cus_APP_123'},ctxExtras:{
      getCustomer:async id=>{lookedUp++;expect(id).toBe('cus_APP_123');
        return {id,metadata:{agreementId:'agr_customer'}};}
    }});
    const answer=unpack(await x.op.handler({confirm:true},x.ctx));
    expect(answer.done).toBe(false);
    expect(answer.reason).toContain('agr_customer');
    expect(lookedUp).toBe(1);
    expect(x.calls.written).toBe(0);
  });
  it('refuses missing or failed customer ownership lookup instead of permitting a write',async()=>{
    const before={id:'sub_UNKNOWN',metadata:{},customer:'cus_APP_123'};
    const absent=fixture({before});
    expect(unpack(await absent.op.handler({confirm:true},absent.ctx)).reason)
      .toMatch(/ownership lookup is unavailable/);
    expect(absent.calls.written).toBe(0);
    const failed=fixture({before,ctxExtras:{getCustomer:async()=>{throw Error('network')}}});
    expect(unpack(await failed.op.handler({outsideApp:true,confirm:true},failed.ctx)).reason)
      .toMatch(/verification failed/);
    expect(failed.calls.written).toBe(0);
  });
  it('permits an app-owned refund with warning only after separate money owner approval',async()=>{
    const x=fixture({refund:true,before:{id:'ch_APP',metadata:{agreementId:'agr_333'},
      refundableCents:2900}});
    const input={confirm:true,requestKey:'refund-owned'};
    const preview=unpack(await x.op.handler({...input,dryRun:true},x.ctx));
    expect(preview.preview).toContain('The rental app will see this refund and record it.');
    const denied=unpack(await x.op.handler(input,x.ctx));
    expect(denied.error).toMatch(/explicit approval/);
    expect(x.calls.written).toBe(0);
    const key=idempotencyKey(x.ctx.connection,x.op.tool.name,input);
    expect(await x.db.approveMoneyRequest({account:x.ctx.connection.stripeAccount,
      idempotencyKey:key})).toBe(true);
    const result=unpack(await x.op.handler(input,x.ctx));
    expect(result.confirmed).toBe(true);
    expect(x.calls.written).toBe(1);
  });
  it('marks app-owned read results without blocking reads or mutating input',async()=>{
    const source={id:'sub_1',metadata:{agreementId:'agr_read'},customer:null};
    const annotated=await annotateAppRead(source);
    expect(annotated.appRecord).toMatchObject({agreementId:'agr_read',app:'Robinson Appliance Rentals'});
    expect(source.appRecord).toBeUndefined();
    expect((await findAppOwnership({id:'sub_2',metadata:{unrelated:'yes'}}))).toBeNull();
    expect(await protectAppOwnedTarget({}, {},{id:'sub_2',metadata:{unrelated:'yes'}})).toBe(true);
  });
  it('prevents claiming the refund exception on a non-money tool',()=>{
    expect(()=>defineWrite({name:'stripe_bad_refund',appOwnedRefundAllowed:true}))
      .toThrow(/money contract/);
  });
});
