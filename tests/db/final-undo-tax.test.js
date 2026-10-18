import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db;const account='acct_UNDOA123',other='acct_UNDOB123';
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw new Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  for(const id of [account,other])await db.saveTestKey({
    account:id,label:'Undone only in isolated schema',
    ciphertext:'fake-'+id,kind:'restricted',last4:'FAKE'});
});
afterAll(async()=>closeIsolatedSchema());
const inverse={version:1,tool:'product_unarchive',args:{productId:'prod_TEST123'},
  readTool:'product_get',readArgs:{productId:'prod_TEST123'},
  expected:{active:false},restored:{active:true}};
describe('X-1 durable atomic undo + E-4 Tax index',()=>{
  it('provides additive schema without storing provider tokens',async()=>{
    expect(SCHEMA_TABLES).toContain('tax_transaction_index');
    const rows=await rawQuery('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1',['tax_transaction_index']);
    expect(rows.map(x=>x.column_name)).toContain('transaction_id');
    expect(rows.map(x=>x.column_name)).not.toContain('api_key');
    await db.initSchema();
  });
  it('atomically claims the exact account/mode original change once even on concurrent requests',async()=>{
    const id=Number(await db.recordChange({account,mode:'test',tool:'product_archive',
      summary:'Fixture archived',inverse}));
    const first=await db.getUndoCandidate({account,mode:'test',id});
    expect(first.inverse).toEqual(inverse);
    expect(await db.getUndoCandidate({account:other,mode:'test',id})).toBeNull();
    const claims=await Promise.all(Array.from({length:4},()=>
      db.claimUndoCandidate({account,mode:'test',id})));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await db.claimUndoCandidate({account,mode:'test',id})).toBe(false);
    expect(await db.claimUndoCandidate({account,mode:'live',id})).toBe(false);
    const innerId=Number(await db.recordChange({account,mode:'test',
      tool:'product_unarchive',summary:'Fixture restored',inverse:{
        ...inverse,tool:'product_archive',expected:{active:true},
        restored:{active:false}}}));
    expect(await db.finishUndoCandidate({account:other,mode:'test',id,undoId:innerId}))
      .toBe(false);
    expect(await db.finishUndoCandidate({account,mode:'test',id,undoId:innerId}))
      .toBe(true);
    expect(await db.finishUndoCandidate({account,mode:'test',id,undoId:innerId}))
      .toBe(false);
    expect((await db.getUndoCandidate({account,mode:'test',id})).undone_by)
      .toBe(String(innerId));
  });
  it('refuses irreversible money and changes with no inverse',async()=>{
    const id=Number(await db.recordChange({account,mode:'test',tool:'money_create_payout',
      summary:'Synthetic money record',inverse,amountCents:100,currency:'usd',
      direction:'out'}));
    expect(await db.claimUndoCandidate({account,mode:'test',id})).toBe(false);
    const otherId=Number(await db.recordChange({account,mode:'test',tool:'customer_delete',
      summary:'Deleted synthetic customer'}));
    expect(await db.claimUndoCandidate({account,mode:'test',id:otherId}))
      .toBe(false);
  });
  it('only indexes provider-confirmed Tax transactions and scopes mode/account',async()=>{
    const x={account,mode:'test',transactionId:'tax_ABC123',reference:'taxref_123'};
    expect(await db.recordTaxTransactionIndex(x)).toBe(true);
    expect(await db.recordTaxTransactionIndex(x)).toBe(true);
    expect(await db.listTaxTransactionIndex({account,mode:'test'}))
      .toMatchObject([{transaction_id:'tax_ABC123',reference:'taxref_123'}]);
    expect(await db.listTaxTransactionIndex({account:other,mode:'test'})).toEqual([]);
    expect(await db.listTaxTransactionIndex({account,mode:'live'})).toEqual([]);
    await expect(db.recordTaxTransactionIndex({...x,transactionId:'tax_OTHER123'}))
      .rejects.toThrow();
  });
});
