import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {createTenantCredentialVault,credentialAad} from '../../src/tenancy/vault.js';
import {decryptSecret} from '../../src/core/crypto.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery}
  from '../../test/helpers/pg-neon-adapter.js';

const A={issuer:'https://id.example.test',subject:'owner-A'};
const B={issuer:'https://id.example.test',subject:'other-B'};
const key=randomBytes(32);
let db,tenant,vault;
const owner=()=>({tenantId:tenant.tenantId,identity:A,context:'production',revision:1});
const stage=async({account='acct_SecureVault',kind='account_restricted',mode='test'}={})=>{
  const g=await db.tenancy.stageGrant({...owner(),account,kind,mode,
    providerIssuer:'https://api.stripe.com',
    providerResource:'https://api.stripe.com/v1/customers'});
  expect(g).not.toBeNull();
  return {...owner(),grantId:g.id,account,mode,kind};
};
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Local disposable PostgreSQL is required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());await db.initSchema();
  await db.tenancy.initializeTables();
  tenant=await db.tenancy.provisionTenant({
    verifiedIdentity:A,label:'Encrypted test tenant'});
  vault=createTenantCredentialVault({tenancy:db.tenancy,encryptionKey:key});
});
afterAll(async()=>{await closeIsolatedSchema();});
describe('CAP-3 real PostgreSQL sealed pending provider grant',()=>{
  it('stores encrypted-only, exact AAD-bound key material without returning a bearer',async()=>{
    const g=await stage();
    const raw='rk_test_fakeOnlyForDisposablePostgres123456';
    const result=await vault.stage({...g,credential:raw});
    expect(result).toMatchObject({status:'pending-provider-proof',
      canExecute:false,providerVerified:false,generation:1});
    expect(JSON.stringify(result)).not.toContain(raw);
    const rows=await rawQuery(
      'SELECT ciphertext,generation,revoked_at FROM tenancy_secrets WHERE grant_id=$1',[g.grantId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].ciphertext).not.toContain(raw);
    expect(rows[0].ciphertext).toMatch(/^v1[.]/);
    const aad=credentialAad({...g,principalId:tenant.principalId});
    expect(decryptSecret(rows[0].ciphertext,{aad,key})).toBe(raw);
    for(const wrong of [{...g,account:'acct_OTHER'},{...g,context:'development'},
      {...g,revision:2},{...g,tenantId:'tenant_22222222-2222-2222-2222-222222222222'}]){
      expect(()=>decryptSecret(rows[0].ciphertext,{
        aad:credentialAad({...wrong,principalId:tenant.principalId}),key})).toThrow();
    }
    expect(await vault.metadata(g)).toMatchObject({
      status:'pending-provider-proof',generation:1,canExecute:false});
  });
  it('does not allow a duplicate insert or broader provider fallback',async()=>{
    const g=await stage({account:'acct_NoDuplicate'});
    const value='sk_test_fakeOnlyForDisposablePostgres123456';
    const m={...g,kind:'account_restricted',credential:value};
    await expect(vault.stage(m)).rejects.toThrow(/kind and environment/);
    expect(await vault.stage({...g,kind:'account_restricted',
      credential:'rk_test_fakeOnlyForDisposablePostgres123456'}))
      .toMatchObject({canExecute:false,status:'pending-provider-proof'});
    expect((await vault.stage({...g,credential:'rk_test_secondFake123456'})).status)
      .toBe('denied');
    expect(await rawQuery('SELECT COUNT(*)::int n FROM tenancy_secrets WHERE grant_id=$1',
      [g.grantId])).toEqual([{n:1}]);
  });
  it('refuses foreign tenants, identity, stale revision and account before decrypt',async()=>{
    const g=await stage({account:'acct_OnlyA'});
    for(const bad of [{...g,identity:B},{...g,revision:10},
      {...g,account:'acct_OTHER'},{...g,tenantId:'tenant_22222222-2222-2222-2222-222222222222'},
      {...g,mode:'live'}]){
      expect((await vault.stage({...bad,credential:'rk_test_fakeOnlyForPostgres123456'})).status)
        .toBe('denied');
    }
    expect((await vault.metadata({...g,identity:B})).status).toBe('denied');
  });
  it('uses optimistic generation CAS: two concurrent rotations have one winner',async()=>{
    const g=await stage({account:'acct_Rotate'});
    await vault.stage({...g,credential:'rk_test_initialSynthetic123456'});
    const changes=await Promise.all([
      vault.rotate({...g,expectedGeneration:1,
        credential:'rk_test_rotatedAlpha123456'}),
      vault.rotate({...g,expectedGeneration:1,
        credential:'rk_test_rotatedBeta123456'})
    ]);
    expect(changes.filter(v=>v.status==='pending-provider-proof')).toHaveLength(1);
    expect(changes.filter(v=>v.status==='denied')).toHaveLength(1);
    const rows=await rawQuery(
      'SELECT ciphertext,generation FROM tenancy_secrets WHERE grant_id=$1',[g.grantId]);
    expect(rows[0].generation).toBe(2);
    const decrypted=decryptSecret(rows[0].ciphertext,{
      aad:credentialAad({...g,principalId:tenant.principalId}),key});
    expect(['rk_test_rotatedAlpha123456','rk_test_rotatedBeta123456'])
      .toContain(decrypted);
    expect((await vault.rotate({...g,expectedGeneration:1,
      credential:'rk_test_staleRetry123456'})).status).toBe('denied');
  });
  it('never permits reuse of a revoked ciphertext or restoring it as a new version',async()=>{
    const g=await stage({account:'acct_Revoke'});
    await vault.stage({...g,credential:'rk_test_revokeSynthetic123456'});
    expect((await vault.revoke(g)).status).toBe('revoked');
    expect((await vault.revoke(g)).status).toBe('not-current');
    expect((await vault.metadata(g)).status).toBe('denied');
    expect((await vault.rotate({...g,expectedGeneration:1,
      credential:'rk_test_attemptRestore123456'})).status).toBe('denied');
    expect((await vault.stage({...g,credential:'rk_test_attemptRestore123456'})).status)
      .toBe('denied');
    const row=(await rawQuery('SELECT revoked_at FROM tenancy_secrets WHERE grant_id=$1',
      [g.grantId]))[0];
    expect(row.revoked_at).not.toBeNull();
  });
  it('preserves distinct account keys and org key grammar without promoting them',async()=>{
    const g=await stage({account:'acct_OrgKey',kind:'organization_secret'});
    expect(await vault.stage({...g,credential:'sk_org_fakeOnlyForLocal123456'}))
      .toMatchObject({status:'pending-provider-proof',canExecute:false});
    const own=await stage({account:'acct_SecretMode',kind:'account_secret',mode:'live'});
    await expect(vault.stage({...own,credential:'sk_test_wrongMode123456'}))
      .rejects.toThrow();
    expect((await vault.stage({...own,credential:'sk_live_fakeOnlyLocal123456'})).status)
      .toBe('pending-provider-proof');
  });
  it('blocks a former member and keeps ciphertext inaccessible after revocation',async()=>{
    const user={issuer:'https://id.example.test',subject:'new member'};
    expect(await db.tenancy.addMember({
      actor:owner(),memberIdentity:user,context:'production',role:'member'}))
      .toBe(true);
    const g=await db.tenancy.stageGrant({tenantId:tenant.tenantId,identity:user,
      revision:1,context:'production',account:'acct_Former',mode:'test',
      kind:'account_restricted',providerIssuer:'https://api.stripe.com',
      providerResource:'https://api.stripe.com/v1/customers'});
    const member={tenantId:tenant.tenantId,identity:user,context:'production',
      revision:1,grantId:g.id,account:'acct_Former',mode:'test',
      kind:'account_restricted'};
    expect((await vault.stage({...member,credential:'rk_test_member123456'})).status)
      .toBe('pending-provider-proof');
    expect(await db.tenancy.revokeMember({actor:owner(),targetIdentity:user,
      context:'production',expectedRevision:1})).toBe(true);
    expect((await vault.metadata(member)).status).toBe('denied');
    expect((await vault.rotate({...member,expectedGeneration:1,
      credential:'rk_test_badRestore123456'})).status).toBe('denied');
  });
});
