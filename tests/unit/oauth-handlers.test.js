import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { createOAuthHandlers } from '../../src/core/oauth-handlers.js';
import { requireMcpToken } from '../../src/core/mcp-auth.js';

const env = { PUBLIC_BASE_URL: 'https://stripe-mcp.example.test', ADMIN_PASSPHRASE: 'only-the-owner-knows' };
const resource = env.PUBLIC_BASE_URL + '/api/mcp';
const callback = 'https://client.example.test/cb';
const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
function request(method, data, headers = {}) {
  return { method, headers, body: method === 'GET' ? undefined : data, query: method === 'GET' ? data : undefined,
    socket: { remoteAddress: '198.51.100.1' } };
}
function response() {
  return { statusCode: 200, headers: {}, body: null, ended: false,
    setHeader(k,v) { this.headers[k] = v; return this; },
    status(s) { this.statusCode = s; return this; },
    send(v) { this.body = v; return this; },
    json(v) { this.body = JSON.stringify(v); return this; },
    end() { this.ended = true; return this; }
  };
}
async function call(handler, req) {
  const res = response();
  await handler(req,res);
  return res;
}
function json(res) { return JSON.parse(res.body); }
function createFixture() {
  let now = Date.now();
  const db = createFakeDb({ clock: () => now, accounts: [{ id: 'acct_fake_one', label: 'My Business', live_enabled: false }] });
  return { db, h: createOAuthHandlers({ db, env }), now: () => now, advance: n => { now += n; } };
}
async function register(h) {
  const res = await call(h.register, request('POST', { redirect_uris: [callback], client_name: 'Personal agent' }));
  expect(res.statusCode).toBe(201);
  return json(res);
}
function authorizeArgs(client) {
  return { client_id: client.client_id, redirect_uri: callback, response_type: 'code', code_challenge: challenge,
    code_challenge_method: 'S256', resource, state: 'nonce123', stripe_account: 'acct_fake_one',
    mode: 'test', profile: 'full', listing: 'compact' };
}
describe('personal-use OAuth HTTP endpoints', () => {
  it('publishes fixed HTTPS metadata and does not advertise weak PKCE', async () => {
    const { h } = createFixture();
    const auth = json(await call(h.metadata, request('GET', {})));
    expect(auth.issuer).toBe(env.PUBLIC_BASE_URL);
    expect(auth.code_challenge_methods_supported).toEqual(['S256']);
    expect(json(await call(h.resourceMetadata, request('GET', {}))).resource).toBe(resource);
  });
  it('rejects insecure redirect URIs and unsupported public-client auth', async () => {
    const { h } = createFixture();
    const res = await call(h.register, request('POST', { redirect_uris: ['http://evil.example.test/cb'] }));
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('invalid_client_metadata');
  });
  it('rejects oversized and conflicting registration metadata without creating clients', async () => {
    const { h } = createFixture();
    const baseline = { redirect_uris: [callback], client_name: 'Browser MCP' };
    const invalid = [
      { ...baseline, redirect_uris: ['https://client.example.test/' + 'x'.repeat(2050)] },
      { ...baseline, client_name: 'c'.repeat(101) },
      { ...baseline, client_name: 'malformed\nclient' },
      { ...baseline, client_name: 42 },
      { ...baseline, response_types: ['token'] },
      { ...baseline, response_types: ['code', 'token'] },
      { ...baseline, grant_types: ['client_credentials'] },
      { ...baseline, grant_types: ['authorization_code', 'authorization_code'] },
      { ...baseline, grant_types: ['refresh_token'] }
    ];
    for (const metadata of invalid) {
      const res = await call(h.register, request('POST', metadata));
      expect(res.statusCode).toBe(400);
      expect(json(res).error).toBe('invalid_client_metadata');
      expect(json(res)).not.toHaveProperty('client_id');
      expect(json(res)).not.toHaveProperty('client_secret');
    }
    const valid = await call(h.register, request('POST', {
      ...baseline, response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token']
    }));
    expect(valid.statusCode).toBe(201);
  });
  it('supports public PKCE-only MCP clients without issuing or accepting client secrets', async () => {
    const { db, h } = createFixture();
    const metadata = json(await call(h.metadata, request('GET', {})));
    expect(metadata.token_endpoint_auth_methods_supported).toContain('none');
    const registered = json(await call(h.register, request('POST', {
      redirect_uris: [callback], client_name: 'Public native MCP',
      token_endpoint_auth_method: 'none'
    })));
    expect(registered.token_endpoint_auth_method).toBe('none');
    expect(registered).not.toHaveProperty('client_secret');
    const stored = await db.getOAuthClient(registered.client_id);
    expect(stored.client_secret_hash).toBeNull();
    const args = authorizeArgs(registered);
    const authorized = await call(h.authorize, request('POST', {
      ...args, passphrase: env.ADMIN_PASSPHRASE, profile: 'read_only'
    }));
    expect(authorized.statusCode).toBe(302);
    const code = new URL(authorized.headers.Location).searchParams.get('code');
    const wrongPkce = await call(h.token, request('POST', {
      client_id: registered.client_id, grant_type: 'authorization_code',
      code, code_verifier: 'b'.repeat(43), redirect_uri: callback, resource
    }));
    expect(wrongPkce.statusCode).toBe(400);
    const second = await call(h.authorize, request('POST', {
      ...args, passphrase: env.ADMIN_PASSPHRASE, profile: 'read_only'
    }));
    const newCode = new URL(second.headers.Location).searchParams.get('code');
    const withSecret = await call(h.token, request('POST', {
      client_id: registered.client_id, client_secret: 'unexpected',
      grant_type: 'authorization_code', code: newCode,
      code_verifier: verifier, redirect_uri: callback, resource
    }));
    expect(withSecret.statusCode).toBe(401);
    const granted = await call(h.token, request('POST', {
      client_id: registered.client_id, grant_type: 'authorization_code',
      code: newCode, code_verifier: verifier, redirect_uri: callback, resource
    }));
    expect(granted.statusCode).toBe(200);
    const tokens = json(granted);
    expect(await db.getAccessToken(tokens.access_token)).toMatchObject({
      stripe_account: 'acct_fake_one', profile: 'read_only', mode: 'test'
    });
    const refreshed = await call(h.token, request('POST', {
      client_id: registered.client_id, grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token, resource
    }));
    expect(refreshed.statusCode).toBe(200);
    expect((await call(h.token, request('POST', {
      client_id: registered.client_id, grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token, resource
    }))).statusCode).toBe(400);
  });
  it('authenticates explicitly registered confidential Basic clients for grants and refresh', async () => {
    const { db, h } = createFixture();
    const metadata = json(await call(h.metadata, request('GET', {})));
    expect(metadata.token_endpoint_auth_methods_supported).toContain('client_secret_basic');
    const registered = json(await call(h.register, request('POST', {
      redirect_uris: [callback], client_name: 'Confidential MCP',
      token_endpoint_auth_method: 'client_secret_basic'
    })));
    expect(registered.token_endpoint_auth_method).toBe('client_secret_basic');
    const header = { authorization: 'Basic ' + Buffer.from(
      registered.client_id + ':' + registered.client_secret).toString('base64') };
    const args = authorizeArgs(registered);
    const approved = await call(h.authorize, request('POST', {
      ...args, passphrase: env.ADMIN_PASSPHRASE, profile: 'read_only'
    }));
    expect(approved.statusCode).toBe(302);
    const code = new URL(approved.headers.Location).searchParams.get('code');
    const grant = { grant_type: 'authorization_code', code,
      code_verifier: verifier, redirect_uri: callback, resource };
    for (const req of [
      request('POST', { ...grant, client_id: registered.client_id, client_secret: registered.client_secret }, header),
      request('POST', { ...grant, client_id: 'other-client' }, header),
      request('POST', grant, { authorization: 'Basic invalid' }),
      request('POST', grant)
    ]) {
      const denied = await call(h.token, req);
      expect(denied.statusCode).toBe(401);
      expect(json(denied).error).toBe('invalid_client');
    }
    const successful = await call(h.token, request('POST', grant, header));
    expect(successful.statusCode).toBe(200);
    const issued = json(successful);
    expect(await db.getAccessToken(issued.access_token)).toMatchObject({
      stripe_account: 'acct_fake_one', mode: 'test', profile: 'read_only'
    });
    const refreshed = await call(h.token, request('POST', {
      grant_type: 'refresh_token', refresh_token: issued.refresh_token, resource
    }, header));
    expect(refreshed.statusCode).toBe(200);
    const rotated = json(refreshed);
    expect(await db.getAccessToken(rotated.access_token)).toMatchObject({
      stripe_account: 'acct_fake_one', mode: 'test', profile: 'read_only'
    });
    expect((await call(h.token, request('POST', {
      grant_type: 'refresh_token', refresh_token: issued.refresh_token, resource
    }, header))).statusCode).toBe(400);
  });
  it('one setup persists through access expiration and rotates refresh without a new login', async () => {
    const { db, h, advance } = createFixture();
    const client = await register(h);
    const p = authorizeArgs(client);
    const page = await call(h.authorize, request('GET', p));
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('My Business');
    expect(page.body).toContain('value="full" selected');
    const authorized = await call(h.authorize, request('POST', { ...p, passphrase: env.ADMIN_PASSPHRASE }));
    expect(authorized.statusCode).toBe(302);
    const code = new URL(authorized.headers.Location).searchParams.get('code');
    const wrongSecret = await call(h.token, request('POST', {
      grant_type: 'authorization_code', client_id: client.client_id,
      client_secret: 'wrong-client-secret', redirect_uri: callback,
      code, code_verifier: verifier, resource }));
    expect(wrongSecret.statusCode).toBe(401);
    expect(json(wrongSecret).error).toBe('invalid_client');
    const granted = await call(h.token, request('POST', { grant_type: 'authorization_code',
      client_id: client.client_id, client_secret: client.client_secret, redirect_uri: callback,
      code, code_verifier: verifier, resource }));
    expect(granted.statusCode).toBe(200);
    const original = json(granted);
    expect(original.expires_in).toBe(3600);
    expect((await db.getAccessToken(original.access_token))).toMatchObject({
      stripe_account: 'acct_fake_one', mode: 'test', profile: 'full', listing: 'compact'
    });
    expect((await call(h.token, request('POST', { grant_type: 'authorization_code',
      client_id: client.client_id, client_secret: client.client_secret, redirect_uri: callback,
      code, code_verifier: verifier, resource }))).statusCode).toBe(400);
    // Simulate 45 days of inactivity: the access token expired long ago; its
    // hashed refresh credential must still work without a new owner sign-in.
    advance(45 * 86400 * 1000);
    expect(await db.getAccessToken(original.access_token)).toBeNull();
    const refreshed = await call(h.token, request('POST', {
      grant_type: 'refresh_token', client_id: client.client_id,
      client_secret: client.client_secret, refresh_token: original.refresh_token, resource }));
    expect(refreshed.statusCode).toBe(200);
    const second = json(refreshed);
    expect(await db.getAccessToken(second.access_token)).toMatchObject({
      stripe_account: 'acct_fake_one', profile: 'full', listing: 'compact'
    });
    const replay = await call(h.token, request('POST', { grant_type: 'refresh_token',
      client_id: client.client_id, client_secret: client.client_secret,
      refresh_token: original.refresh_token, resource }));
    expect(replay.statusCode).toBe(400);
    expect(json(replay).error).toBe('invalid_grant');
    expect((await call(h.token, request('POST', {
      grant_type: 'refresh_token', client_id: 'fake-other-client', client_secret: client.client_secret,
      refresh_token: second.refresh_token, resource }))).statusCode).toBe(401);
    expect((await call(h.token, request('POST', {
      grant_type: 'refresh_token', client_id: client.client_id, client_secret: client.client_secret,
      refresh_token: second.refresh_token, resource: 'https://elsewhere.example.test/api/mcp'
    }))).statusCode).toBe(400);
  });
  it('refuses forged live mode even with the correct admin passphrase', async () => {
    const { h } = createFixture();
    const client = await register(h);
    const result = await call(h.authorize, request('POST',
      { ...authorizeArgs(client), mode: 'live', passphrase: env.ADMIN_PASSPHRASE }));
    expect(result.statusCode).toBe(400);
  });
  it('locks the user after five wrong passwords; valid password cannot bypass it', async () => {
    const { h } = createFixture();
    const client = await register(h), p = authorizeArgs(client);
    for (let i = 0; i < 5; i++) {
      const r = await call(h.authorize, request('POST',{ ...p, passphrase: 'wrong' }));
      expect(r.statusCode).toBe(401);
    }
    const locked = await call(h.authorize, request('POST',{ ...p, passphrase: env.ADMIN_PASSPHRASE }));
    expect(locked.statusCode).toBe(429);
  });
  it('never allows MCP access without a valid scoped bearer', async () => {
    const { db } = createFixture();
    const missing = response();
    expect(await requireMcpToken(request('POST', {}), missing, db, env)).toBeNull();
    expect(missing.statusCode).toBe(401);
    await db.createAccessToken({ accessToken: 'a'.repeat(60), refreshToken: 'b'.repeat(60),
      clientId: 'owner', stripeAccount: 'acct_fake_one', profile: 'full', mode: 'test', listing: 'compact' });
    const allowed = await requireMcpToken(request('POST', {}, { authorization: 'Bearer ' + 'a'.repeat(60) }),
      response(), db, env);
    expect(allowed).toMatchObject({ stripeAccount: 'acct_fake_one', profile: 'full' });
    const other = response();
    expect(await requireMcpToken(request('POST', {},
      { authorization: 'Bearer ' + 'x'.repeat(60) }), other, db, env)).toBeNull();
    expect(other.statusCode).toBe(401);
  });
});
