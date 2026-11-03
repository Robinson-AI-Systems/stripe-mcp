// Fleet developer access boundary (Library D-001; RAS-MCP-CONFORMANCE row 4).
// Crossover must fail closed in BOTH directions: developer-context grants
// never reach public LIVE customer operations, and public customer grants
// never acquire developer context or use the operator handoff.
import { describe, it, expect } from 'vitest';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { createOAuthHandlers } from '../../src/core/oauth-handlers.js';
import { requireMcpToken } from '../../src/core/mcp-auth.js';
import { createHandoff } from '../../src/developer/handoff.js';
import {
  isDeveloperClient, contextForAuthorizationCode, resolveGrantContext,
  contextMayOperate, DEVELOPER_CALLBACK_PATH
} from '../../src/developer/access.js';
import frontDoor from '../../api/index.js';
import contractDoor from '../../api/contract.js';

const origin = 'https://stripe-mcp.example.test';
const env = { PUBLIC_BASE_URL: origin, ADMIN_PASSPHRASE: 'only-the-owner-knows' };
const liveEnv = { ...env, VERCEL_ENV: 'production' };
const resource = origin + '/api/mcp';
const devCallback = origin + DEVELOPER_CALLBACK_PATH;
const customerCallback = 'https://client.example.test/cb';
const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');

function request(method, data, headers = {}) {
  return { method, headers, body: method === 'GET' ? undefined : data,
    query: method === 'GET' ? data : undefined, socket: { remoteAddress: '198.51.100.1' } };
}
function response() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(s) { this.statusCode = s; return this; },
    send(v) { this.body = v; return this; },
    json(v) { this.body = v; return this; },
    end() { return this; } };
}
async function call(handler, req) { const res = response(); await handler(req, res); return res; }
function json(res) { return typeof res.body === 'string' ? JSON.parse(res.body) : res.body; }

function makeDb() {
  return createFakeDb({ accounts: [
    { id: 'acct_fake_one', label: 'Test Biz', live_enabled: false },
    { id: 'acct_fake_live', label: 'Live Biz', live_enabled: true, live_connected: true }
  ] });
}
async function register(h, redirectUris, name = 'Agent') {
  const res = await call(h.register, request('POST', { redirect_uris: redirectUris,
    client_name: name, token_endpoint_auth_method: 'client_secret_post' }));
  expect(res.statusCode).toBe(201);
  return json(res);
}
async function authorizeCode(h, client, { redirectUri, account = 'acct_fake_one', mode = 'test' }) {
  const res = await call(h.authorize, request('POST', {
    client_id: client.client_id, redirect_uri: redirectUri, response_type: 'code',
    code_challenge: challenge, code_challenge_method: 'S256', resource, state: 'nonce123',
    stripe_account: account, mode, profile: 'full', listing: 'compact',
    passphrase: env.ADMIN_PASSPHRASE }));
  expect(res.statusCode).toBe(302);
  return new URL(res.headers.Location).searchParams.get('code');
}
const SECRET_FIELD = 'client' + '_secret';
const REFRESH_FIELD = 'refresh' + '_token';
async function exchange(h, client, code, redirectUri) {
  const params = { grant_type: 'authorization_code', client_id: client.client_id,
    code, redirect_uri: redirectUri, code_verifier: verifier, resource };
  params[SECRET_FIELD] = client[SECRET_FIELD];
  return call(h.token, request('POST', params));
}
async function refresh(h, client, refreshToken) {
  const params = { grant_type: 'refresh_token', client_id: client.client_id, resource };
  params[SECRET_FIELD] = client[SECRET_FIELD];
  params[REFRESH_FIELD] = refreshToken;
  return call(h.token, request('POST', params));
}
const bearerReq = (token) => request('POST', {}, { authorization: 'Bearer ' + token });

describe('DeveloperAccess resolver', () => {
  it('recognises only the exact registered developer callback', () => {
    expect(DEVELOPER_CALLBACK_PATH).toBe('/api/developer/connect');
    expect(isDeveloperClient({ redirect_uris: [devCallback] }, origin)).toBe(true);
    expect(isDeveloperClient({ redirect_uris: [customerCallback] }, origin)).toBe(false);
    expect(isDeveloperClient({ redirect_uris: ['https://evil.example.test/api/developer/connect'] }, origin)).toBe(false);
    expect(isDeveloperClient(null, origin)).toBe(false);
    expect(contextForAuthorizationCode({ redirectUri: devCallback, origin })).toBe('developer');
    expect(contextForAuthorizationCode({ redirectUri: customerCallback, origin })).toBe('customer');
    expect(contextForAuthorizationCode({ redirectUri: 'https://evil.example.test/api/developer/connect', origin })).toBe('customer');
  });
  it('derives context from server records only; caller-shaped fields never raise it', () => {
    const devClient = { redirect_uris: [devCallback] };
    const custClient = { redirect_uris: [customerCallback] };
    expect(resolveGrantContext({ record: { context: 'developer' }, client: custClient, origin })).toBe('developer');
    expect(resolveGrantContext({ record: {}, client: devClient, origin })).toBe('developer');
    expect(resolveGrantContext({ record: { context: 'customer' }, client: custClient, origin })).toBe('customer');
    // A forged role/mode on the record is not a server-side proof.
    expect(resolveGrantContext({ record: { context: 'customer', role: 'developer', mode: 'live' }, client: custClient, origin })).toBe('customer');
    expect(contextMayOperate({ context: 'developer', mode: 'test' })).toBe(true);
    expect(contextMayOperate({ context: 'developer', mode: 'live' })).toBe(false);
    expect(contextMayOperate({ context: 'customer', mode: 'live' })).toBe(true);
  });
});

describe('grant context at issuance', () => {
  it('stamps developer context on handoff-minted grants and keeps TEST working end to end', async () => {
    const db = makeDb(); const h = createOAuthHandlers({ db, env });
    const client = await register(h, [devCallback], 'rtool developer client');
    const code = await authorizeCode(h, client, { redirectUri: devCallback });
    const granted = await exchange(h, client, code, devCallback);
    expect(granted.statusCode).toBe(200);
    const tokens = json(granted);
    expect((await db.getAccessToken(tokens.access_token)).context).toBe('developer');
    const connection = await requireMcpToken(bearerReq(tokens.access_token), response(), db, env);
    expect(connection).toMatchObject({ mode: 'test', context: 'developer' });
    // Refresh keeps the stamp; the operator connection's TEST flow is unchanged.
    const rotated = await refresh(h, client, tokens.refresh_token);
    expect(rotated.statusCode).toBe(200);
    expect((await db.getAccessToken(json(rotated).access_token)).context).toBe('developer');
  });
  it('stamps customer context on public-journey grants', async () => {
    const db = makeDb(); const h = createOAuthHandlers({ db, env });
    const client = await register(h, [customerCallback], 'Personal agent');
    const code = await authorizeCode(h, client, { redirectUri: customerCallback });
    const granted = await exchange(h, client, code, customerCallback);
    expect(granted.statusCode).toBe(200);
    expect((await db.getAccessToken(json(granted).access_token)).context).toBe('customer');
  });
  it('refuses to mint LIVE authority from a developer code, journaled, while customer LIVE still issues', async () => {
    const db = makeDb(); const h = createOAuthHandlers({ db, env: liveEnv });
    const devClient = await register(h, [devCallback], 'rtool developer client');
    const devCode = await authorizeCode(h, devClient, { redirectUri: devCallback, account: 'acct_fake_live', mode: 'live' });
    const refused = await exchange(h, devClient, devCode, devCallback);
    expect(refused.statusCode).toBe(400);
    expect(json(refused).error).toBe('invalid_grant');
    expect(json(refused).access_token).toBeUndefined();
    expect(db.boundaryEvents).toContainEqual({ surface: 'oauth_token', context: 'developer',
      mode: 'live', reason: 'developer_live_issuance_refused', client_id: devClient.client_id });
    const custClient = await register(h, [customerCallback], 'Personal agent');
    const custCode = await authorizeCode(h, custClient, { redirectUri: customerCallback, account: 'acct_fake_live', mode: 'live' });
    const granted = await exchange(h, custClient, custCode, customerCallback);
    expect(granted.statusCode).toBe(200);
    expect((await db.getAccessToken(json(granted).access_token)).context).toBe('customer');
  });
});

describe('MCP door crossover', () => {
  it('refuses a legacy unstamped developer LIVE grant via its registered client', async () => {
    const db = makeDb(); const h = createOAuthHandlers({ db, env });
    const devClient = await register(h, [devCallback], 'rtool developer client');
    // Minted before context typing existed: no stamp on the row.
    await db.createAccessToken({ accessToken: 'l'.repeat(50), refreshToken: 'm'.repeat(50),
      clientId: devClient.client_id, stripeAccount: 'acct_fake_live', mode: 'live',
      profile: 'full', listing: 'compact' });
    expect((await db.getAccessToken('l'.repeat(50))).context).toBe('customer');
    const res = response();
    expect(await requireMcpToken(bearerReq('l'.repeat(50)), res, db, liveEnv)).toBeNull();
    expect(res.statusCode).toBe(401);
    expect(db.boundaryEvents).toContainEqual({ surface: 'mcp', context: 'developer',
      mode: 'live', reason: 'developer_live_access_refused', client_id: devClient.client_id });
  });
  it('refuses a stamped developer LIVE grant even on a customer client, and admits developer TEST', async () => {
    const db = makeDb(); const h = createOAuthHandlers({ db, env });
    const custClient = await register(h, [customerCallback], 'Personal agent');
    await db.createAccessToken({ accessToken: 'd'.repeat(50), refreshToken: 'e'.repeat(50),
      clientId: custClient.client_id, stripeAccount: 'acct_fake_live', mode: 'live',
      profile: 'full', listing: 'compact', context: 'developer' });
    const res = response();
    expect(await requireMcpToken(bearerReq('d'.repeat(50)), res, db, liveEnv)).toBeNull();
    expect(res.statusCode).toBe(401);
    await db.createAccessToken({ accessToken: 't'.repeat(50), refreshToken: 'u'.repeat(50),
      clientId: custClient.client_id, stripeAccount: 'acct_fake_one', mode: 'test',
      profile: 'full', listing: 'compact', context: 'developer' });
    const connection = await requireMcpToken(bearerReq('t'.repeat(50)), response(), db, env);
    expect(connection).toMatchObject({ mode: 'test', context: 'developer' });
  });
  it('keeps the refusal when the journal write itself fails', async () => {
    const stubDb = {
      getAccessToken: async () => ({ client_id: 'c1', stripe_account: 'acct_fake_live',
        mode: 'live', profile: 'full', listing: 'compact', kind: 'connector',
        context: 'developer', allow_writes: false, result_scope: 'scope' }),
      getOAuthClient: async () => null,
      getStripeAccount: async () => ({ id: 'acct_fake_live', live_enabled: true, live_connected: true }),
      recordDeveloperBoundaryEvent: async () => { throw new Error('journal down'); }
    };
    const res = response();
    expect(await requireMcpToken(bearerReq('q'.repeat(50)), res, stubDb, liveEnv)).toBeNull();
    expect(res.statusCode).toBe(401);
  });
});

describe('refresh crossover', () => {
  it('refuses to refresh a legacy developer LIVE grant and leaves the credential unconsumed', async () => {
    const db = makeDb(); const h = createOAuthHandlers({ db, env: liveEnv });
    const devClient = await register(h, [devCallback], 'rtool developer client');
    await db.createAccessToken({ accessToken: 'g'.repeat(50), refreshToken: 'r'.repeat(50),
      clientId: devClient.client_id, stripeAccount: 'acct_fake_live', mode: 'live',
      profile: 'full', listing: 'compact' });
    const refused = await refresh(h, devClient, 'r'.repeat(50));
    expect(refused.statusCode).toBe(400);
    expect(json(refused).error).toBe('invalid_grant');
    expect(db.boundaryEvents).toContainEqual({ surface: 'oauth_token', context: 'developer',
      mode: 'live', reason: 'developer_live_refresh_refused', client_id: devClient.client_id });
    // Refusal happened before rotation: the original grant is untouched.
    expect(await db.getAccessToken('g'.repeat(50))).not.toBeNull();
    expect((await db.getTokenByRefreshToken('r'.repeat(50))).client_id).toBe(devClient.client_id);
  });
  it('still refreshes a customer LIVE grant', async () => {
    const db = makeDb(); const h = createOAuthHandlers({ db, env: liveEnv });
    const custClient = await register(h, [customerCallback], 'Personal agent');
    await db.createAccessToken({ accessToken: 'h'.repeat(50), refreshToken: 's'.repeat(50),
      clientId: custClient.client_id, stripeAccount: 'acct_fake_live', mode: 'live',
      profile: 'full', listing: 'compact' });
    const rotated = await refresh(h, custClient, 's'.repeat(50));
    expect(rotated.statusCode).toBe(200);
    expect((await db.getAccessToken(json(rotated).access_token)).context).toBe('customer');
  });
});

describe('public grants cannot use the operator handoff', () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pollSecret = 'p'.repeat(43);
  const startBody = (clientId) => ({ client_id: clientId, challenge: 'c'.repeat(43),
    poll_hash: createHash('sha256').update(pollSecret).digest('hex'),
    public_key: keys.publicKey.export({ type: 'spki', format: 'pem' }), profile: 'full' });
  function storeFixture() {
    let row;
    return { store: {
      async start(p) { row = { ...p, expires_at: p.expires, status: 'pending' }; return true; },
      async find(state) { return row?.state === state ? row : null; },
      async codeProof() { return null; },
      async approve() { return false; },
      async deny() {},
      async poll(state, hash) { return row?.state === state && row.poll_hash === hash ? row : null; }
    }, row: () => row };
  }
  it('refuses a registered customer client at handoff start, journaled', async () => {
    const { store } = storeFixture();
    const events = [];
    const handler = createHandoff({ store, origin,
      getClient: async () => ({ redirect_uris: [customerCallback] }),
      journal: async (event) => { events.push(event); } });
    const res = response();
    await handler({ method: 'POST', body: startBody('customer_client'), headers: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_client');
    expect(events).toContainEqual({ surface: 'developer_connect', context: 'developer',
      mode: null, reason: 'client_not_developer', clientId: 'customer_client' });
  });
  it('does not accept a connector bearer token as the polling credential', async () => {
    const { store, row } = storeFixture();
    const handler = createHandoff({ store, origin,
      getClient: async () => ({ redirect_uris: [devCallback] }) });
    await handler({ method: 'POST', body: startBody('developer_client'), headers: {} }, response());
    const withBearer = response();
    await handler({ method: 'GET', query: { state: row().state },
      headers: { authorization: 'Bearer ' + 'z'.repeat(43) } }, withBearer);
    expect(withBearer.statusCode).toBe(410);
    const noHeader = response();
    await handler({ method: 'GET', query: { state: row().state }, headers: {} }, noHeader);
    expect(noHeader.statusCode).toBe(401);
    const withPollSecret = response();
    await handler({ method: 'GET', query: { state: row().state },
      headers: { authorization: 'Bearer ' + pollSecret } }, withPollSecret);
    expect(withPollSecret.statusCode).toBe(202);
  });
});

describe('public surfaces carry no developer sign-in', () => {
  it('front door, contract advertisement and OAuth metadata show no developer route', async () => {
    const doorRes = response();
    frontDoor({}, doorRes);
    expect(JSON.stringify(doorRes.body)).not.toContain('/api/developer');
    const contractRes = response();
    contractDoor({ method: 'GET', headers: {} }, contractRes);
    expect(String(contractRes.body)).not.toContain('/api/developer');
    const db = makeDb(); const h = createOAuthHandlers({ db, env });
    const meta = await call(h.metadata, request('GET', {}));
    expect(JSON.stringify(json(meta))).not.toContain('developer');
  });
  it('public docs and the tool catalog never link the operator surface', () => {
    for (const path of ['docs/TOOL-CATALOG.md', 'README.md', 'docs/OWNER-GUIDE.md']) {
      const text = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
      expect(text).not.toContain('/api/developer');
    }
  });
});
