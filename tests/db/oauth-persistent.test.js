import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createDb } from '../../src/db.js';
import { openIsolatedSchema, closeIsolatedSchema, neonShapedQuery, rawQuery } from '../../test/helpers/pg-neon-adapter.js';
let db;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL || !['localhost','127.0.0.1','::1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname))
    throw new Error('Test requires disposable localhost Postgres');
  await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  db = createDb(neonShapedQuery());
  await db.initSchema();
});
afterAll(async () => { await closeIsolatedSchema(); });
describe('owner persistent OAuth session', () => {
  it('refresh survives expired access; rotates atomically, preserves scope and refuses revoked tokens', async () => {
    await db.createAccessToken({ accessToken: 'access-before', refreshToken: 'refresh-before', clientId: 'owner-connector',
      stripeAccount: 'acct_fake_owned', profile: 'full', mode: 'test', listing: 'compact', ttlSeconds: -3600 });
    expect(await db.getAccessToken('access-before')).toBeNull();
    expect(await db.getTokenByRefreshToken('refresh-before')).toMatchObject({
      client_id: 'owner-connector', stripe_account: 'acct_fake_owned', profile: 'full'
    });
    const rotation = await db.rotateRefreshToken({ refreshToken: 'refresh-before', clientId: 'owner-connector',
      accessToken: 'access-after', newRefreshToken: 'refresh-after' });
    expect(rotation).toMatchObject({ stripe_account: 'acct_fake_owned', profile: 'full', mode: 'test', listing: 'compact' });
    expect(await db.getAccessToken('access-after')).not.toBeNull();
    expect(await db.rotateRefreshToken({ refreshToken: 'refresh-before', clientId: 'owner-connector',
      accessToken: 'replayed', newRefreshToken: 'replayed-refresh' })).toBeNull();
    expect(await db.revokeAccessToken('access-after')).toBe(true);
    expect(await db.getTokenByRefreshToken('refresh-after')).toBeNull();
    expect(await db.rotateRefreshToken({ refreshToken: 'refresh-after', clientId: 'owner-connector',
      accessToken: 'unauthorized', newRefreshToken: 'unauthorized-refresh' })).toBeNull();
    const row = await rawQuery('SELECT token_hash, refresh_hash FROM oauth_tokens WHERE client_id = $1', ['owner-connector']);
    expect(row).toHaveLength(1);
    expect(row[0].token_hash).not.toBe('access-after');
    expect(row[0].refresh_hash).not.toBe('refresh-after');
  });
});
