// Owner-only setup UI. The browser sends Stripe keys directly over HTTPS; no AI tool accepts them.
import { randomBytes } from 'node:crypto';
import { clientIp, evaluateLogin, secretsMatch, LOCKOUT_WINDOW_MINUTES } from '../core/oauth.js';
import { publicOrigin, paramsOf, send, escapeHtml, only } from '../core/http.js';

function csrfCookie(req) {
  const cookie = String(req.headers?.cookie || '');
  return /(?:^|;\s*)stripe_setup_csrf=([A-Za-z0-9_-]{43})/.exec(cookie)?.[1] || null;
}
function htmlPage({ csrf, show = '', result = '', revealed = '', liveIntent = null, revokeIntent = null, disableIntent = null }) {
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
    (liveIntent ? '<h2>Approve LIVE account activation</h2>' +
      '<p>Selected account: <strong>' + escapeHtml(liveIntent.label || liveIntent.stripe_account) +
      '</strong> (' + escapeHtml(liveIntent.stripe_account) + '). This will allow REAL Stripe changes if enabled later. Do not proceed unless you intend that.</p>' +
      '<form method="post" autocomplete="off">' + formHidden +
      '<input type="hidden" name="action" value="enable-live">' +
      '<input type="hidden" name="id" value="' + escapeHtml(liveIntent.id) + '">' +
      '<label>Re-enter administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
      '<label><input type="checkbox" name="ownerLiveConsent" value="yes" required> I personally authorize LIVE mode for this exact Stripe account.</label>' +
      '<button type="submit">Approve this LIVE account (final step)</button></form>' : '') +
    '<h2>Disconnect an AI connection (owner only)</h2>' +
    '<p>Use a Stripe account ID and the AI client ID from the account connection list. This signs out that connection; it never touches customer payments.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="request-revoke">' +
    '<label>Stripe account ID<input name="account" required maxlength="80" autocomplete="off"></label>' +
    '<label>AI client ID<input name="clientId" required maxlength="160" autocomplete="off"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Preview connection removal</button></form>' +
    (revokeIntent ? '<h2>Confirm removal of this connection</h2>' +
      '<p>Account: <strong>' + escapeHtml(revokeIntent.label || revokeIntent.stripe_account) +
      '</strong> (' + escapeHtml(revokeIntent.stripe_account) + '), client ID: <strong>' +
      escapeHtml(revokeIntent.client_id) + '</strong>. Its current access and refresh tokens will be revoked. This cannot be undone for that connection.</p>' +
      '<form method="post" autocomplete="off">' + formHidden +
      '<input type="hidden" name="action" value="confirm-revoke">' +
      '<input type="hidden" name="id" value="' + escapeHtml(revokeIntent.id) + '">' +
      '<label><input type="checkbox" name="ownerRevokeConsent" value="yes" required> I personally authorize revoking exactly this connection.</label>' +
      '<label>Re-enter administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
      '<button type="submit">Revoke this connection</button></form>' : '') +
    '<h2>Emergency: disable LIVE access (owner only)</h2>' +
    '<p>This only switches LIVE mode OFF for a selected Stripe account. It cannot enable LIVE, create payments or change bank details.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="request-disable-live">' +
    '<label>Stripe account ID<input name="account" maxlength="80" required autocomplete="off"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Preview emergency LIVE disable</button></form>' +
    (disableIntent ? '<h2>Final owner confirmation: disable LIVE</h2>' +
      '<p>Account: <strong>' + escapeHtml(disableIntent.label || disableIntent.stripe_account) +
      '</strong> (' + escapeHtml(disableIntent.stripe_account) +
      '). This blocks LIVE connections until a separately authorized activation.</p>' +
      '<form method="post" autocomplete="off">' + formHidden +
      '<input type="hidden" name="action" value="confirm-disable-live">' +
      '<input type="hidden" name="id" value="' + escapeHtml(disableIntent.id) + '">' +
      '<label><input type="checkbox" name="ownerDisableConsent" value="yes" required> I personally authorize disabling LIVE access for this exact account.</label>' +
      '<label>Re-enter administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
      '<button type="submit">Disable LIVE access</button></form>' : '') +
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
      const liveId = String(req.query?.liveEnable || '');
      const liveIntent = liveId && typeof db.getLiveEnableIntent === 'function'
        ? await db.getLiveEnableIntent(liveId) : null;
      return send(res, 200, htmlPage({ csrf, show: req.query?.show || '', liveIntent }),
        'text/html; charset=utf-8');
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
    if (p.action === 'request-revoke') {
      // Phase one is only a short-lived intent, not a connection mutation.
      const id=randomBytes(24).toString('base64url');
      let accepted=false;
      try {
        accepted=await db.requestConnectionRevokeIntent({
          id,account:p.account,clientId:p.clientId,
          expiresAt:new Date(Date.now()+10*60*1000)
        });
      } catch { accepted=false; }
      if (!accepted) return send(res, 404, htmlPage({csrf:cookie,result:
        'No active connection matches this exact account and client ID.'}),
        'text/html; charset=utf-8');
      const revokeIntent=await db.getConnectionRevokeIntent(id);
      return send(res, 200, htmlPage({csrf:cookie,revokeIntent,result:
        'Review the exact account and client, then independently confirm the removal.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'confirm-revoke') {
      if (p.ownerRevokeConsent !== 'yes') return send(res, 400, htmlPage({csrf:cookie,result:
        'A separate explicit owner confirmation is required.'}),
        'text/html; charset=utf-8');
      const intent=await db.getConnectionRevokeIntent(p.id);
      if (!intent) return send(res, 410, htmlPage({csrf:cookie,result:
        'This connection removal request was used or expired. Start again.'}),
        'text/html; charset=utf-8');
      const revoked=await db.consumeConnectionRevokeIntent(p.id);
      return send(res, revoked ? 200 : 409, htmlPage({csrf:cookie,result:revoked ?
        'Connection removed for account '+intent.stripe_account+', client '+intent.client_id+'.' :
        'The connection was already removed or changed. No removal performed.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'request-disable-live') {
      const id=randomBytes(24).toString('base64url');
      let accepted=false;
      try { accepted=await db.requestDisableLiveIntent({
        id,account:p.account,expiresAt:new Date(Date.now()+10*60*1000)
      }); } catch { accepted=false; }
      if (!accepted) return send(res,404,htmlPage({csrf:cookie,result:
        'This account is not currently enabled for LIVE connections.'}),
        'text/html; charset=utf-8');
      const disableIntent=await db.getDisableLiveIntent(id);
      return send(res,200,htmlPage({csrf:cookie,disableIntent,result:
        'Preview only. LIVE access is unchanged until you personally confirm.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'confirm-disable-live') {
      if (p.ownerDisableConsent!=='yes') return send(res,400,htmlPage({csrf:cookie,result:
        'An independent explicit owner confirmation is required.'}),
        'text/html; charset=utf-8');
      const intent=await db.getDisableLiveIntent(p.id);
      if (!intent) return send(res,410,htmlPage({csrf:cookie,result:
        'LIVE-disable intent expired, was consumed, or the account is already disabled.'}),
        'text/html; charset=utf-8');
      const disabled=await db.consumeDisableLiveIntent(p.id);
      return send(res,disabled?200:409,htmlPage({csrf:cookie,result:disabled
        ? 'LIVE connection access disabled for '+intent.stripe_account+'.'
        : 'No LIVE mode change made. This request is stale or was already used.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'enable-live') {
      // This server-owned gate defaults OFF. Owner consent in a form is
      // necessary, but never enough to silently authorize IN-06 activation.
      if (env.LIVE_MODE_OWNER_APPROVED !== 'true') {
        return send(res, 403, htmlPage({ csrf:cookie, result:
          'LIVE mode remains disabled until the owner separately authorizes IN-06.' }),
          'text/html; charset=utf-8');
      }
      if (p.ownerLiveConsent !== 'yes') {
        return send(res, 400, htmlPage({ csrf:cookie, result:
          'Explicit account-specific LIVE consent is required.' }), 'text/html; charset=utf-8');
      }
      const requested = await db.getLiveEnableIntent(p.id);
      if (!requested) return send(res, 410, htmlPage({ csrf:cookie, result:
        'This LIVE activation request expired, was used or was revoked.' }), 'text/html; charset=utf-8');
      const enabled = await db.consumeLiveEnableIntent({id:p.id,allowActivation:true});
      return send(res, enabled ? 200 : 409, htmlPage({ csrf:cookie, result:enabled ?
        'LIVE mode enabled for ' + requested.label + ' (' + requested.stripe_account + ').' :
        'LIVE mode was not enabled: the account lacks a verified LIVE key or the request is invalid.' }),
        'text/html; charset=utf-8');
    }
    return send(res, 400, htmlPage({ csrf:cookie, result:'Unsupported setup action.' }),
      'text/html; charset=utf-8');
  };
}
