// VER-1 release provenance + fleet health contract + identity anchoring.
// No provider calls: initialize runs over an in-memory transport pair,
// whoami runs against the fake DB, and every other surface is a pure
// function or a handler invoked with a mock response.
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registry } from '../../src/tools/index.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { createMcpServer, dispatchReadOnlyTool } from '../../src/core/mcp-server.js';
import { rtcManifest } from '../../src/core/rtc-http.js';
import { createOAuthHandlers } from '../../src/core/oauth-handlers.js';
import { deployedCommit, packageVersion, releaseVersion, serverRelease }
  from '../../src/release.js';
import { checkDatabase, healthReadout } from '../../src/health.js';
import healthHandler from '../../api/health.js';
import frontDoorHandler, { createFrontDoorHandler } from '../../api/index.js';
import { profileCounts } from '../../src/core/profiles.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const env = { VERCEL_GIT_COMMIT_SHA: SHA };
const connection = { stripeAccount: 'acct_FAKESETUP', mode: 'test',
  profile: 'read_only', listing: 'compact' };

function response() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    send(value) { this.body = value; return this; },
    json(value) { this.body = value; return this; } };
}

describe('VER-1 checked release source', () => {
  it(' composes <package>+<commit12> only from verified build metadata', () => {
    expect(packageVersion()).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+/);
    expect(deployedCommit(env)).toBe(SHA);
    expect(releaseVersion(env)).toBe(packageVersion() + '+' + SHA.slice(0, 12));
    const release = serverRelease(env);
    expect(release.commit).toBe(SHA);
    expect(release.source).toBe(
      'https://github.com/Robinson-AI-Systems/stripe-mcp/commit/' + SHA);
    expect(release.what_changed).toContain('/commits/live');
    expect(release.what_changed).toContain('main is not necessarily');
  });
  it('states an unknown commit as unknown and never synthesises one', () => {
    for (const bad of [{}, { VERCEL_GIT_COMMIT_SHA: 'main' },
      { VERCEL_GIT_COMMIT_SHA: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01' },
      { VERCEL_GIT_COMMIT_SHA: SHA + 'ff' }, { VERCEL_GIT_COMMIT_SHA: 42 }]) {
      expect(deployedCommit(bad)).toBeNull();
      expect(releaseVersion(bad)).toBe(packageVersion() + '+unknown');
      const release = serverRelease(bad);
      expect(release.commit).toBeNull();
      expect(release.source).toBeNull();
      expect(release.what_changed).toContain('unknown');
    }
  });
});

describe('VER-1 surfaces agree (CAP-5 agreement check, no provider calls)', () => {
  it('initialize, whoami, manifest, health and the front door report one release', async () => {
    const saved = process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.VERCEL_GIT_COMMIT_SHA = SHA;
    try {
      // initialize: a real MCP handshake against the server factory.
      const server = createMcpServer({ db: createFakeDb(), registry,
        connection, env: process.env });
      const client = new Client({ name: 'ver1-agreement-test', version: '0.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const initializeVersion = client.getServerVersion()?.version;
      await client.close();
      await server.close();
      expect(initializeVersion).toBe(releaseVersion(env));

      // whoami: the authenticated identity tool carries server_release.
      const db = createFakeDb();
      await db.saveTestKey({ account: 'acct_FAKESETUP', label: 'My Project',
        ciphertext: 'v1.cipher-only', kind: 'restricted', last4: 'FAKE',
        permissions: { customers: 'ok' } });
      const who = await dispatchReadOnlyTool({ registry, name: 'stripe_whoami',
        args: {}, connection, db });
      const whoami = JSON.parse(who.content[0].text);
      expect(whoami.server_release).toEqual(serverRelease(env));

      // manifest: package version + explicit revision + the health path.
      const manifest = rtcManifest(registry,
        { sha: SHA, ref: 'live', environment: 'production' });
      expect(manifest.version).toBe(packageVersion());
      expect(manifest.revision).toBe(SHA);
      expect(manifest.health).toBe('/api/health');

      // health: same identity in the pinned shape.
      const health = healthReadout({ env, toolCount: registry.tools.length,
        database: true, now: new Date('2026-11-02T22:00:00.000Z') });
      expect(health).toEqual({ status: 'ok', version: releaseVersion(env),
        package_version: packageVersion(), commit: SHA,
        tools: registry.tools.length, timestamp: '2026-11-02T22:00:00.000Z',
        checks: { database: true } });

      // front door: same identity, rendered from live state.
      const res = response();
      await frontDoorHandler({ method: 'GET', headers: {} }, res);
      expect(res.body.version).toBe(releaseVersion(env));
      expect(res.body.commit).toBe(SHA);
      expect(res.body.tools).toBe(registry.tools.length);
      expect(res.body.health).toBe('/api/health');
      expect(res.body.name).toBe('Stripe Unleashed by Robinson AI Systems');
    } finally {
      if (saved === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = saved;
    }
  });
  it('every surface states the revision as unknown when no commit is checked', async () => {
    const saved = process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    try {
      const manifest = rtcManifest(registry, {});
      expect(manifest.version).toBe(packageVersion());
      expect(manifest.revision).toBeNull();
      const health = healthReadout({ toolCount: 1, database: true });
      expect(health.commit).toBeNull();
      expect(health.version).toBe(packageVersion() + '+unknown');
      const db = createFakeDb();
      await db.saveTestKey({ account: 'acct_FAKESETUP', label: 'My Project',
        ciphertext: 'v1.cipher-only', kind: 'restricted', last4: 'FAKE',
        permissions: {} });
      const who = await dispatchReadOnlyTool({ registry, name: 'stripe_whoami',
        args: {}, connection, db });
      expect(JSON.parse(who.content[0].text).server_release.commit).toBeNull();
    } finally {
      if (saved !== undefined) process.env.VERCEL_GIT_COMMIT_SHA = saved;
    }
  });
});

describe('front door status and counts truth (audit W4-F6, W4-F7)', () => {
  const savedUrl = process.env.DATABASE_URL;
  const savedOrigin = process.env.PUBLIC_BASE_URL;
  function restoreEnv() {
    if (savedUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedUrl;
    if (savedOrigin === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = savedOrigin;
  }
  function configure() {
    process.env.DATABASE_URL = 'postgres://front-door-test.invalid/db';
    process.env.PUBLIC_BASE_URL = 'https://stripe-mcp.example.test';
  }
  it('says online only when the health dependency check passes', async () => {
    configure();
    try {
      const okRes = response();
      await createFrontDoorHandler({ check: async () => true })(
        { method: 'GET', headers: {} }, okRes);
      expect(okRes.body.status).toBe('online');
      // A failing store must not read 'online' (the old config-boolean
      // derivation said online whenever the env vars merely existed).
      const downRes = response();
      await createFrontDoorHandler({ check: async () => false })(
        { method: 'GET', headers: {} }, downRes);
      expect(downRes.body.status).toBe('degraded');
    } finally { restoreEnv(); }
  });
  it('says setup-required when unconfigured and runs no dependency check', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.PUBLIC_BASE_URL;
    try {
      let called = false;
      const res = response();
      await createFrontDoorHandler({ check: async () => { called = true; return true; } })(
        { method: 'GET', headers: {} }, res);
      expect(res.body.status).toBe('setup-required');
      expect(called).toBe(false);
    } finally { restoreEnv(); }
  });
  it('labels every published profile count with its scope', async () => {
    configure();
    try {
      const res = response();
      await createFrontDoorHandler({ check: async () => true })(
        { method: 'GET', headers: {} }, res);
      expect(res.body.tools).toBe(registry.tools.length);
      // Reads-only counts (the profileCounts default) sit under their own
      // scope label, never bare beside the registry total.
      expect(res.body.profileToolCounts).toEqual(profileCounts(registry));
      expect(res.body.profileToolCountsScope).toContain('Read tools only');
      // Declared visibility (reads + writes) is published and labelled too.
      expect(res.body.profileVisibilityCounts)
        .toEqual(profileCounts(registry, { allowWrites: true }));
      expect(res.body.profileVisibilityCounts.full).toBe(registry.tools.length);
      expect(res.body.profileVisibilityCountsScope).toContain('reads and writes');
    } finally { restoreEnv(); }
  });
});

describe('fleet health contract', () => {
  it('answers 503 degraded when the store is unconfigured, with no config values', async () => {
    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const res = response();
      await healthHandler({ method: 'GET', headers: {} }, res);
      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('degraded');
      expect(body.checks).toEqual({ database: false });
      expect(body.tools).toBe(registry.tools.length);
      expect(JSON.stringify(body)).not.toContain('postgres');
    } finally {
      if (savedUrl !== undefined) process.env.DATABASE_URL = savedUrl;
    }
  });
  it('the dependency check genuinely fails and succeeds', async () => {
    await expect(checkDatabase({}, { query: async () => {} })).resolves.toBe(true);
    await expect(checkDatabase({}, { query: async () => {
      throw new Error('store down'); } })).resolves.toBe(false);
    await expect(checkDatabase({})).resolves.toBe(false);
  });
  it('rejects non-GET methods', async () => {
    const res = response();
    await healthHandler({ method: 'POST', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});

describe('identity anchoring — the configured origin is the identity', () => {
  it('discovery fetched via a platform alias still names the branded issuer', () => {
    const handlers = createOAuthHandlers({ db: {}, env: {
      PUBLIC_BASE_URL: 'https://stripe.robinsonaisystems.com' } });
    const aliasReq = { method: 'GET',
      headers: { host: 'stripe-mcp-xyz.vercel.app' } };
    const meta = response();
    handlers.metadata(aliasReq, meta);
    const metadata = JSON.parse(meta.body);
    expect(metadata.issuer).toBe('https://stripe.robinsonaisystems.com');
    expect(metadata.authorization_endpoint)
      .toBe('https://stripe.robinsonaisystems.com/api/oauth/authorize');
    expect(metadata.token_endpoint)
      .toBe('https://stripe.robinsonaisystems.com/api/oauth/token');
    expect(metadata.registration_endpoint)
      .toBe('https://stripe.robinsonaisystems.com/api/oauth/register');
    expect(JSON.stringify(metadata)).not.toContain('vercel.app');
    const resource = response();
    handlers.resourceMetadata(aliasReq, resource);
    expect(JSON.parse(resource.body)).toEqual({
      resource: 'https://stripe.robinsonaisystems.com/api/mcp',
      authorization_servers: ['https://stripe.robinsonaisystems.com'] });
  });
});
