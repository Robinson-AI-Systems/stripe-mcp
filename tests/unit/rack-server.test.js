import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  FILE_ROUTES, resolveRoute, bodyLimitBytes, pinReleaseCommit, createRackServer,
} from '../../rack-server.mjs';
import { registry } from '../../src/tools/index.js';

// S-2 (RACK-STAGING): the rack entrypoint reproduces the Vercel
// contract — filesystem routes, the vercel.json rewrites verbatim,
// bracket segments as query parameters, per-function bodyParser
// handling, and the release-identity pin. HTTP legs run the real
// handlers with no store configured, so every answer is the
// production fail-closed / setup posture, never a fixture invention.
// The store-backed legs (registration write through the pg seam, the
// webhook receiver's raw-stream signature verification, health with
// database:true) run in the rack rehearsal battery against a fixture
// store, where a database exists; the db-side seam itself is proven
// by tests/db/transport.test.js.
describe('rack entrypoint route table', () => {
  it('binds every api/ function file at its Vercel path', () => {
    for (const [path, entry] of FILE_ROUTES) {
      const resolved = resolveRoute(path);
      expect(resolved, path).toBeTruthy();
      expect(typeof resolved.handler).toBe('function');
      expect(entry.handler).toBe(resolved.handler);
    }
    expect(FILE_ROUTES.size).toBe(17);
  });

  it('applies the vercel.json rewrites verbatim', () => {
    expect(resolveRoute('/health').handler).toBe(FILE_ROUTES.get('/api/health').handler);
    expect(resolveRoute('/api/openapi.json').handler).toBe(FILE_ROUTES.get('/api/openapi').handler);
    expect(resolveRoute('/.well-known/oauth-authorization-server').handler)
      .toBe(FILE_ROUTES.get('/api/well-known/oauth-authorization-server').handler);
    expect(resolveRoute('/.well-known/oauth-protected-resource').handler)
      .toBe(FILE_ROUTES.get('/api/well-known/oauth-protected-resource').handler);
    // RAS MCP Standard, Muse connection design MC-1: the Muse client
    // document and the path-scoped protected-resource document.
    expect(resolveRoute('/.well-known/oauth-protected-resource/api/mcp').handler)
      .toBe(FILE_ROUTES.get('/api/well-known/oauth-protected-resource').handler);
    expect(resolveRoute('/.well-known/muse-client.json').handler)
      .toBe(FILE_ROUTES.get('/api/well-known/muse-client').handler);
  });

  it('leaves / unrouted, exactly as production answers it today', () => {
    expect(resolveRoute('/')).toBeNull();
    expect(resolveRoute('/nope')).toBeNull();
    expect(resolveRoute('/api/nope')).toBeNull();
  });

  it('binds bracket segments as query parameters', () => {
    expect(resolveRoute('/api/tools/stripe_list_charges').query).toEqual({ name: 'stripe_list_charges' });
    expect(resolveRoute('/api/results/abc123').query).toEqual({ handle: 'abc123' });
    const hook = resolveRoute('/api/stripe/test-webhooks/acct_1/whsec_1');
    expect(hook.query).toEqual({ account: 'acct_1', endpoint: 'whsec_1' });
    // The receiver's exported bodyParser:false rides its route, so the
    // entrypoint leaves its stream untouched for HMAC verification.
    expect(bodyLimitBytes(hook.config)).toBe(0);
    // The exact /api/tools door is the index file, not the [name] door.
    expect(resolveRoute('/api/tools').handler).toBe(FILE_ROUTES.get('/api/tools').handler);
  });

  it('computes body limits from the exported configs', () => {
    expect(bodyLimitBytes(undefined)).toBe(4_572_800);
    expect(bodyLimitBytes({ api: { bodyParser: true } })).toBe(4_572_800);
    expect(bodyLimitBytes({ api: { bodyParser: false } })).toBe(0);
    expect(bodyLimitBytes({ api: { bodyParser: { sizeLimit: '1mb' } } })).toBe(1_048_576);
    expect(bodyLimitBytes({ api: { bodyParser: { sizeLimit: 2048 } } })).toBe(2048);
  });

  it('pins the release identity without ever synthesizing one', () => {
    const sha = 'a'.repeat(40);
    const platform = { VERCEL_GIT_COMMIT_SHA: sha };
    expect(pinReleaseCommit(platform)).toBe(sha);
    const rack = { RACK_RELEASE_COMMIT: sha };
    expect(pinReleaseCommit(rack)).toBe(sha);
    expect(rack.VERCEL_GIT_COMMIT_SHA).toBe(sha);
    const garbage = { RACK_RELEASE_COMMIT: 'not-a-sha' };
    expect(pinReleaseCommit(garbage)).toBeNull();
    expect(garbage.VERCEL_GIT_COMMIT_SHA).toBeUndefined();
  });
});

describe('rack entrypoint HTTP contract (no store configured)', () => {
  let server;
  let base;
  const savedEnv = {};
  beforeAll(async () => {
    for (const key of ['DATABASE_URL', 'PUBLIC_BASE_URL', 'STORE_TRANSPORT']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.PUBLIC_BASE_URL = 'https://fixture.example';
    server = createRackServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('answers the front door at /api in its setup posture', async () => {
    const res = await fetch(`${base}/api`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Stripe Unleashed by Robinson AI Systems');
    expect(body.status).toBe('setup-required');
    expect(body.tools).toBe(registry.tools.length);
  });

  it('answers health in the pinned shape, honestly degraded', async () => {
    for (const path of ['/api/health', '/health']) {
      const res = await fetch(`${base}${path}`);
      expect(res.status, path).toBe(503);
      const body = await res.json();
      expect(body.status).toBe('degraded');
      expect(body.checks).toEqual({ database: false });
      expect(body.tools).toBe(registry.tools.length);
      expect(Object.keys(body).sort()).toEqual(
        ['checks', 'commit', 'package_version', 'status', 'timestamp', 'tools', 'version']);
    }
  });

  it('answers discovery fail-closed without a store, as production does', async () => {
    // handleOAuth opens the store before every door, discovery
    // included, so an unconfigured instance answers the same 503
    // here as at the MCP door. The issuer-naming leg (200, issuer ==
    // the configured origin) runs in the rack rehearsal battery,
    // where a fixture store exists.
    const res = await fetch(`${base}/.well-known/oauth-authorization-server`);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('temporarily_unavailable');
  });

  it('404s the root, as production does', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('refuses a tokenless MCP call in the production shape', async () => {
    const res = await fetch(`${base}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    // No store configured: the handler's own fail-closed 503, reached
    // through the entrypoint's parsed-body path — not an entrypoint 500.
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('temporarily_unavailable');
  });

  it('parses JSON bodies before the handler (platform 400 on bad JSON)', async () => {
    const bad = await fetch(`${base}/api/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe('invalid_json');
    const good = await fetch(`${base}/api/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'rack-staging', redirect_uris: ['https://fixture.example/cb'] }),
    });
    // Well-formed: the handler itself answers, in its fail-closed shape.
    expect(good.status).toBe(503);
    expect((await good.json()).error).toBe('temporarily_unavailable');
  });

  it('routes the webhook receiver door to its handler', async () => {
    const res = await fetch(`${base}/api/stripe/test-webhooks/acct_1/whsec_1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=fixture' },
      body: JSON.stringify({ id: 'evt_fixture', type: 'ping' }),
    });
    // The receiver's own fail-closed shape (its store is unconfigured);
    // its raw-stream signature proof runs in the rehearsal battery.
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('receiver_unavailable');
  });
});
