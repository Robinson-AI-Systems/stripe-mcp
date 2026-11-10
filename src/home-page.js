// The browser home page for "/" (owner request 2026-11-10): what Stripe
// Unleashed does, who can connect today, how connecting works, and steps for
// every major app, checked against each app's current docs (Claude
// support.claude.com custom connectors; ChatGPT Plugins > + > Add custom MCP
// server; Claude Code code.claude.com/docs/en/mcp; Codex
// developers.openai.com/codex/mcp; Cursor cursor.com/docs/mcp; VS Code
// code.visualstudio.com/docs/copilot/reference/mcp-configuration; Gemini CLI
// gemini mcp add --transport http + /mcp auth; Windsurf mcp_config.json
// serverUrl). No scripts; programs keep the JSON status.
// Honest about who can connect: today the sign-in page asks for the service
// owner's administrator passphrase and accepts a Stripe test account only.
export const HOME_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const PRODUCT = 'Stripe Unleashed by Robinson AI Systems';
const DISCLAIMER = 'Stripe Unleashed is a Robinson AI Systems product. It is not affiliated with, endorsed by, or sponsored by Stripe, Inc.';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The public address comes only from PUBLIC_BASE_URL (never the request's Host).
export function publicAddress(env = process.env) {
  try {
    const u = new URL(env.PUBLIC_BASE_URL);
    if (u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash) return u.origin + '/api/mcp';
  } catch { /* fall through */ }
  return 'https://stripe.robinsonaisystems.com/api/mcp';
}

const STYLE = ':root{--bg:#0C0C0C;--surface:#1E1E1E;--text:#F8FAF8;--muted:#9FA5A3;--border:#333;--accent:#00B67A}' +
  '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
  'main{max-width:640px;margin:0 auto;padding:28px 18px 48px}h1{font-size:26px;line-height:1.2;margin:0 0 12px}h2{font-size:19px;margin:26px 0 8px}h3{font-size:16px;margin:18px 0 6px}' +
  'a{color:var(--accent)}small,.muted{color:var(--muted)}section{border-top:1px solid var(--border);padding-top:14px;margin-top:18px}' +
  '.brand b{display:block;font-size:18px}.brand small{color:var(--muted)}' +
  '.addr{display:block;background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:14px;margin:10px 0 16px;font:600 15px/1.4 ui-monospace,Menlo,Consolas,monospace;word-break:break-all;user-select:all}' +
  'pre{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-all;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace}' +
  '.note{border-left:3px solid var(--accent);padding-left:14px}ol{padding-left:22px}li{margin:4px 0}';

export function renderHome({ env = process.env, status = 'unknown', tools = 0, version = '' } = {}) {
  const A = esc(publicAddress(env));
  const N = 'stripe-unleashed';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + PRODUCT + '</title><style>' + STYLE + '</style></head><body><main>' +
    '<div class="brand"><b>' + PRODUCT + '</b><small>Practical software. More capable AI.</small></div>' +
    '<h1>Let your AI assistant work with your Stripe account, safely</h1>' +
    '<p>Stripe Unleashed connects Claude, ChatGPT, Muse and other AI apps to Stripe: customers, products, prices, invoices, ' +
    'payments, subscriptions and more. Changes are previewed first, and you choose how much each app may do.</p>' +
    '<p><small>' + DISCLAIMER + '</small></p>' +
    '<section id="start"><h2>How connecting works</h2>' +
    '<p class="note"><b>Who can connect right now:</b> only the owner of this service, and only with a Stripe <b>test</b> account. ' +
    'Its sign-in page asks for the administrator passphrase. Public sign-up and live Stripe accounts are not open yet.</p>' +
    '<ol><li><a href="#connect">Add the address below</a> to your AI app.</li>' +
    '<li>Your app opens this service’s own sign-in page. Choose the Stripe test account and how much the app may do, ' +
    'enter the administrator passphrase, and approve.</li>' +
    '<li>Then ask your assistant for what you need. Never paste Stripe keys or passwords into a chat.</li></ol></section>' +
    '<section id="connect"><h2>Connect your AI app</h2><p>Your connector address:</p><code class="addr">' + A + '</code>' +
    '<p><small>Leave any Client ID and Client Secret boxes blank (Muse is the one exception, below).</small></p>' +
    '<h3>Claude (web, desktop and phone)</h3><ol><li>Open <b>Settings</b> (called <b>Customize</b> in some versions), then <b>Connectors</b>. ' +
    'On a phone, open <a href="https://claude.ai/settings/connectors">claude.ai/settings/connectors</a> in your browser.</li>' +
    '<li>Choose <b>+</b> or <b>Add</b>, then <b>Add custom connector</b>. Give it a name and paste the address.</li>' +
    '<li>Choose <b>Add</b>, then <b>Connect</b>, and finish on the sign-in page.</li></ol>' +
    '<h3>ChatGPT</h3><ol><li>On chatgpt.com, open <b>Plugins</b>, choose the <b>+</b> button, then <b>Add custom MCP server</b>.</li>' +
    '<li>Paste the address, choose <b>OAuth</b>, then <b>Create</b> and install it, and finish on the sign-in page.</li></ol>' +
    '<p><small>Needs a paid ChatGPT plan. If you do not see that option, turn on Developer mode under Settings, Apps &amp; Connectors, Advanced.</small></p>' +
    // D-006 MC-8: the one Muse sentence every fleet server uses.
    '<h3>Muse</h3><p>Open <b>Settings</b>, then <b>Connectors</b>, then <b>Add custom connector</b>, and paste the address. ' +
    'If Muse asks for a Client ID, type <code>muse</code> (the same for everyone, and nothing secret). <b>Client Secret: leave blank.</b></p>' +
    '<h3>Claude Code</h3><pre>claude mcp add --transport http ' + N + ' ' + A + '</pre><p><small>Then type <code>/mcp</code> inside Claude Code and sign in.</small></p>' +
    '<h3>OpenAI Codex (and the ChatGPT desktop app)</h3><pre>codex mcp add ' + N + ' --url ' + A + '\ncodex mcp login ' + N + '</pre>' +
    '<p><small>In the desktop app instead: Settings, MCP servers, Add server, choose Streamable HTTP, paste the address, save, then Authenticate.</small></p>' +
    '<h3>Cursor</h3><p>Cursor Settings, MCP, New MCP Server, then add:</p><pre>{"mcpServers":{"' + N + '":{"url":"' + A + '"}}}</pre>' +
    '<p><small>Save, then choose Connect next to it and sign in.</small></p>' +
    '<h3>VS Code (GitHub Copilot)</h3><p>Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on a Mac), run <b>MCP: Add Server</b>, ' +
    'choose <b>HTTP</b>, paste the address and name it <code>' + N + '</code>. Sign in when VS Code asks.</p>' +
    '<h3>Gemini CLI</h3><pre>gemini mcp add --transport http --scope user ' + N + ' ' + A + '</pre>' +
    '<p><small>Then start <code>gemini</code> and type <code>/mcp auth ' + N + '</code>.</small></p>' +
    '<h3>Windsurf</h3><p>Windsurf Settings, Cascade, MCP servers, View raw config, then add:</p><pre>{"mcpServers":{"' + N + '":{"serverUrl":"' + A + '"}}}</pre>' +
    '<h3>Any other app</h3><p>Any app that can add a remote MCP server with sign-in (OAuth) works: paste the address and finish on the sign-in page.</p></section>' +
    '<section><h2>Service facts</h2><p>Status: ' + esc(status) + ' · ' + esc(tools) + ' registered tools · Version ' + esc(version) + '</p>' +
    '<p><a href="/health">Health</a> · <a href="/.well-known/oauth-authorization-server">OAuth discovery</a> · ' +
    '<a href="/api/openapi.json">API description</a></p></section>' +
    '<footer><p><small>' + DISCLAIMER + '</small></p></footer></main></body></html>';
}
