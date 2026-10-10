import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createDb, CONNECTION_FIELDS } from '../../src/db.js';
import { hashToken } from '../../src/core/oauth.js';
import { openIsolatedSchema, closeIsolatedSchema, neonShapedQuery, rawQuery } from '../../test/helpers/pg-neon-adapter.js';

let db;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must be a disposable localhost Postgres');
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) {
    throw new Error('Refusing a remote database');
  }
  await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  db = createDb(neonShapedQuery());
  await db.initSchema();
});
afterAll(async () => { await closeIsolatedSchema(); });

describe('A-3 OAuth security on real isolated PostgreSQL', () => {
  it('registers a client without storing the client secret, and consumes hashed codes only once', async () => {
    await db.createOAuthClient({ clientId: 'client-1', clientSecret: 'fixture-secret-not-real',
      redirectUris: ['https://example.test/cb'], clientName: 'Example' });
    const client = await db.getOAuthClient('client-1');
    expect(client.client_secret_hash).toBe(hashToken('fixture-secret-not-real'));
    expect(client.redirect_uris).toEqual(['https://example.test/cb']);
    const scope = { stripeAccount: 'acct_fake_1', mode: 'test', profile: 'read_only', listing: 'compact' };
    await db.createAuthCode({ code: 'code-A', clientId: 'client-1', redirectUri: 'https://example.test/cb',
      codeChallenge: 'Z'.repeat(43), ...scope });
    const rows = await rawQuery('SELECT code FROM oauth_codes');
    expect(rows.map(r => r.code)).toContain(hashToken('code-A'));
    expect(await db.consumeAuthCode('code-A')).toMatchObject({
      client_id: 'client-1', stripe_account: scope.stripeAccount, mode: 'test',
      profile: 'read_only', listing: 'compact'
    });
    expect(await db.consumeAuthCode('code-A')).toBeNull();
    await db.createAuthCode({ code: 'expired-code', clientId: 'client-1',
      redirectUri: 'https://example.test/cb', ttlSeconds: -10 });
    expect(await db.consumeAuthCode('expired-code')).toBeNull();
  });

  it('keeps every scope setting across atomic refresh, refuses replay and client substitution', async () => {
    await db.createAccessToken({ accessToken: 'access-A', refreshToken: 'refresh-A', clientId: 'client-1',
      stripeAccount: 'acct_fake_2', mode: 'test', profile: 'full', listing: 'compact' });
    const [row] = await rawQuery('SELECT token_hash, refresh_hash FROM oauth_tokens WHERE client_id = $1', ['client-1']);
    expect(row.token_hash).not.toBe('access-A');
    expect(row.refresh_hash).not.toBe('refresh-A');
    expect(await db.getTokenByRefreshToken('refresh-A')).toMatchObject({ stripe_account: 'acct_fake_2',
      mode: 'test', profile: 'full', listing: 'compact' });
    const invalid = await db.rotateRefreshToken({ refreshToken: 'refresh-A', clientId: 'other-client',
      accessToken: 'bad', newRefreshToken: 'bad-refresh' });
    expect(invalid).toBeNull();
    const rotation = { refreshToken: 'refresh-A', clientId: 'client-1', accessToken: 'access-B', newRefreshToken: 'refresh-B' };
    const results = await Promise.all([db.rotateRefreshToken(rotation), db.rotateRefreshToken({
      ...rotation, accessToken: 'access-C', newRefreshToken: 'refresh-C'
    })]);
    expect(results.filter(Boolean)).toHaveLength(1);
    for (const field of CONNECTION_FIELDS) expect(results.find(Boolean)[field]).toEqual({
      stripe_account: 'acct_fake_2', mode: 'test', profile: 'full', listing: 'compact'
    }[field]);
    expect(await db.getTokenByRefreshToken('refresh-A')).toBeNull();
    expect(await db.getAccessToken('access-A')).toBeNull();
    const winningAccess = await db.getAccessToken('access-B') || await db.getAccessToken('access-C');
    expect(winningAccess).toMatchObject({ stripe_account: 'acct_fake_2', profile: 'full', listing: 'compact' });
    const active = (await db.getAccessToken('access-B')) ? 'access-B' : 'access-C';
    expect(await db.revokeAccessToken(active)).toBe(true);
    expect(await db.getAccessToken(active)).toBeNull();
    expect(await db.revokeAccessToken(active)).toBe(false);
  });

  it('persists failed login counts by IP and never counts succeeded attempts', async () => {
    const failed = await db.recordLoginAttempt('192.0.2.20');
    expect(await db.countRecentFailedLogins('192.0.2.20', 15)).toBe(1);
    await db.markLoginAttemptSucceeded(failed);
    expect(await db.countRecentFailedLogins('192.0.2.20', 15)).toBe(0);
    await db.recordLoginAttempt('192.0.2.20');
    expect(await db.countRecentFailedLogins('192.0.2.21', 15)).toBe(0);
    expect(await db.countRecentFailedLogins('192.0.2.20', 15)).toBe(1);
  });
});
