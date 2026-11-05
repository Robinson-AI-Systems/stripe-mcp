// CAP4-RECENSUS-1-ACCOUNT-DEENROLL — Postgres proof of the removal
// transaction: the intent snapshot, the guard set, the atomic
// re-check against the owner-confirmed expected state, token/pass
// revocation composed across clients, key-material and row deletion
// (including the foreign-key dependent records the schema requires
// removing in the same statement), and the irreversible journal row
// (no inverse — stripe_undo_change's claim gate refuses it).
//
// Baseline accounting: at pristine main 9daf3f38 every test fails as
// surface-missing — owner_deenroll_intents and the db de-enrollment
// methods do not exist there.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import pg from 'pg';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db,peer,other;
const account='acct_DEENROLLPG';
const otherAccount='acct_DEENOTHERPG';
const id='N'.repeat(32);
const fingerprint='DEEN-AAAAA-BBBBB-CCCCC-DDDDD';
const passToken='rtc_pass_'+'B'.repeat(43);
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  const schema=await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'De-enroll PG',otherAccount,'Bystander']);
  await db.saveTestKey({account,label:'De-enroll PG',
    ciphertext:'v1.fake-pg-ciphertext',kind:'restricted',last4:'PGTS',
    permissions:{customers:'ok'}});
  await db.createAccessToken({accessToken:'pg_access_1',refreshToken:'pg_refresh_1',
    clientId:'client_pg_one',stripeAccount:account,mode:'test',profile:'full'});
  await db.createAccessToken({accessToken:'pg_access_2',
    clientId:'client_pg_two',stripeAccount:account,mode:'test',profile:'read_only'});
  await db.createAccessToken({accessToken:'pg_access_other',
    clientId:'client_pg_one',stripeAccount:otherAccount,mode:'test',profile:'read_only'});
  expect(await db.createRtcPass({id:'rtc-agent-deenrolldb',account,
    token:passToken,mode:'test',profile:'read_only',areas:['server'],
    expiresAt:new Date(Date.now()+24*3600*1000)})).toBe(true);
  // Settled financial history and account-owned dependents reference
  // the account row by foreign key; the removal must clear them in
  // the same statement or the row delete cannot land.
  await rawQuery(`INSERT INTO money_reservations
    (stripe_account,connection,request_key,local_day,amount_cents,currency,state)
    VALUES ($1,'pg-conn','settled-key',
      (now() AT TIME ZONE 'America/Denver')::date,100,'usd','confirmed')`,[account]);
  await rawQuery(`INSERT INTO money_approvals
    (stripe_account,request_key,tool,description,amount_cents,currency,expires_at)
    VALUES ($1,'settled-key','payout_create','fixture',100,'usd',now()+interval '1 hour')`,
    [account]);
  await rawQuery(`INSERT INTO webhook_signing_secrets
    (stripe_account,endpoint_id,ciphertext) VALUES ($1,'we_PGFIXTURE','v1.fake')`,
    [account]);
  peer=new pg.Client({connectionString:url});await peer.connect();
  await peer.query('SET search_path TO "'+schema+'"');
  other=createDb(async(chunks,...values)=>{
    let statement=chunks[0];
    for(let i=0;i<values.length;i++)statement+='$'+(i+1)+chunks[i+1];
    return (await peer.query(statement,values)).rows;
  });
});
afterAll(async()=>{await peer?.end();await closeIsolatedSchema();});
describe('CAP4-RECENSUS-1 Postgres de-enrollment ceremony',()=>{
  it('each guard refuses the request in its stated state',async()=>{
    await rawQuery('INSERT INTO stripe_accounts(id,label,live_enabled) VALUES ($1,$2,TRUE)',
      ['acct_DEENLIVEPG','Live enabled']);
    await rawQuery('INSERT INTO stripe_accounts(id,label,is_default) VALUES ($1,$2,TRUE)',
      ['acct_DEENDFTPG','Default']);
    await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2)',
      ['acct_DEENRESPG','Reserved']);
    await rawQuery(`INSERT INTO money_reservations
      (stripe_account,connection,request_key,local_day,amount_cents,currency,state)
      VALUES ($1,'pg-conn','open-key',
        (now() AT TIME ZONE 'America/Denver')::date,100,'usd','reserved')`,
      ['acct_DEENRESPG']);
    for(const guarded of ['acct_DEENLIVEPG','acct_DEENDFTPG','acct_DEENRESPG']){
      expect(await db.requestDeenrollIntent({id:'G'.repeat(32),account:guarded,
        expiresAt:new Date(Date.now()+600000)})).toBe(false);
      expect(await db.getStripeAccount(guarded)).not.toBeNull();
    }
  });
  it('the request step snapshots and removes nothing',async()=>{
    const evaluation=await db.getDeenrollEvaluation(account);
    expect(evaluation).toMatchObject({stripe_account:account,label:'De-enroll PG',
      test_key_kind:'restricted',test_key_last4:'PGTS',test_connected:true,
      live_connected:false,live_enabled:false,is_default:false,
      connector_count:2,pass_count:1,unsettled_count:0});
    expect(await db.requestDeenrollIntent({id,account,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    const intent=await db.getDeenrollIntent(id);
    expect(intent).toMatchObject({stripe_account:account,connector_count:2,
      pass_count:1,unsettled_count:0});
    expect(await db.getStripeAccount(account)).not.toBeNull();
    expect(await db.getAccessToken('pg_access_1')).not.toBeNull();
    expect(await db.getRtcPass(passToken)).not.toBeNull();
    expect(await rawQuery('SELECT id FROM change_log WHERE tool=$1',
      ['stripe_deenroll_account'])).toHaveLength(0);
  });
  it('a stale expected state refuses atomically and removes nothing',async()=>{
    const expected=await db.getDeenrollEvaluation(account);
    await rawQuery('UPDATE stripe_accounts SET label=$2 WHERE id=$1',
      [account,'Changed label']);
    expect(await db.consumeDeenrollIntent({id,expectedFingerprint:fingerprint,
      expected})).toBe(false);
    expect(await db.getStripeAccount(account)).not.toBeNull();
    expect(await db.getAccessToken('pg_access_1')).not.toBeNull();
    await rawQuery('UPDATE stripe_accounts SET label=$2 WHERE id=$1',
      [account,'De-enroll PG']);
  });
  it('one concurrent consumption removes the row, keys and dependents, revokes every token and pass, and journals irreversibly',async()=>{
    const expected=await db.getDeenrollEvaluation(account);
    const results=await Promise.all([
      db.consumeDeenrollIntent({id,expectedFingerprint:fingerprint,expected}),
      other.consumeDeenrollIntent({id,expectedFingerprint:fingerprint,expected})
    ]);
    expect(results.sort()).toEqual([false,true]);
    expect(await db.getStripeAccount(account)).toBeNull();
    expect(await db.getEncryptedKey({account,mode:'test'})).toBeNull();
    expect(await db.getAccessToken('pg_access_1')).toBeNull();
    expect(await db.getAccessToken('pg_access_2')).toBeNull();
    expect(await db.getTokenByRefreshToken('pg_refresh_1')).toBeNull();
    expect(await db.getRtcPass(passToken)).toBeNull();
    expect(await db.getAccessToken('pg_access_other')).not.toBeNull();
    expect(await rawQuery('SELECT id FROM money_reservations WHERE stripe_account=$1',
      [account])).toHaveLength(0);
    expect(await rawQuery('SELECT stripe_account FROM webhook_signing_secrets WHERE stripe_account=$1',
      [account])).toHaveLength(0);
    expect(await rawQuery('SELECT id FROM owner_deenroll_intents WHERE stripe_account=$1',
      [account])).toHaveLength(0);
    const audits=await rawQuery(
      'SELECT id,stripe_account,tool,target,summary,dry_run,inverse FROM change_log WHERE tool=$1',
      ['stripe_deenroll_account']);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({stripe_account:account,
      target:account,dry_run:false,inverse:null});
    expect(audits[0].summary).toContain('IRREVERSIBLE');
    expect(audits[0].summary).toContain(fingerprint);
    // The journal row carries no inverse, so the undo claim gate
    // refuses it: de-enrollment cannot be undone.
    expect(await db.claimUndoCandidate({account,mode:'test',
      id:Number(audits[0].id)})).toBe(false);
    expect(await db.consumeDeenrollIntent({id,expectedFingerprint:fingerprint,
      expected})).toBe(false);
  });
  it('an expired intent refuses and removes nothing',async()=>{
    const expired='E'.repeat(32);
    expect(await db.requestDeenrollIntent({id:expired,account:otherAccount,
      expiresAt:new Date(Date.now()-1000)})).toBe(true);
    const expected=await db.getDeenrollEvaluation(otherAccount);
    expect(await db.consumeDeenrollIntent({id:expired,
      expectedFingerprint:fingerprint,expected})).toBe(false);
    expect(await db.getStripeAccount(otherAccount)).not.toBeNull();
    expect(await db.getAccessToken('pg_access_other')).not.toBeNull();
  });
});
