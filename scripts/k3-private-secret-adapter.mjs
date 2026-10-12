// Full original Stripe one-time secret SQL adapter probe, disposable CI only.
// The six portable adapted exports are not silently adopted into Production.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {createDb} from '../src/db.js';
import {createOneTimeStore} from '../src/core/one-time-secrets.js';
import {stripeOneTimeSeams} from '../src/core/k3-one-time-seams.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery}
  from '../test/helpers/pg-neon-adapter.js';
import {assertDisposableDb} from './k3-private-adoption-rehearsal.mjs';

function useClient(client) {
  return createDb(async (strings,...values)=>{
    let sql=strings[0];
    for(let i=0;i<values.length;i++)sql+='$'+(i+1)+strings[i+1];
    return (await client.query(sql,values)).rows;
  });
}
export async function proveOneTimeAdapter(){
  assertDisposableDb();
  const {createOneTimeSecretStore}=await import('robinson-mcp-core/one-time-secrets');
  const url=process.env.TEST_DATABASE_URL;
  const schema=await openIsolatedSchema(url);
  let peer;
  try{
    const db=createDb(neonShapedQuery());
    await db.initSchema();
    peer=new pg.Client({connectionString:url});
    await peer.connect();
    await peer.query('SET search_path TO "'+schema+'"');
    const db2=useClient(peer);
    const key=randomBytes(32);
    const original=createOneTimeStore({db,encryptionKey:key});
    const portable=createOneTimeSecretStore({
      ...stripeOneTimeSeams(db2),encryptionKey:key});
    const secret='synthetic-non-provider-only-'+randomBytes(6).toString('hex');
    const account='acct_K3TESTONE',other='acct_K3OTHER';
    const originalIssued=await original.issue({account,mode:'test',
      kind:'webhook-secret',secret});
    assert.equal(originalIssued.setupPath,'/api/stripe/setup?show='+originalIssued.id);
    const encrypted=await rawQuery('SELECT * FROM one_time_secrets WHERE id=$1',
      [originalIssued.id]);
    assert.equal(encrypted.length,1);
    assert.equal(encrypted[0].ciphertext.startsWith('v1.'),true);
    assert.equal(encrypted[0].ciphertext.includes(secret),false);
    assert.equal(encrypted[0].stripe_account,account);
    assert.equal(encrypted[0].mode,'test');
    assert.equal(encrypted[0].kind,'webhook-secret');
    assert.equal(await portable.consume(originalIssued.id),secret);
    assert.equal(await original.consume(originalIssued.id),null);
    const reverse=await portable.issue({account,mode:'test',
      kind:'webhook-secret',secret});
    assert.equal(reverse.setupPath,'/api/stripe/setup?show='+reverse.id);
    assert.equal(await original.consume(reverse.id),secret);
    assert.equal(await portable.consume(reverse.id),null);
    // Two independent PostgreSQL sessions compete to consume the SAME row:
    // the service SQL DELETE RETURNING must return exactly one decrypted secret.
    const raced=await portable.issue({account,mode:'test',
      kind:'webhook-secret',secret});
    const portableInMain=createOneTimeSecretStore({
      ...stripeOneTimeSeams(db),encryptionKey:key});
    const answers=await Promise.all([
      portable.consume(raced.id),portableInMain.consume(raced.id)
    ]);
    assert.deepEqual(answers.filter(Boolean),[secret]);
    assert.equal(await portable.consume(raced.id),null);
    assert.equal((await rawQuery('SELECT id FROM one_time_secrets WHERE id=$1',
      [raced.id])).length,0);
    // Changing the account after encryption must never reveal the ciphertext.
    const tampered=await portable.issue({account,mode:'test',
      kind:'webhook-secret',secret});
    await rawQuery('UPDATE one_time_secrets SET stripe_account=$1 WHERE id=$2',
      [other,tampered.id]);
    await assert.rejects(()=>original.consume(tampered.id));
    assert.equal(await portable.consume(tampered.id),null);
    const alteredMode=await original.issue({account,mode:'test',
      kind:'webhook-secret',secret});
    await rawQuery('UPDATE one_time_secrets SET mode=$1 WHERE id=$2',
      ['live',alteredMode.id]);
    await assert.rejects(()=>portable.consume(alteredMode.id));
    assert.equal(await original.consume(alteredMode.id),null);
    const expired=await portable.issue({account,mode:'test',
      kind:'webhook-secret',secret});
    await rawQuery("UPDATE one_time_secrets SET expires_at=now()-interval '1 second' WHERE id=$1",
      [expired.id]);
    assert.equal(await original.consume(expired.id),null);
    assert.equal(await portable.consume(expired.id),null);
    return {schema:'actual-stripe-one_time_secrets',pools:2,
      legacyIssuedPortableConsumed:true,portableIssuedLegacyConsumed:true,
      singleUseRace:true,accountAndModeAadTamperRefused:true,
      expiredRefused:true,providerCalls:0,releaseReady:false};
  }finally{
    await peer?.end();
    await closeIsolatedSchema();
  }
}
if(process.argv[1]?.endsWith('k3-private-secret-adapter.mjs')){
  try{console.log(JSON.stringify(await proveOneTimeAdapter()));}
  catch(e){console.error('Stripe one-time core adaptation failed: '+e.message);process.exitCode=1;}
}
