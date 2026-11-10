// Owner request 2026-11-10: a browser home page at / with How connecting
// works (honest that only the owner, on a Stripe test account, can sign in
// today) and steps for every major app; programs keep the JSON status.
import { describe, it, expect } from 'vitest';
import { renderHome, publicAddress, HOME_CSP } from '../../src/home-page.js';
import { createFrontDoorHandler } from '../../api/index.js';

const res = () => { const r = { statusCode: 200, headers: {}, body: null };
  r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = (n) => { r.statusCode = n; return r; };
  r.send = (b) => { r.body = b; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('the Stripe Unleashed home page', () => {
  it('leads with How connecting works, is honest about who can connect, and covers every major app', () => {
    const html = renderHome({ env: { PUBLIC_BASE_URL: 'https://stripe.example.test' }, status: 'online', tools: 3, version: 'v' });
    expect(html).toContain('https://stripe.example.test/api/mcp');
    expect(html).toContain('only the owner of this service');
    for (const app of ['How connecting works', 'Claude (web, desktop and phone)', 'ChatGPT', 'Muse', 'Claude Code', 'OpenAI Codex (and the ChatGPT desktop app)', 'Cursor', 'VS Code (GitHub Copilot)', 'Gemini CLI', 'Windsurf', 'Any other app'])
      expect(html).toContain('>' + app + '</h');
    expect(html.indexOf('How connecting works')).toBeLessThan(html.indexOf('id="connect"'));
    expect(html).not.toMatch(/<script/i);
    expect(HOME_CSP).toContain("default-src 'none'");
  });
  it('takes the address only from PUBLIC_BASE_URL, never a lookalike', () => {
    expect(publicAddress({ PUBLIC_BASE_URL: 'http://evil.example' })).toBe('https://stripe.robinsonaisystems.com/api/mcp');
    expect(publicAddress({})).toBe('https://stripe.robinsonaisystems.com/api/mcp');
  });
  it('browsers get the page, programs keep the JSON', async () => {
    const handler = createFrontDoorHandler({ check: async () => ({ ok: true }) });
    const page = res(); await handler({ headers: { accept: 'text/html' } }, page);
    expect(page.headers['Content-Type']).toMatch(/text\/html/);
    expect(String(page.body)).toContain('How connecting works');
    const json = res(); await handler({ headers: {} }, json);
    expect(json.body.name).toBe('Stripe Unleashed by Robinson AI Systems');
  });
});
