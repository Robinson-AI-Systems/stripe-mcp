import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import pg from 'pg';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db,peer,other;
const account='acct_REVOKEPG';
const id='R'.repeat(32);
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  const schema=await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'First','acct_OTHERPG','Other']);
  await db.createAccessToken({accessToken:'fixture_access_1',refreshToken:'fixture_refresh_1',
    clientId:'client_REVOKE',stripeAccount:account,mode:'test',profile:'read_only'});
  await db.createAccessToken({accessToken:'fixture_access_2',
    clientId:'client_SAFE',stripeAccount:account,mode:'test',profile:'read_only'});
  await db.createAccessToken({accessToken:'fixture_access_other',
    clientId:'client_REVOKE',stripeAccount:'acct_OTHERPG',mode:'test',profile:'read_only'});
  peer=new pg.Client({connectionString:url});await peer.connect();
  await peer.query('SET search_path TO "'+schema+'"');
  other=createDb(async(chunks,...values)=>{
    let statement=chunks[0];
    for(let i=0;i<values.length;i++)statement+='$'+(i+1)+chunks[i+1];
    return (await peer.query(statement,values)).rows;
  });
});
afterAll(async()=>{await peer?.end();await closeIsolatedSchema();});
describe('B-8b2a atomic owner approval and selected-account connection revocation',()=>{
  it('does not revoke anything on intent creation; rejects mismatched account/client',async()=>{
    expect(await db.requestConnectionRevokeIntent({
      id:'Q'.repeat(32),account:account,clientId:'not-present',
      expiresAt:new Date(Date.now()+600000)})).toBe(false);
    expect(await db.requestConnectionRevokeIntent({id,account,clientId:'client_REVOKE',
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.getAccessToken('fixture_access_1')).not.toBeNull();
  });
  it('consumes the same intent at most once across two database connections',async()=>{
    const result=await Promise.all([
      db.consumeConnectionRevokeIntent(id),other.consumeConnectionRevokeIntent(id)
    ]);
    expect(result.sort()).toEqual([false,true]);
    expect(await db.getAccessToken('fixture_access_1')).toBeNull();
    expect(await db.getTokenByRefreshToken('fixture_refresh_1')).toBeNull();
    expect(await db.getAccessToken('fixture_access_2')).not.toBeNull();
    expect(await db.getAccessToken('fixture_access_other')).not.toBeNull();
    const audits=await rawQuery('SELECT stripe_account,tool,target,dry_run FROM change_log');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({stripe_account:account,
      tool:'stripe_revoke_connection',target:'client_REVOKE',dry_run:false});
  });
  it('refuses expired and reused intents',async()=>{
    expect(await db.consumeConnectionRevokeIntent(id)).toBe(false);
    const expired='E'.repeat(32);
    await db.requestConnectionRevokeIntent({id:expired,account,clientId:'client_SAFE',
      expiresAt:new Date(Date.now()-1000)});
    expect(await db.consumeConnectionRevokeIntent(expired)).toBe(false);
    expect(await db.getAccessToken('fixture_access_2')).not.toBeNull();
  });
});
