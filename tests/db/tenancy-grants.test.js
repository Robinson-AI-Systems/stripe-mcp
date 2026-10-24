import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb} from '../../src/db.js';
import {hashToken} from '../../src/core/oauth.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery}
  from '../../test/helpers/pg-neon-adapter.js';

const alice={issuer:'https://accounts.identity.example',subject:'alice-789'};
const bob={issuer:'https://accounts.identity.example',subject:'bob-456'};
const admin={issuer:'https://accounts.identity.example',subject:'admin-333'};
const issuer='https://api.stripe.com',resource='https://api.stripe.com/v1/accounts';
let db,ta,tb;
const mine=(tenant,who=alice,revision=1,context='production')=>({
  tenantId:tenant.tenantId,identity:who,revision,context
});
const grant=(t=ta,who=alice)=>({
  ...mine(t,who),account:'acct_ALICE',mode:'test',kind:'stripe_app_oauth',
  providerIssuer:issuer,providerResource:resource
});

beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL is mandatory for tenant lifecycle tests');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await db.tenancy.initializeTables();
  ta=await db.tenancy.provisionTenant({verifiedIdentity:alice,label:'Tenant A'});
  tb=await db.tenancy.provisionTenant({verifiedIdentity:bob,label:'Tenant B'});
});
afterAll(async()=>{await closeIsolatedSchema();});

describe('CAP-3 real PostgreSQL isolated tenant and grant foundation',()=>{
  it('provisions separate owner memberships for two people without cross-tenant inheritance',async()=>{
    expect(ta.tenantId).not.toBe(tb.tenantId);
    expect(ta.principalId).not.toBe(tb.principalId);
    expect(await db.tenancy.getMembership({...mine(ta),context:'production'}))
      .toMatchObject({tenant_id:ta.tenantId,principal_id:ta.principalId,
        role:'owner',revision:1});
    expect(await db.tenancy.getMembership({
      tenantId:ta.tenantId,identity:bob,context:'production'})).toBe(null);
    expect(await db.tenancy.getMembership({
      tenantId:tb.tenantId,identity:alice,context:'production'})).toBe(null);
  });
  it('separates the same verified identity production and developer contexts',async()=>{
    const dev=await db.tenancy.provisionTenant({
      verifiedIdentity:alice,label:'Own dev area',context:'development'});
    expect(dev.principalId).toBe(ta.principalId);
    expect(dev.context).toBe('development');
    expect(await db.tenancy.getMembership({
      tenantId:dev.tenantId,identity:alice,context:'production'})).toBe(null);
    expect(await db.tenancy.getMembership({
      tenantId:ta.tenantId,identity:alice,context:'development'})).toBe(null);
  });
  it('keeps original legacy account keys and OAuth connectors entirely unowned',async()=>{
    await rawQuery("INSERT INTO stripe_accounts(id,label,test_key_enc) VALUES($1,$2,$3)",
      ['acct_LEGACY','Legacy owner account','v1.disposable-not-real']);
    await rawQuery("INSERT INTO oauth_tokens(token_hash,client_id,stripe_account,kind) VALUES($1,$2,$3,$4)",
      [hashToken('synthetic-legacy-token'),'legacy-client','acct_LEGACY','connector']);
    expect((await rawQuery('SELECT COUNT(*)::int AS n FROM tenancy_grants'))[0].n).toBe(0);
    expect((await rawQuery('SELECT stripe_account FROM oauth_tokens WHERE client_id=$1',
      ['legacy-client']))[0].stripe_account).toBe('acct_LEGACY');
    expect(await db.tenancy.listGrants({...mine(ta)})).toEqual([]);
  });
  it('stages only redacted unverified owned descriptors; foreign users cannot enroll or list',async()=>{
    const a=await db.tenancy.stageGrant(grant());
    expect(a).toMatchObject({tenant_id:ta.tenantId,principal_id:ta.principalId,
      status:'pending_verification',stripe_account:'acct_ALICE',mode:'test',
      kind:'stripe_app_oauth'});
    expect(JSON.stringify(a)).not.toContain('secret');
    expect(await db.tenancy.stageGrant(grant(ta,bob))).toBe(null);
    expect(await db.tenancy.stageGrant({...grant(),revision:6})).toBe(null);
    expect(await db.tenancy.listGrants({...mine(ta),account:'acct_ALICE'}))
      .toHaveLength(1);
    expect(await db.tenancy.listGrants({...mine(ta,bob)})).toEqual([]);
    expect(await db.tenancy.listGrants({...mine(tb),account:'acct_ALICE'}))
      .toEqual([]);
    expect(await db.tenancy.listGrants({...mine(ta),context:'development'}))
      .toEqual([]);
  });
  it('rejects implicit privilege claims, foreign host, wrong mode and arbitrary secret fields',async()=>{
    for(const d of [
      {...grant(),accessToken:'unsafe-to-store'},
      {...grant(),tenantId:'tenant_fake'},
      {...grant(),account:'not-a-stripe-account'},
      {...grant(),mode:'unknown'},
      {...grant(),kind:'invented_super_token'},
      {...grant(),providerIssuer:'http://example.com'},
      {...grant(),providerResource:'http://api.stripe.com'},
      {...grant(),providerResource:'https://malicious.example/stripe'},
      {...grant(),expiresAt:'1999-01-01T00:00:00Z'}
    ]){
      await expect(db.tenancy.stageGrant(d)).rejects.toThrow();
    }
  });
  it('only current owners can add members, never silently create another owner',async()=>{
    expect(await db.tenancy.addMember({
      actor:mine(ta),memberIdentity:admin,role:'administrator',context:'production'}))
      .toBe(true);
    expect(await db.tenancy.addMember({
      actor:mine(ta),memberIdentity:admin,role:'administrator',context:'production'}))
      .toBe(false);
    expect(await db.tenancy.getMembership({
      tenantId:ta.tenantId,identity:admin,context:'production'}))
      .toMatchObject({role:'administrator',revision:1});
    expect(await db.tenancy.addMember({
      actor:mine(ta,admin),memberIdentity:bob,role:'member',context:'production'}))
      .toBe(false);
    await expect(db.tenancy.addMember({
      actor:mine(ta),memberIdentity:bob,role:'owner',context:'production'}))
      .rejects.toThrow();
  });
  it('refuses stale membership after owner revocation before grant or intent access',async()=>{
    expect(await db.tenancy.stageGrant({...grant(),identity:admin,
      account:'acct_ADMIN'})).not.toBe(null);
    const intent=await db.tenancy.issueIntent({...mine(ta,admin),
      account:'acct_ADMIN',mode:'test',kind:'stripe_app_oauth',clientId:'client1'});
    expect(intent.state).toHaveLength(43);
    expect(await db.tenancy.revokeMember({
      actor:mine(ta),targetIdentity:admin,context:'production',expectedRevision:1}))
      .toBe(true);
    expect(await db.tenancy.getMembership({
      tenantId:ta.tenantId,identity:admin,context:'production'})).toBe(null);
    expect(await db.tenancy.listGrants(mine(ta,admin))).toEqual([]);
    expect(await db.tenancy.stageGrant({...grant(),identity:admin,
      account:'acct_ADMIN'})).toBe(null);
    expect(await db.tenancy.consumeIntent({...mine(ta,admin),state:intent.state,
      clientId:'client1'})).toBe(null);
    expect(await db.tenancy.revokeMember({
      actor:mine(ta),targetIdentity:admin,context:'production',expectedRevision:1}))
      .toBe(false);
  });
  it('releases a grant only once under parallel revocations and leaves neighbors intact',async()=>{
    const g1=await db.tenancy.stageGrant(grant());
    const g2=await db.tenancy.stageGrant({...grant(),account:'acct_ALICE2'});
    const results=await Promise.all(Array.from({length:5},
      ()=>db.tenancy.revokeGrant({...mine(ta),grantId:g1.id})));
    expect(results.filter(Boolean)).toHaveLength(1);
    const rows=await db.tenancy.listGrants(mine(ta));
    expect(rows.some(x=>x.id===g1.id)).toBe(false);
    expect(rows.some(x=>x.id===g2.id)).toBe(true);
    expect(await db.tenancy.revokeGrant({...mine(tb),grantId:g2.id})).toBe(false);
    expect(await db.tenancy.revokeGrant({...mine(ta),revision:99,grantId:g2.id}))
      .toBe(false);
  });
  it('consumes same-client state once atomically and forbids cross-user replay',async()=>{
    const t=await db.tenancy.issueIntent({...mine(ta),
      account:'acct_ALICE',mode:'test',kind:'stripe_app_oauth',clientId:'chatgpt'});
    const input={...mine(ta),state:t.state,clientId:'chatgpt'};
    expect(await db.tenancy.consumeIntent({...input,clientId:'claude'})).toBe(null);
    expect(await db.tenancy.consumeIntent({...input,identity:bob})).toBe(null);
    const replies=await Promise.all(Array.from({length:8},
      ()=>db.tenancy.consumeIntent(input)));
    expect(replies.filter(Boolean)).toHaveLength(1);
    expect(replies.find(Boolean)).toMatchObject({
      stripe_account:'acct_ALICE',mode:'test',kind:'stripe_app_oauth'});
    expect(await db.tenancy.consumeIntent(input)).toBe(null);
  });
  it('does not expose any provider credential bytes in tenant storage',async()=>{
    const tables=(await rawQuery("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename LIKE 'tenancy_%' ORDER BY tablename")).map(x=>x.tablename);
    expect(tables).toEqual(['tenancy_auth_intents','tenancy_grants',
      'tenancy_memberships','tenancy_principals','tenancy_tenants']);
    const cols=(await rawQuery("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tenancy_grants'")).map(x=>x.column_name);
    for(const forbidden of ['token','key_enc','ciphertext','client_secret','access_token']){
      expect(cols).not.toContain(forbidden);
    }
  });
});
