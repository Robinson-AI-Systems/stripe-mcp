// CAP4-RECENSUS-2-OAUTH-CLIENT-DELETE — Postgres proof of the
// deletion transaction: the evaluated-state snapshot, the atomic
// re-check against the owner-confirmed expected state, token and
// pass revocation composed across accounts, authorization-code
// cleanup, client-row deletion, and the irreversible journal row
// (no inverse and no owning account — stripe_undo_change's
// per-account claim gate can never claim it).
//
// Baseline accounting: at pristine main a894b262 every test fails
// as surface-missing — owner_delete_client_intents and the db
// client-management methods do not exist there.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import pg from 'pg';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db,peer,other;
const account='acct_CLIENTPG';
const otherAccount='acct_CLOTHERPG';
const client='client_pg_delete';
const passClient='rtc-agent-delclientdb';
const id='P'.repeat(32);
const fingerprint='DELC-AAAAA-BBBBB-CCCCC-DDDDD';
const passToken='rtc_pass_'+'D'.repeat(43);
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  const schema=await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'Client PG',otherAccount,'Bystander account']);
  await db.saveTestKey({account,label:'Client PG',
    ciphertext:'v1.fake-pg-ciphertext',kind:'restricted',last4:'PGTS',
    permissions:{customers:'ok'}});
  await db.createOAuthClient({clientId:client,clientSecret:'pg-secret',
    tokenEndpointAuthMethod:'client_secret_post',
    redirectUris:['https://client.example.test/cb'],clientName:'Delete PG'});
  await db.createOAuthClient({clientId:'client_pg_bystander',
    clientSecret:'pg-bystander-secret',tokenEndpointAuthMethod:'client_secret_basic',
    redirectUris:['https://client.example.test/cb'],clientName:'Bystander PG'});
  await db.createOAuthClient({clientId:passClient,clientSecret:null,
    tokenEndpointAuthMethod:'none',
    redirectUris:['https://client.example.test/cb'],clientName:'Pass PG'});
  await db.createAccessToken({accessToken:'pg_c_access_1',refreshToken:'pg_c_refresh_1',
    clientId:client,stripeAccount:account,mode:'test',profile:'full'});
  await db.createAccessToken({accessToken:'pg_c_access_2',
    clientId:client,stripeAccount:otherAccount,mode:'test',profile:'read_only'});
  await db.createAccessToken({accessToken:'pg_c_access_other',
    clientId:'client_pg_bystander',stripeAccount:account,mode:'test',profile:'read_only'});
  expect(await db.createRtcPass({id:passClient,account,
    token:passToken,mode:'test',profile:'read_only',areas:['server'],
    expiresAt:new Date(Date.now()+24*3600*1000)})).toBe(true);
  await db.createAuthCode({code:'pg_client_code_1',clientId:client,
    redirectUri:'https://client.example.test/cb',
    codeChallenge:'x'.repeat(43),stripeAccount:account,mode:'test',
    profile:'full',listing:'compact'});
  peer=new pg.Client({connectionString:url});await peer.connect();
  await peer.query('SET search_path TO "'+schema+'"');
  other=createDb(async(chunks,...values)=>{
    let statement=chunks[0];
    for(let i=0;i<values.length;i++)statement+='$'+(i+1)+chunks[i+1];
    return (await peer.query(statement,values)).rows;
  });
});
afterAll(async()=>{await peer?.end();await closeIsolatedSchema();});
describe('CAP4-RECENSUS-2 Postgres client deletion ceremony',()=>{
  it('the list and the evaluation report truthful live counts',async()=>{
    const rows=await db.listOAuthClients();
    expect(rows.find(r=>r.client_id===client)).toMatchObject({
      client_name:'Delete PG',token_endpoint_auth_method:'client_secret_post',
      connector_count:2,pass_count:0});
    expect(rows.find(r=>r.client_id===passClient)).toMatchObject({
      client_name:'Pass PG',token_endpoint_auth_method:'none',
      connector_count:0,pass_count:1});
    expect(rows.find(r=>r.client_id==='client_pg_bystander')).toMatchObject({
      connector_count:1,pass_count:0});
    expect(JSON.stringify(rows)).not.toContain('client_secret_hash');
    const evaluation=await db.getDeleteClientEvaluation(client);
    expect(evaluation).toMatchObject({client_id:client,client_name:'Delete PG',
      token_endpoint_auth_method:'client_secret_post',
      connector_count:2,pass_count:0});
    expect(await db.getDeleteClientEvaluation('client_pg_missing')).toBeNull();
  });
  it('the request step snapshots and removes nothing',async()=>{
    expect(await db.requestDeleteClientIntent({id,clientId:client,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    const intent=await db.getDeleteClientIntent(id);
    expect(intent).toMatchObject({client_id:client,client_name:'Delete PG',
      token_endpoint_auth_method:'client_secret_post',
      connector_count:2,pass_count:0});
    expect(await db.getOAuthClient(client)).not.toBeNull();
    expect(await db.getAccessToken('pg_c_access_1')).not.toBeNull();
    expect(await rawQuery('SELECT id FROM change_log WHERE tool=$1',
      ['stripe_delete_oauth_client'])).toHaveLength(0);
  });
  it('a stale expected state refuses atomically and removes nothing',async()=>{
    const expected=await db.getDeleteClientEvaluation(client);
    await rawQuery(`UPDATE oauth_clients SET data=data||'{"client_name":"Changed PG"}'::jsonb
      WHERE client_id=$1`,[client]);
    expect(await db.consumeDeleteClientIntent({id,expectedFingerprint:fingerprint,
      expected})).toBe(false);
    expect(await db.getOAuthClient(client)).not.toBeNull();
    expect(await db.getAccessToken('pg_c_access_1')).not.toBeNull();
    await rawQuery(`UPDATE oauth_clients SET data=data||'{"client_name":"Delete PG"}'::jsonb
      WHERE client_id=$1`,[client]);
  });
  it('one concurrent consumption deletes the row, revokes every token across accounts, clears its codes, and journals irreversibly',async()=>{
    const expected=await db.getDeleteClientEvaluation(client);
    const results=await Promise.all([
      db.consumeDeleteClientIntent({id,expectedFingerprint:fingerprint,expected}),
      other.consumeDeleteClientIntent({id,expectedFingerprint:fingerprint,expected})
    ]);
    expect(results.sort()).toEqual([false,true]);
    expect(await db.getOAuthClient(client)).toBeNull();
    expect(await db.getDeleteClientEvaluation(client)).toBeNull();
    expect(await db.getAccessToken('pg_c_access_1')).toBeNull();
    expect(await db.getAccessToken('pg_c_access_2')).toBeNull();
    expect(await db.getTokenByRefreshToken('pg_c_refresh_1')).toBeNull();
    expect(await db.consumeAuthCode('pg_client_code_1')).toBeNull();
    // Bystanders are untouched.
    expect(await db.getOAuthClient('client_pg_bystander')).not.toBeNull();
    expect(await db.getAccessToken('pg_c_access_other')).not.toBeNull();
    expect(await db.getRtcPass(passToken)).not.toBeNull();
    expect(await rawQuery('SELECT id FROM owner_delete_client_intents WHERE client_id=$1',
      [client])).toHaveLength(0);
    const audits=await rawQuery(
      'SELECT id,stripe_account,tool,target,summary,dry_run,inverse FROM change_log WHERE tool=$1',
      ['stripe_delete_oauth_client']);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({stripe_account:null,
      target:client,dry_run:false,inverse:null});
    expect(audits[0].summary).toContain('IRREVERSIBLE');
    expect(audits[0].summary).toContain(fingerprint);
    // The journal row carries no inverse and no owning account, so
    // the undo machinery refuses it by its existing rule: the
    // per-account candidate read finds nothing and the claim gate
    // updates nothing.
    expect(await db.getUndoCandidate({account,mode:'test',
      id:Number(audits[0].id)})).toBeNull();
    expect(await db.claimUndoCandidate({account,mode:'test',
      id:Number(audits[0].id)})).toBe(false);
    expect(await db.consumeDeleteClientIntent({id,expectedFingerprint:fingerprint,
      expected})).toBe(false);
  });
  it('deleting the pass-carrying client revokes its pass',async()=>{
    const passId='Q'.repeat(32);
    expect(await db.requestDeleteClientIntent({id:passId,clientId:passClient,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    const expected=await db.getDeleteClientEvaluation(passClient);
    expect(expected).toMatchObject({connector_count:0,pass_count:1});
    expect(await db.consumeDeleteClientIntent({id:passId,
      expectedFingerprint:fingerprint,expected})).toBe(true);
    expect(await db.getOAuthClient(passClient)).toBeNull();
    expect(await db.getRtcPass(passToken)).toBeNull();
  });
  it('an expired intent refuses and removes nothing',async()=>{
    const expired='E'.repeat(32);
    expect(await db.requestDeleteClientIntent({id:expired,
      clientId:'client_pg_bystander',
      expiresAt:new Date(Date.now()-1000)})).toBe(true);
    const expected=await db.getDeleteClientEvaluation('client_pg_bystander');
    expect(await db.consumeDeleteClientIntent({id:expired,
      expectedFingerprint:fingerprint,expected})).toBe(false);
    expect(await db.getOAuthClient('client_pg_bystander')).not.toBeNull();
    expect(await db.getAccessToken('pg_c_access_other')).not.toBeNull();
  });
});
