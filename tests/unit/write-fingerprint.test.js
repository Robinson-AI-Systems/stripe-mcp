// Owner-obedience V2 (shared): preview-fingerprint binding in the
// guarded-write lifecycle. Uniform across modes (coordinator ruling 5):
// a confirmation that follows a preview presents the preview's
// fingerprint and is re-verified against a fresh evaluation; a direct
// confirmation with no preview presented keeps the prior behavior.
import { describe, expect, it } from 'vitest';
import { defineWrite } from '../../src/tools/write.js';
import { writePreviewFingerprint } from '../../src/core/write-fingerprint.js';

const parse = r => JSON.parse(r.content[0].text);
const FP = /^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/;

function fixture() {
  const state = {
    rec_ONE: { id: 'rec_ONE', status: 'old', version: 1 },
    rec_TWO: { id: 'rec_TWO', status: 'old', version: 1 }
  };
  const calls = { write: [], log: [] };
  const op = defineWrite({
    name: 'stripe_test_update',
    read: async a => ({ ...state[a.id] }),
    summarize: async before => 'Update ' + before.id + ' from ' + before.status + ' to new. TEST MODE.',
    apply: async (a, _ctx, options) => { calls.write.push(options); state[a.id].status = 'new'; },
    readAfter: async a => ({ ...state[a.id] }),
    verify: async (_before, after) => after.status === 'new',
    inverse: async () => ({ tool: 'stripe_test_restore', args: { id: 'fixture' } })
  });
  const ctx = { connection: { stripeAccount: 'acct_fixture', mode: 'test', profile: 'full' },
    connectionId: 'fixture-owner', db: {
      recordChange: async item => { calls.log.push(item); return calls.log.length; }
    } };
  return { op, ctx, calls, state };
}

describe('V2 shared preview-fingerprint binding (fake provider only)', () => {
  it('preview carries a fingerprint and a matching confirm executes exactly once', async () => {
    const { op, ctx, calls } = fixture();
    const preview = parse(await op.handler({ id: 'rec_ONE', dryRun: true }, ctx));
    expect(preview.done).toBe(false);
    expect(preview.previewFingerprint).toMatch(FP);
    const done = parse(await op.handler({ id: 'rec_ONE', confirm: true,
      requestKey: 'fp-happy', previewFingerprint: preview.previewFingerprint }, ctx));
    expect(done.done).toBe(true);
    expect(done.confirmed).toBe(true);
    expect(calls.write).toHaveLength(1);
  });
  it('the prompt path also carries the fingerprint', async () => {
    const { op, ctx } = fixture();
    const prompted = parse(await op.handler({ id: 'rec_ONE' }, ctx));
    expect(prompted.needsConfirmation).toBe(true);
    expect(prompted.previewFingerprint).toMatch(FP);
  });
  it('drift between preview and confirm refuses with the fresh fingerprint and executes nothing', async () => {
    const { op, ctx, calls, state } = fixture();
    const preview = parse(await op.handler({ id: 'rec_ONE', dryRun: true }, ctx));
    state.rec_ONE.version = 2; // the evaluated target moved after the preview
    const refused = parse(await op.handler({ id: 'rec_ONE', confirm: true,
      requestKey: 'fp-drift', previewFingerprint: preview.previewFingerprint }, ctx));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/changed since that preview/);
    expect(refused.previewFingerprint).toMatch(FP);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(refused.preview).toContain('rec_ONE');
    expect(calls.write).toEqual([]);
    // The fresh fingerprint is confirmable: the refusal is a re-disclosure, not a dead end.
    const done = parse(await op.handler({ id: 'rec_ONE', confirm: true,
      requestKey: 'fp-drift', previewFingerprint: refused.previewFingerprint }, ctx));
    expect(done.done).toBe(true);
    expect(calls.write).toHaveLength(1);
  });
  it('a fingerprint issued for a different target is refused', async () => {
    const { op, ctx, calls } = fixture();
    const other = parse(await op.handler({ id: 'rec_TWO', dryRun: true }, ctx));
    const refused = parse(await op.handler({ id: 'rec_ONE', confirm: true,
      requestKey: 'fp-cross', previewFingerprint: other.previewFingerprint }, ctx));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/changed since that preview/);
    expect(calls.write).toEqual([]);
  });
  it('a fabricated fingerprint is refused; a non-string fingerprint is invalid', async () => {
    const { op, ctx, calls } = fixture();
    const refused = parse(await op.handler({ id: 'rec_ONE', confirm: true,
      requestKey: 'fp-fake', previewFingerprint: 'WRITE-00000-00000-00000-00000' }, ctx));
    expect(refused.done).toBe(false);
    expect(calls.write).toEqual([]);
    const invalid = parse(await op.handler({ id: 'rec_ONE', confirm: true,
      previewFingerprint: 42 }, ctx));
    expect(invalid.error).toMatch(/confirmation flags/);
    expect(calls.write).toEqual([]);
  });
  it('a direct confirm with no preview presented behaves exactly as before', async () => {
    const { op, ctx, calls } = fixture();
    const done = parse(await op.handler({ id: 'rec_ONE', confirm: true, requestKey: 'fp-direct' }, ctx));
    expect(done.done).toBe(true);
    expect(done.confirmed).toBe(true);
    expect(calls.write).toHaveLength(1);
  });
});

describe('V2 shared writePreviewFingerprint helper', () => {
  const base = { tool: 'stripe_test_update', account: 'acct_fixture', mode: 'test',
    before: { id: 'rec_ONE', status: 'old', nested: { b: 2, a: 1 } },
    prepared: { previewLine: 'Do the thing', amountCents: 8500, currency: 'usd', direction: 'out' } };
  it('is stable for identical evaluated state, including key order', () => {
    const fp = writePreviewFingerprint(base);
    expect(fp).toMatch(FP);
    expect(writePreviewFingerprint({ ...base,
      before: { nested: { a: 1, b: 2 }, status: 'old', id: 'rec_ONE' } })).toBe(fp);
  });
  it('changes when any evaluated fact changes', () => {
    const fp = writePreviewFingerprint(base);
    const variants = [
      { ...base, tool: 'stripe_other' },
      { ...base, account: 'acct_other' },
      { ...base, mode: 'live' },
      { ...base, before: { ...base.before, status: 'new' } },
      { ...base, prepared: { ...base.prepared, amountCents: 9000 } },
      { ...base, prepared: { ...base.prepared, currency: 'eur' } },
      { ...base, prepared: { ...base.prepared, direction: 'in' } },
      { ...base, prepared: { ...base.prepared, previewLine: 'Do the other thing' } },
      { ...base, prepared: null }
    ];
    for (const variant of variants) expect(writePreviewFingerprint(variant)).not.toBe(fp);
  });
  it('a money preview fingerprint moves when the provider-derived amount moves', async () => {
    let refundable = 8500;
    const calls = { write: [] };
    const op = defineWrite({
      name: 'stripe_test_refund',
      read: async () => ({ refundableCents: refundable, status: 'before' }),
      summarize: async () => 'Refund the verified balance. TEST MODE.',
      money: async (_a, _c, before) => ({ amountCents: before.refundableCents,
        currency: 'usd', targetId: 'ch_FAKE1234', direction: 'out',
        description: 'Refund verified customer balance' }),
      apply: async (_a, _c, options) => { calls.write.push(options); },
      readAfter: async () => ({ status: 'after' }),
      verify: async () => true,
      inverse: async () => null
    });
    const ctx = { connection: { stripeAccount: 'acct_fixture', mode: 'test', profile: 'full' },
      connectionId: 'fixture-owner', moneyPolicyApproved: true,
      db: { recordChange: async () => 1 } };
    const first = parse(await op.handler({ dryRun: true }, ctx));
    refundable = 9000;
    const second = parse(await op.handler({ dryRun: true }, ctx));
    expect(first.previewFingerprint).toMatch(FP);
    expect(second.previewFingerprint).not.toBe(first.previewFingerprint);
    expect(calls.write).toEqual([]);
  });
});
