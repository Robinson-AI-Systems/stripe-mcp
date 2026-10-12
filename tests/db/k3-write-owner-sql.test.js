// Authentically integrated Stripe write -> atomic SQL money owner approval.
// Synthetic only. This suite is run with and without private core overlay.
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb} from '../../src/db.js';
import {defineWrite} from '../../src/tools/write.js';
import {idempotencyKey} from '../../src/stripe/client.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db;
const account='acct_WRITEPG',other='acct_WRITEOTHER';
const connection={stripeAccount:account,mode:'test',profile:'full'};
const ctx={connection,connectionId:'k3-client-a',get db(){return db;}};
const read=(r)=>JSON.parse(r.content[0].text);
const intentId=s=>('A'.repeat(32)+s).slice(0,48);
function operation(cents,labels){
  return defineWrite({name:'stripe_test_refund',
    read:async()=>({cents}),summarize:async()=> 'Synthetic verified TEST balance.',
    money:async(_args,_ctx,b)=>({amountCents:b.cents,currency:'usd',
      targetId:'ch_FAKE123456',direction:'out',description:'Synthetic verified refund'}),
    apply:async()=>{labels.writes++;},
    readAfter:async()=>({status:'refunded'}),
    verify:async(_b,a)=>a.status==='refunded'});
}
async function approvedInput(op,input,{override=false}={}){
  const key=idempotencyKey(connection,op.tool.name,input);
  const kind=override?'override':'approve';
  const id=intentId(input.requestKey+kind);
  expect(await db.requestMoneyDecisionIntent({id,account,idempotencyKey:key,kind,
    expiresAt:new Date(Date.now()+300000)})).toBe(true);
  expect(await db.consumeMoneyDecisionIntent(id)).toBe(true);
  return key;
}
beforeAll(async()=>{
  const uri=process.env.TEST_DATABASE_URL;
  if(!uri||new URL(uri).hostname!=='127.0.0.1')throw Error('Disposable local SQL only');
  await openIsolatedSchema(uri);
  db=createDb(neonShapedQuery());await db.initSchema();
  for(const id of [account,other])
    await db.saveTestKey({account:id,label:id,ciphertext:'v1.fake',
      kind:'restricted',last4:'FAKE'});
});
afterAll(async()=>await closeIsolatedSchema());
describe('source-owned money approval and guarded portable write across original SQL',()=>{
  it('requires separately authenticated exact-transaction owner action before any provider apply',async()=>{
    const labels={writes:0},op=operation(125,labels),input={confirm:true,requestKey:'under-cap'};
    expect(read(await op.handler(input,ctx)).error).toMatch(/explicit approval/);
    expect(labels.writes).toBe(0);
    await approvedInput(op,input);
    const result=read(await op.handler(input,ctx));
    expect(result).toMatchObject({done:true,confirmed:true});
    expect(labels.writes).toBe(1);
    expect(BigInt((await db.getMoneyUsage({account,connection:'k3-client-a'})).used_cents)).toBe(125n);
    const otherCtx={...ctx,connection:{...connection,stripeAccount:other}};
    expect(read(await op.handler(input,otherCtx)).done).toBe(false);
    expect(labels.writes).toBe(1);
  });
  it('needs a distinct independent override above shared $500 Colorado-day cap',async()=>{
    const labels={writes:0},op=operation(50001,labels),input={confirm:true,requestKey:'over-cap'};
    expect(read(await op.handler(input,ctx)).done).toBe(false);
    await approvedInput(op,input);
    expect(read(await op.handler(input,ctx)).error).toMatch(/override/i);
    expect(labels.writes).toBe(0);
    await approvedInput(op,input,{override:true});
    expect(read(await op.handler(input,ctx)).done).toBe(true);
    expect(labels.writes).toBe(1);
    expect(read(await op.handler(input,{...ctx,connection:{...connection,mode:'live'}})).done)
      .toBe(false);
  });
});
