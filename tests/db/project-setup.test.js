import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {draftFromFindings} from '../../src/projects/setup.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_P4DB123',other='acct_P4OTHER123';
const plan={id:'p4-db-project',name:'P4 DB project',website:'https://p4.example.com',
  webhookEvents:[],metadataKeys:[],stripeCalls:[],checkoutModes:['payment'],
  paymentMethods:['card'],ownsCatalog:true,ownsTaxRates:true,
  keyPermissions:{read:[],write:[]},
  portalRules:{allow_cancel:false,allow_plan_switch:false,
    allow_payment_method_update:true,allow_invoice_history:true}};
let db;
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw new Error('Disposable local PostgreSQL required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'P4 DB',other,'P4 other']);
});
afterAll(async()=>closeIsolatedSchema());
describe('P-4 PostgreSQL transaction-safe project setup ledger',()=>{
  it('has additive, idempotent isolated schema and exact-account tenancy',async()=>{
    expect(SCHEMA_TABLES).toContain('project_setup_runs');
    await db.initSchema();
    expect(await db.getProjectSetupRun({account,id:plan.id})).toBeNull();
    expect(await db.getProjectSetupRun({account:other,id:plan.id})).toBeNull();
  });
  it('reserves once, refuses uncertain replay and mismatched plan, then confirms one step',async()=>{
    const digest='a'.repeat(64);
    const a={account,id:plan.id,digest,step:'portal'};
    expect(await db.reserveProjectSetupStep(a)).toMatchObject({newlyReserved:true});
    expect(await db.reserveProjectSetupStep(a)).toMatchObject({
      newlyReserved:false,state:'pending'});
    await expect(db.reserveProjectSetupStep({...a,digest:'b'.repeat(64)}))
      .rejects.toThrow(/changed/);
    const result=await db.completeProjectSetupStep({...a,
      resourceId:'bpc_VALID123',details:{kind:'portal'}});
    expect(result).toMatchObject({state:'done',resourceId:'bpc_VALID123'});
    expect(await db.reserveProjectSetupStep(a)).toMatchObject({
      newlyReserved:false,state:'done'});
    await expect(db.completeProjectSetupStep(a)).rejects.toThrow(/uniquely reserved/);
    expect(await db.getProjectSetupRun({account:other,id:plan.id})).toBeNull();
  });
  it('keeps a draft inactive and refuses same project with changed body',async()=>{
    const profile=draftFromFindings(plan).profile;
    const first=await db.createProjectDraft(profile);
    expect(first).toMatchObject({id:plan.id,status:'draft',version:1});
    expect(await db.createProjectDraft(profile)).toMatchObject({id:plan.id,status:'draft',version:1});
    expect(await db.listKnownAppsForAccount(account)).toEqual([]);
    await expect(db.createProjectDraft({...profile,name:'Different'}))
      .rejects.toThrow(/different plan/);
    const row=await rawQuery('SELECT status,version FROM known_apps WHERE id=$1',[plan.id]);
    expect(row).toEqual([{status:'draft',version:1}]);
  });
});
