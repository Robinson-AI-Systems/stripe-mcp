// Owner-only setup UI. The browser sends Stripe keys directly over HTTPS; no AI tool accepts them.
import { randomBytes } from 'node:crypto';
import { clientIp, evaluateLogin, secretsMatch, LOCKOUT_WINDOW_MINUTES } from '../core/oauth.js';
import { publicOrigin, paramsOf, send, escapeHtml, only } from '../core/http.js';

function csrfCookie(req) {
  const cookie = String(req.headers?.cookie || '');
  return /(?:^|;\s*)stripe_setup_csrf=([A-Za-z0-9_-]{43})/.exec(cookie)?.[1] || null;
}
function htmlPage({ csrf, show = '', result = '', revealed = '' }) {
  const formHidden = '<input type="hidden" name="csrf" value="' + escapeHtml(csrf) + '">';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Stripe MCP owner setup</title>' +
    '<style>body{font:16px system-ui,sans-serif;max-width:500px;margin:4vh auto;padding:16px}form{display:grid;gap:12px;margin:20px 0;padding:14px;border:1px solid #ccc;border-radius:10px}input,button{font:inherit;padding:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{cursor:pointer}p{line-height:1.5}</style></head><body>' +
    '<h1>Robinson Stripe MCP — private setup</h1>' +
    '<p>This page stores your test Stripe key in encrypted storage. Keys are never entered in AI chat. Live keys are not accepted.</p>' +
    (result ? '<p role="status">' + escapeHtml(result) + '</p>' : '') +
    (revealed ? '<h2>One-time secret — copy it now</h2><pre>' + escapeHtml(revealed) +
      '</pre><p>It has been deleted from the server and will not appear again.</p>' : '') +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="add-key">' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<label>Stripe TEST restricted or secret key<input type="password" name="key" required autocomplete="off"></label>' +
    '<label>Account label (optional)<input name="label" maxlength="100"></label>' +
    '<button type="submit">Verify account and save encrypted test key</button></form>' +
    (show ? '<form method="post">' + formHidden +
      '<input type="hidden" name="action" value="reveal">' +
      '<input type="hidden" name="id" value="' + escapeHtml(show) + '">' +
      '<label>Administrator passphrase<input type="password" name="passphrase" required></label>' +
      '<button type="submit">Reveal this one-time secret</button></form>' : '') +
    '</body></html>';
}
export function createSetupHandler({ db, keyStore, oneTimeStore, env = process.env }) {
  return async function setup(req, res) {
    if (!only(res, req, ['GET','POST'])) return;
    let origin;
    try { origin = publicOrigin(env); }
    catch { return send(res, 503, { error: 'server_not_configured', description: 'Set PUBLIC_BASE_URL first' }); }
    res.setHeader('Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    if (req.method === 'GET') {
      const csrf = randomBytes(32).toString('base64url');
      res.setHeader('Set-Cookie', 'stripe_setup_csrf=' + csrf +
        '; Max-Age=600; Path=/api/stripe/setup; HttpOnly; Secure; SameSite=Strict');
      return send(res, 200, htmlPage({ csrf, show: req.query?.show || '' }), 'text/html; charset=utf-8');
    }
    // Require an exact same-origin browser form and its double-submit CSRF token.
    if (String(req.headers?.origin || '') !== origin) {
      return send(res, 403, { error: 'forbidden', description: 'Origin check failed' });
    }
    let p;
    try { p = paramsOf(req); }
    catch { return send(res, 400, { error: 'invalid_request' }); }
    const cookie = csrfCookie(req);
    if (!cookie || !p.csrf || !secretsMatch(p.csrf, cookie)) {
      return send(res, 403, { error: 'forbidden', description: 'Setup page expired; reload it' });
    }
    if (!env.ADMIN_PASSPHRASE) {
      return send(res, 503, { error: 'server_not_configured', description: 'Set ADMIN_PASSPHRASE first' });
    }
    const login = await evaluateLogin({ ip: clientIp(req), supplied: p.passphrase,
      expected: env.ADMIN_PASSPHRASE, store: db });
    if (login.status === 'locked') {
      res.setHeader('Retry-After', String(LOCKOUT_WINDOW_MINUTES * 60));
      return send(res, 429, htmlPage({ csrf:cookie, result:'Too many attempts. Try again later.' }),
        'text/html; charset=utf-8');
    }
    if (login.status !== 'ok') {
      return send(res, 401, htmlPage({ csrf:cookie, result:'Incorrect administrator passphrase.' }),
        'text/html; charset=utf-8');
    }
    if (p.action === 'add-key') {
      try {
        const saved = await keyStore.storeTestKey({ key:p.key, label:p.label });
        return send(res, 200, htmlPage({ csrf:cookie, result:
          'Saved encrypted TEST ' + saved.kind + ' key for ' + saved.label + ' (' + saved.account +
          '). Key ends in ' + saved.last4 + '.' }), 'text/html; charset=utf-8');
      } catch {
        return send(res, 400, htmlPage({ csrf:cookie,
          result:'Unable to verify and save this TEST key. Check its read permissions and try again.' }),
          'text/html; charset=utf-8');
      }
    }
    if (p.action === 'reveal') {
      try {
        const revealed = await oneTimeStore.consume(p.id);
        if (!revealed) return send(res, 410, htmlPage({ csrf:cookie,
          result:'This one-time secret was used, expired, or does not exist.' }), 'text/html; charset=utf-8');
        return send(res, 200, htmlPage({ csrf:cookie, revealed }), 'text/html; charset=utf-8');
      } catch {
        return send(res, 400, htmlPage({ csrf:cookie,
          result:'Unable to retrieve this secret.' }), 'text/html; charset=utf-8');
      }
    }
    return send(res, 400, htmlPage({ csrf:cookie, result:'Unsupported setup action.' }),
      'text/html; charset=utf-8');
  };
}
