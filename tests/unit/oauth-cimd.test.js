import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { createOAuthHandlers } from '../../src/core/oauth-handlers.js';
import { clearCimdCache } from '../../src/core/cimd.js';

const env = { PUBLIC_BASE_URL: 'https://stripe-mcp.example.test', ADMIN_PASSPHRASE: 'only-the-owner-knows' };
const resource = env.PUBLIC_BASE_URL + '/api/mcp';
const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const CARD_URL = 'https://cards.example.test/card-client.json';
const CARD_CALLBACK = 'https://client.example.test/cb';
const publicLookup = async () => ['93.184.216.34'];

function request(method, data, headers = {}) {
  return { method, headers, body: method === 'GET' ? undefined : data, query: method === 'GET' ? data : undefined,
    socket: { remoteAddress: '198.51.100.1' } };
}
function response() {
  return { statusCode: 200, headers: {}, body: null, ended: false,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(s) { this.statusCode = s; return this; },
    send(v) { this.body = v; return this; },
    json(v) { this.body = JSON.stringify(v); return this; },
    end() { this.ended = true; return this; } };
}
async function call(handler, req) { const res = response(); await handler(req, res); return res; }
function json(res) { return JSON.parse(res.body); }

function cardFetch(doc) {
  return async () => ({ ok: true, status: 200,
    headers: { get: () => null }, text: async () => JSON.stringify(doc) });
}
function fixture(doc) {
  const db = createFakeDb({ accounts: [{ id: 'acct_fake_one', label: 'My Business', live_enabled: false }] });
  const h = createOAuthHandlers({ db, env, fetchImpl: cardFetch(doc), lookupImpl: publicLookup });
  return { db, h };
}
function goodCard(overrides = {}) {
  return { client_id: CARD_URL, client_name: 'Card Client',
    redirect_uris: [CARD_CALLBACK], token_endpoint_auth_method: 'none', ...overrides };
}
function authorizeArgs(overrides = {}) {
  return { client_id: CARD_URL, redirect_uri: CARD_CALLBACK, response_type: 'code',
    code_challenge: challenge, code_challenge_method: 'S256', resource, state: 'nonce123',
    stripe_account: 'acct_fake_one', mode: 'test', ...overrides };
}

describe('CIMD card clients through the OAuth handlers', () => {
  beforeEach(() => clearCimdCache());

  it('completes authorize + token exchange for a valid card client with no secret', async () => {
    const { h } = fixture(goodCard());
    const authorized = await call(h.authorize, request('POST', {
      ...authorizeArgs(), passphrase: env.ADMIN_PASSPHRASE
    }));
    expect(authorized.statusCode).toBe(302);
    const code = new URL(authorized.headers.Location).searchParams.get('code');
    expect(code).toBeTruthy();
    const granted = await call(h.token, request('POST', {
      client_id: CARD_URL, grant_type: 'authorization_code', code,
      code_verifier: verifier, redirect_uri: CARD_CALLBACK, resource
    }));
    expect(granted.statusCode).toBe(200);
    expect(json(granted)).toMatchObject({ token_type: 'Bearer' });
    expect(json(granted).access_token).toBeTruthy();
    expect(json(granted).refresh_token).toBeTruthy();
  });

  it('refuses a redirect address that is not printed on the card', async () => {
    const { h } = fixture(goodCard());
    const res = await call(h.authorize, request('POST', {
      ...authorizeArgs({ redirect_uri: 'https://client.example.test/other' }),
      passphrase: env.ADMIN_PASSPHRASE
    }));
    expect(res.statusCode).toBe(400);
    expect(json(res).error_description).toMatch(/Unknown client or redirect/);
  });

  it('refuses the whole flow when the card holds a secret', async () => {
    const { h } = fixture(goodCard({ client_secret: 'cs_FAKE_secret_value' }));
    const res = await call(h.authorize, request('POST', {
      ...authorizeArgs(), passphrase: env.ADMIN_PASSPHRASE
    }));
    expect(res.statusCode).toBe(400);
    expect(json(res).error_description).toMatch(/Unknown client or redirect/);
  });

  it('accepts a loopback redirect on an ephemeral port for a card client (Claude Code shape)', async () => {
    const { h } = fixture(goodCard({ redirect_uris: ['http://localhost:5555/callback'] }));
    const authorized = await call(h.authorize, request('POST', {
      ...authorizeArgs({ redirect_uri: 'http://localhost:61234/callback' }),
      passphrase: env.ADMIN_PASSPHRASE
    }));
    expect(authorized.statusCode).toBe(302);
    const code = new URL(authorized.headers.Location).searchParams.get('code');
    const granted = await call(h.token, request('POST', {
      client_id: CARD_URL, grant_type: 'authorization_code', code,
      code_verifier: verifier, redirect_uri: 'http://localhost:61234/callback', resource
    }));
    expect(granted.statusCode).toBe(200);
  });

  it('does not relax redirect matching for non-loopback card addresses', async () => {
    const { h } = fixture(goodCard());
    const res = await call(h.authorize, request('POST', {
      ...authorizeArgs({ redirect_uri: 'https://client.example.test/cb/' }),
      passphrase: env.ADMIN_PASSPHRASE
    }));
    expect(res.statusCode).toBe(400);
  });

  it('advertises card-client support in discovery metadata', async () => {
    const { h } = fixture(goodCard());
    const metadata = json(await call(h.metadata, request('GET', {})));
    expect(metadata.client_id_metadata_document_supported).toBe(true);
  });
});

describe('consent journey: one sign-in, effective access displayed', () => {
  beforeEach(() => clearCimdCache());

  it('renders no profile or listing choice and displays the resulting effective access', async () => {
    const { h } = fixture(goodCard());
    const page = await call(h.authorize, request('GET', authorizeArgs()));
    expect(page.statusCode).toBe(200);
    expect(page.body).not.toContain('name="profile"');
    expect(page.body).not.toContain('name="listing"');
    expect(page.body).toContain('Access this connection will have');
    expect(page.body).toContain('Full access to the selected Stripe account');
    expect(page.body).toContain('not separate sign-ins');
  });

  it('defaults a connection to full access when no profile setting is supplied', async () => {
    const { db, h } = fixture(goodCard());
    const authorized = await call(h.authorize, request('POST', {
      ...authorizeArgs(), passphrase: env.ADMIN_PASSPHRASE
    }));
    expect(authorized.statusCode).toBe(302);
    const code = new URL(authorized.headers.Location).searchParams.get('code');
    const granted = await call(h.token, request('POST', {
      client_id: CARD_URL, grant_type: 'authorization_code', code,
      code_verifier: verifier, redirect_uri: CARD_CALLBACK, resource
    }));
    expect(granted.statusCode).toBe(200);
    const record = await db.getAccessToken(json(granted).access_token);
    expect(record).toMatchObject({ profile: 'full' });
  });
});
