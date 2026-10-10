import { describe, expect, it, vi, afterEach } from 'vitest';
import { isRecentOwnerVerification, LIVE_REAUTH_WINDOW_MS } from
  '../../src/tools/live-guard.js';
import { defineWrite } from '../../src/tools/write.js';

afterEach(() => vi.unstubAllEnvs());
const parse = response => JSON.parse(response.content[0].text);
const connection = { stripeAccount: 'acct_TEST_LIVE_GUARD', mode: 'live', profile: 'full' };
function fixture() {
  const calls = {writes:0, reads:0, audits:0};
  const db = {
    getStripeAccount: async id => ({ id, live_enabled: true, live_connected: true }),
    recordChange: async () => {calls.audits++;return calls.audits;}
  };
  const ctx = { db, connection, liveAccessGranted: true };
  const op = defineWrite({
    name:'stripe_example_live_write',
    read:async()=>{calls.reads++;return {state:'before'};},
    summarize:async()=> 'Update isolated fake record.',
    apply:async()=>{calls.writes++;},
    readAfter:async()=>({state:'after'}),
    verify:async(_before,after)=>after.state==='after'
  });
  return {op,ctx,db,calls};
}

describe('B-2 server-owned LIVE write boundary (fake Stripe only)', () => {
  it('rejects live without a production deployment even when other flags are forged', async () => {
    vi.stubEnv('VERCEL_ENV','preview');
    const {op,ctx,calls}=fixture();
    const output=parse(await op.handler({confirm:true},ctx));
    expect(output.mode).toBe('LIVE');
    expect(output.done).toBe(false);
    expect(calls.reads).toBe(0);
    expect(calls.writes).toBe(0);
  });
  it('refuses an absent owner grant, an unenabled account, a missing live key and database errors', async () => {
    vi.stubEnv('VERCEL_ENV','production');
    const {op,ctx,db,calls}=fixture();
    const base={...ctx,liveAccessGranted:undefined};
    expect(parse(await op.handler({confirm:true},base)).done).toBe(false);
    for (const row of [
      {id:connection.stripeAccount,live_enabled:false,live_connected:true},
      {id:connection.stripeAccount,live_enabled:true,live_connected:false},
      {id:'acct_WRONG',live_enabled:true,live_connected:true}
    ]) {
      expect(parse(await op.handler({confirm:true},{...ctx,db:{
        ...db,getStripeAccount:async()=>row
      }})).done).toBe(false);
    }
    expect(parse(await op.handler({confirm:true},{...ctx,db:{
      ...db,getStripeAccount:async()=>{throw Error('database offline');}
    }})).done).toBe(false);
    expect(calls.reads).toBe(0);
    expect(calls.writes).toBe(0);
  });
  it('requires confirmation even for non-money live writes, before touching Stripe', async () => {
    vi.stubEnv('VERCEL_ENV','production');
    const {op,ctx,calls}=fixture();
    const result=parse(await op.handler({},ctx));
    expect(result.mode).toBe('LIVE');
    expect(result.done).toBe(false);
    expect(calls.reads).toBe(0);
    expect(calls.writes).toBe(0);
  });
  it('runs only the isolated fake when all server-owned conditions are satisfied', async () => {
    vi.stubEnv('VERCEL_ENV','production');
    const {op,ctx,calls}=fixture();
    const output=parse(await op.handler({confirm:true,requestKey:'test-only'},ctx));
    expect(output.mode).toBe('LIVE');
    expect(output.done).toBe(true);
    expect(calls.writes).toBe(1);
    expect(calls.audits).toBe(2);
  });
  it('requires the two distinct steps within ten minutes of owner reauthentication', () => {
    const now=Date.UTC(2026,9,10,12);
    expect(isRecentOwnerVerification({confirmed:true,verifiedAt:now-60000,now})).toBe(true);
    expect(isRecentOwnerVerification({confirmed:true,verifiedAt:now-LIVE_REAUTH_WINDOW_MS,now})).toBe(true);
    expect(isRecentOwnerVerification({confirmed:false,verifiedAt:now,now})).toBe(false);
    expect(isRecentOwnerVerification({confirmed:true,verifiedAt:now-LIVE_REAUTH_WINDOW_MS-1,now})).toBe(false);
    expect(isRecentOwnerVerification({confirmed:true,verifiedAt:now+1,now})).toBe(false);
    expect(isRecentOwnerVerification({confirmed:true,verifiedAt:'today',now})).toBe(false);
  });
  it('cannot be bypassed by direct arguments claiming owner approval', async () => {
    vi.stubEnv('VERCEL_ENV','production');
    const {op,ctx,calls}=fixture();
    const supplied={confirm:true,liveAccessGranted:true,ownerVerified:true};
    const result=parse(await op.handler(supplied,{...ctx,liveAccessGranted:false}));
    expect(result.done).toBe(false);
    expect(calls.writes).toBe(0);
  });
});

describe('B-2b live activation intent, fake provider only', () => {
  it('needs confirmed first-step intent from FULL TEST connection; cannot directly activate', async () => {
    const { requestLiveEnableIntent } = await import('../../src/tools/live-guard.js');
    const { createFakeDb } = await import('../../test/helpers/fake-db.js');
    const db=createFakeDb({accounts:[{id:'acct_FAKE_LIVE',label:'Fake',live_connected:true}]});
    const connection={stripeAccount:'acct_FAKE_LIVE',mode:'test',profile:'full'};
    expect((await requestLiveEnableIntent({db,connection,confirm:false})).accepted).toBe(false);
    expect((await requestLiveEnableIntent({db,connection:{...connection,profile:'read_only'},confirm:true})).accepted).toBe(false);
    expect((await requestLiveEnableIntent({db,connection:{...connection,mode:'live'},confirm:true})).accepted).toBe(false);
    const intent=await requestLiveEnableIntent({db,connection,confirm:true});
    expect(intent.accepted).toBe(true);
    expect(intent.liveEnabled).toBe(false);
    expect(intent.id).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await db.getLiveEnableIntent(intent.id)).stripe_account).toBe(connection.stripeAccount);
    expect((await db.getStripeAccount(connection.stripeAccount)).live_enabled).not.toBe(true);
    expect(await db.consumeLiveEnableIntent({id:intent.id,allowActivation:false})).toBe(false);
    expect((await db.getStripeAccount(connection.stripeAccount)).live_enabled).not.toBe(true);
  });
});
