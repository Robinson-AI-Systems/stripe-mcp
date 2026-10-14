import { describe, expect, it } from 'vitest';
import { defineWrite } from '../../src/tools/write.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';

function parse(r) { return JSON.parse(r.content[0].text); }
function make() {
  const calls = { write: [], read: [], after: [], log: [] };
  let actual = 'new';
  const db = createFakeDb();
  const op = defineWrite({
    name: 'stripe_test_update',
    read: async () => ({ status: 'old' }),
    summarize: async () => 'Update the fake fixture from old to new. TEST MODE.',
    apply: async (_args, _ctx, options) => { calls.write.push(options); },
    readAfter: async () => { calls.after.push('read'); return { status: actual }; },
    verify: async (_before, after) => after.status === 'new',
    inverse: async () => ({ tool: 'stripe_test_restore', args: { id: 'fixture' } })
  });
  const ctx = { connection: { stripeAccount: 'acct_fixture', mode: 'test', profile: 'full' },
    connectionId: 'fixture-owner', db: {
      recordChange: async item => { calls.log.push(item); return calls.log.length; }
    } };
  return { calls, op, ctx, failReadBack: () => { actual = 'unchanged'; }, db };
}

describe('B-1a fail-closed write lifecycle (fake provider only)', () => {
  it('dry-run previews, writes NOTHING and logs the preview', async () => {
    const { op, ctx, calls } = make();
    const out = parse(await op.handler({ dryRun: true, confirm: true }, ctx));
    expect(out.done).toBe(false);
    expect(out.preview).toMatch(/TEST MODE/);
    expect(calls.write).toEqual([]);
    expect(calls.log).toMatchObject([{ dryRun: true, tool: 'stripe_test_update' }]);
  });
  it('never writes until user explicitly confirms, and refuses fabricated flags', async () => {
    const { op, ctx, calls } = make();
    expect(parse(await op.handler({}, ctx)).needsConfirmation).toBe(true);
    expect(parse(await op.handler({ confirm: 'yes' }, ctx)).error).toMatch(/confirmation flags/);
    expect(calls.write).toEqual([]);
    expect(calls.log).toEqual([]);
  });
  it('uses one idempotency key and independently verifies read-back', async () => {
    const { op, ctx, calls } = make();
    const out = parse(await op.handler({ confirm: true, requestKey: 'one-request' }, ctx));
    expect(out.done).toBe(true);
    expect(out.confirmed).toBe(true);
    expect(calls.write).toHaveLength(1);
    expect(calls.write[0].idempotencyKey).toBe(out.idempotencyKey);
    expect(calls.after).toEqual(['read']);
    expect(calls.log).toHaveLength(2);
    expect(calls.log[0].summary).toMatch(/^PENDING:/);
    expect(calls.log[1]).toMatchObject({ dryRun: false, idempotencyKey: out.idempotencyKey,
      inverse: { tool: 'stripe_test_restore' } });
  });
  it('reports an uncertain result if independent read-back does not match', async () => {
    const { op, ctx, calls, failReadBack } = make();
    failReadBack();
    const result = parse(await op.handler({ confirm: true }, ctx));
    expect(result.confirmed).toBe(false);
    expect(result.done).toBe(false);
    expect(result.warning).toMatch(/Read-back/);
    expect(calls.write).toHaveLength(1);
    expect(calls.log.at(-1).dryRun).toBe(false);
  });
  it('denies live mode, read_only, missing audit store and missing selected account', async () => {
    const { op, ctx, calls } = make();
    for (const c of [{ ...ctx.connection, mode: 'live' }, { ...ctx.connection, profile: 'read_only' },
      { ...ctx.connection, stripeAccount: null }]) {
      expect(parse(await op.handler({ confirm: true }, { ...ctx, connection: c })).done).toBe(false);
    }
    expect(parse(await op.handler({ confirm: true }, { ...ctx, db: {} })).error).toMatch(/Audit/);
    expect(calls.write).toEqual([]);
  });
  it('fails closed on unsupported money procedures and missing preview, not a no-op stub', async () => {
    expect(() => defineWrite({ name: 'stripe_money', money: 100 })).toThrow(/Money spec must be a function/);
    expect(() => defineWrite({ name: 'stripe_example', read: async () => ({}) })).toThrow(/must be a function/);
    const { op, ctx } = make();
    expect(op.tool.writes).toBe(true);
    expect(op.tool.inputSchema.properties.confirm.type).toBe('boolean');
    expect(parse(await op.handler({ confirm: true }, { ...ctx, connection: { mode: 'test' } })).done).toBe(false);
  });
  it('never calls provider when the audit-intent write fails', async () => {
    const { op, ctx, calls } = make();
    const broken = { recordChange: async () => { throw new Error('DB unavailable'); } };
    const answer = parse(await op.handler({ confirm: true }, { ...ctx, db: broken }));
    expect(answer.done).toBe(false);
    expect(answer.error).toMatch(/record intent/);
    expect(calls.write).toHaveLength(0);
  });
});

describe('safe optional verified resource ID contract',()=>{
  it('rejects nonfunction hooks during registration',()=>{
    expect(()=>defineWrite({name:'stripe_bad_receipt',read:async()=>({}),
      summarize:async()=> 'TEST MODE preview',apply:async()=>{},
      readAfter:async()=>({}),verify:async()=>true,resultId:'unsafe'}))
      .toThrow(/must be a function/);
  });
  it('does not export arbitrary provider text or ID until verification and audit',async()=>{
    let verified=true;
    const f=()=>defineWrite({name:'stripe_resource_receipt',read:async()=>({}),
      summarize:async()=> 'TEST MODE safe operation',
      apply:async()=>{},readAfter:async()=>({id:'cus_RECEIPT123',email:'private@example.com'}),
      verify:async()=>verified,resultId:(_before,after)=>after.id});
    const ctx={connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'},
      db:{recordChange:async()=>1}};
    const op=f();
    const parse=r=>JSON.parse(r.content[0].text);
    expect(parse(await op.handler({dryRun:true},ctx)).resourceId).toBeUndefined();
    const done=parse(await op.handler({confirm:true,requestKey:'receipt-valid'},ctx));
    expect(done.resourceId).toBe('cus_RECEIPT123');
    expect(JSON.stringify(done)).not.toContain('private@example.com');
    verified=false;
    expect(parse(await op.handler({confirm:true,requestKey:'receipt-unverified'},ctx))
      .resourceId).toBeUndefined();
  });
  it('keeps confirmed provider state truthful when a receipt is unsafe',async()=>{
    const op=defineWrite({name:'stripe_unsafe_receipt',read:async()=>({}),
      summarize:async()=> 'TEST MODE safe operation',apply:async()=>{},
      readAfter:async()=>({id:'sk_test_private'}),verify:async()=>true,
      resultId:(_before,after)=>after.id});
    const ctx={connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'},
      db:{recordChange:async()=>1}};
    const res=JSON.parse((await op.handler({confirm:true,requestKey:'unsafe-receipt'},ctx)).content[0].text);
    expect(res.done).toBe(true);
    expect(res.resourceId).toBeUndefined();
    expect(res.warning).toMatch(/safe resource ID is unavailable/);
  });
});
