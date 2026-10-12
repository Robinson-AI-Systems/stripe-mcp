import { describe, expect, it } from 'vitest';
import { allowBrowserProtocol } from '../../src/core/browser-cors.js';
import { handleOAuth } from '../../src/oauth/routes.js';
import { createMcpHandler } from '../../src/core/mcp-server.js';

const origin = 'https://independent-browser-client.example.test';
function response() {
  return { statusCode: 200, headers: {}, body: null, ended: false,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    send(value) { this.body = value; return this; },
    json(value) { this.body = value; return this; },
    end() { this.ended = true; return this; }
  };
}
describe('browser protocol cross-origin boundaries', () => {
  it('handles OAuth token/registration and discovery preflight without DB or credentials', async () => {
    for (const which of ['token', 'register', 'metadata', 'resourceMetadata']) {
      const res = response();
      await handleOAuth(which, { method: 'OPTIONS', headers: { origin } }, res);
      expect(res.statusCode).toBe(204);
      expect(res.ended).toBe(true);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
      expect(res.headers['Access-Control-Allow-Headers']).toContain('authorization');
      expect(res.headers['Cache-Control']).toBe('no-store');
      const expected = ['token','register'].includes(which) ? 'POST' : 'GET';
      expect(res.headers['Access-Control-Allow-Methods']).toContain(expected);
    }
  });
  it('does not allow browser credentials or mistakenly answer an owner authorization preflight', () => {
    const res = response();
    const answered = allowBrowserProtocol({ method: 'OPTIONS', headers: {} }, res);
    expect(answered).toBe(false);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
  it('exposes an MCP challenge to a browser but does not authorize without bearer', async () => {
    const handler = createMcpHandler({
      db: { getAccessToken: async () => { throw new Error('should not access DB'); } },
      registry: { tools: [], handlers: {} },
      env: { PUBLIC_BASE_URL: 'https://stripe-mcp.example.test' }
    });
    const res = response();
    await handler({ method: 'POST', headers: { origin } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('resource_metadata=');
    expect(res.headers['Access-Control-Expose-Headers']).toContain('www-authenticate');
    expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });
  it('preserves MCP headers on preflight without trying to authenticate', async () => {
    const res = response();
    expect(allowBrowserProtocol({ method: 'OPTIONS', headers: { origin } }, res,
      { methods: ['GET','POST','DELETE'], mcp: true })).toBe(true);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Headers']).toContain('mcp-protocol-version');
    expect(res.headers['Access-Control-Allow-Headers']).toContain('mcp-session-id');
    expect(res.headers['Access-Control-Allow-Methods']).toContain('DELETE');
  });
});
