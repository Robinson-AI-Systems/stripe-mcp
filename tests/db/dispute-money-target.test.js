import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery} from '../../test/helpers/pg-neon-adapter.js';
let db;
const account='acct_DISPUTEPG',target='du_DISPUTEPG';
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await db.saveTestKey({account,label:'Test',ciphertext:'cipher-fixture',
    kind:'restricted',last4:'FAKE'});
});
afterAll(async()=>await closeIsolatedSchema());
describe('G-2d2 exact dispute target SQL account money approval',()=>{
  it('admits validated du_ target and binds tool, target, cents, account and grant',async()=>{
    const input={account,idempotencyKey:'dispute-safe-once',tool:'dispute_accept',
      description:'Irreversible acceptance of TEST dispute '+target,
      amountCents:8500,currency:'usd',target,mode:'test'};
    expect(await db.requestMoneyApproval(input)).toBe(true);
    expect(await db.requestMoneyApproval({...input,target:'du_OTHERPG'})).toBe(false);
    expect(await db.requestMoneyApproval({...input,amountCents:8501})).toBe(false);
    expect(await db.requestMoneyApproval({...input,tool:'dispute_submit_evidence'})).toBe(false);
    expect((await db.reserveMoneyOut({account,connection:'first',
      idempotencyKey:input.idempotencyKey,amountCents:8500,currency:'usd'})).decision)
      .toBe('owner_approval_required');
    expect(await db.approveMoneyRequest({account,idempotencyKey:input.idempotencyKey}))
      .toBe(true);
    const attempts=await Promise.all(['first','second'].map(connection=>
      db.reserveMoneyOut({account,connection,
        idempotencyKey:input.idempotencyKey,amountCents:8500,currency:'usd'})));
    expect(attempts.map(x=>x.decision).sort()).toEqual(['already_reserved','reserved']);
  });
  it('rejects malformed dispute target, duplicate grant binding and unsupported currency',async()=>{
    const base={account,idempotencyKey:'invalid-target',tool:'dispute_accept',
      description:'TEST dispute',amountCents:100,currency:'usd',mode:'test'};
    await expect(db.requestMoneyApproval({...base,target:'du_!'})).rejects.toThrow();
    await expect(db.requestMoneyApproval({...base,target:'du_'})).rejects.toThrow();
    await expect(db.requestMoneyApproval({...base,target:'du_VALID',currency:'eur'})).rejects.toThrow();
  });
});
