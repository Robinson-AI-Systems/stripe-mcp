import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import pg from 'pg';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db,peer,other;
const one='acct_PRIMARYPG',two='acct_SECONDPG',three='acct_THIRDPG';
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if (!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  const schema=await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,is_default,test_key_enc) VALUES ($1,$2,TRUE,$3),($4,$5,FALSE,$6),($7,$8,FALSE,$9)',
    [one,'Primary','fake-encrypted-one',two,'Second','fake-encrypted-two',three,'Third','fake-encrypted-three']);
  peer=new pg.Client({connectionString:url});await peer.connect();
  await peer.query('SET search_path TO "'+schema+'"');
  other=createDb(async(parts,...vals)=>{
    let sql=parts[0];for(let i=0;i<vals.length;i++)sql+='$'+(i+1)+parts[i+1];
    return (await peer.query(sql,vals)).rows;
  });
});
afterAll(async()=>{await peer?.end();await closeIsolatedSchema();});
describe('B-8b2b2 default-account SQL serialization and one-use audit',()=>{
  it('cannot stage unknown/unconnected/already-default account',async()=>{
    expect(await db.requestDefaultAccountIntent({id:'X'.repeat(32),
      account:'acct_UNKNOWN',expiresAt:new Date(Date.now()+600000)})).toBe(false);
    expect(await db.requestDefaultAccountIntent({id:'Y'.repeat(32),
      account:one,expiresAt:new Date(Date.now()+600000)})).toBe(false);
  });
  it('serializes two competing new defaults, keeping exactly one and one audit',async()=>{
    const a='A'.repeat(32),b='B'.repeat(32);
    expect(await db.requestDefaultAccountIntent({id:a,account:two,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.requestDefaultAccountIntent({id:b,account:three,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    const won=await Promise.all([db.consumeDefaultAccountIntent(a),
      other.consumeDefaultAccountIntent(b)]);
    expect(won.sort()).toEqual([false,true]);
    const defaults=await rawQuery('SELECT id FROM stripe_accounts WHERE is_default=TRUE');
    expect(defaults).toHaveLength(1);
    expect([two,three]).toContain(defaults[0].id);
    const audits=await rawQuery('SELECT tool,stripe_account,dry_run FROM change_log');
    expect(audits).toHaveLength(1);
    expect(audits[0].tool).toBe('stripe_set_default_account');
    expect(audits[0].stripe_account).toBe(defaults[0].id);
    expect(audits[0].dry_run).toBe(false);
    const loser=won[0]===false?a:b;
    expect(await db.consumeDefaultAccountIntent(loser)).toBe(false);
  });
  it('never consumes an expired default-account request',async()=>{
    const id='E'.repeat(32);
    const current=(await rawQuery('SELECT id FROM stripe_accounts WHERE is_default=TRUE'))[0].id;
    const target=current===two?three:two;
    expect(await db.requestDefaultAccountIntent({id,account:target,
      expiresAt:new Date(Date.now()-1000)})).toBe(true);
    expect(await db.consumeDefaultAccountIntent(id)).toBe(false);
    const after=(await rawQuery('SELECT id FROM stripe_accounts WHERE is_default=TRUE'))[0].id;
    expect(after).toBe(current);
  });
});
