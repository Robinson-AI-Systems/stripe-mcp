// Owner-only setup UI. The browser sends Stripe keys directly over HTTPS; no AI tool accepts them.
import { randomBytes } from 'node:crypto';
import {buildSetupReadinessReport} from '../acceptance/setup-readiness-report.js';
import { clientIp, evaluateLogin, secretsMatch, LOCKOUT_WINDOW_MINUTES } from '../core/oauth.js';
import { publicOrigin, paramsOf, send, escapeHtml, only } from '../core/http.js';

function parseUsdCents(text) {
  if (typeof text!=='string' || !/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/.test(text))
    return null;
  const [whole,decimal='']=text.split('.');
  const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
  return Number.isSafeInteger(cents) && cents>=0 && cents<=2147483647 ? cents : null;
}
const usd=cents=>new Intl.NumberFormat('en-US',
  {style:'currency',currency:'USD'}).format(cents/100);
function csrfCookie(req) {
  const cookie = String(req.headers?.cookie || '');
  return /(?:^|;\s*)stripe_setup_csrf=([A-Za-z0-9_-]{43})/.exec(cookie)?.[1] || null;
}
function htmlPage({ csrf, show = '', result = '', revealed = '', liveIntent = null, revokeIntent = null, disableIntent = null, defaultIntent = null, moneyLimitIntent = null, moneyInbox = null, moneyDecisionIntent = null, smokeResult = null }) {
  const formHidden = '<input type="hidden" name="csrf" value="' + escapeHtml(csrf) + '">';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Stripe MCP owner setup</title>' +
    '<style>body{font:16px system-ui,sans-serif;max-width:500px;margin:4vh auto;padding:16px}form{display:grid;gap:12px;margin:20px 0;padding:14px;border:1px solid #ccc;border-radius:10px}input,button{font:inherit;padding:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{cursor:pointer}p{line-height:1.5}</style></head><body>' +
    '<h1>Robinson Stripe MCP — private setup</h1>' +
    '<h2>Provision TEST webhook signature verification</h2>' +
    '<p>Enter the webhook signing secret directly on this password-protected page, never in AI chat. Only an existing TEST endpoint on the specified connected account can be saved. Re-provision after rotating the secret.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="provision-webhook-secret">' +
    '<label>Stripe TEST account ID<input name="account" pattern="acct_[A-Za-z0-9]+" required maxlength="110"></label>' +
    '<label>Native webhook endpoint ID<input name="endpoint" pattern="we_[A-Za-z0-9]+" required maxlength="110"></label>' +
    '<label>Webhook signing secret<input type="password" name="secret" required autocomplete="off" maxlength="265"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Verify TEST endpoint and store encrypted signing secret</button></form>' +
    '<p>Forget a no-longer-used TEST webhook signing secret without changing anything in Stripe. Re-provision after rotating a secret.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="forget-webhook-secret">' +
    '<label>Stripe TEST account ID<input name="account" pattern="acct_[A-Za-z0-9]+" required maxlength="110"></label>' +
    '<label>Native webhook endpoint ID<input name="endpoint" pattern="we_[A-Za-z0-9]+" required maxlength="110"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Forget this encrypted TEST signing secret</button></form>' +
    '<h2>Download a verified TEST report CSV</h2>' +
    '<p>For the owner only. The CSV is delivered directly to this browser after password verification; file contents and authentication links never enter AI chat. Limit: 5 MB.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="download-report">' +
    '<label>Stripe account ID<input name="account" pattern="acct_[A-Za-z0-9]+" required maxlength="110"></label>' +
    '<label>Completed TEST report run ID<input name="run" pattern="frr_[A-Za-z0-9]+" required maxlength="110"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Download private CSV</button></form>' +
    '<h2>Check signed TEST webhook receipt (owner only)</h2>' +
    '<p>Lookup metadata for one TEST event already validated by the signed receiver. This does not independently prove that Stripe delivered the event from an external network.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="lookup-test-receipt">' +
    '<label>Enrolled TEST account ID<input name="account" pattern="acct_[A-Za-z0-9]+" maxlength="110" required></label>' +
    '<label>TEST webhook endpoint ID<input name="endpoint" pattern="we_[A-Za-z0-9]+" maxlength="110" required></label>' +
    '<label>TEST event ID<input name="eventId" pattern="evt_[A-Za-z0-9]+" maxlength="110" required></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Check signed TEST receipt</button></form>' +
    '<h2>Issue temporary read-only Toolkit pass (TEST only)</h2>' +
    '<p>Owner-only. Creates a 1-hour or 24-hour TEST-only pass with no writes or money authorization. The bearer is shown only through the protected one-time reveal page and can be revoked using the connection ID.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="issue-rtc-pass">' +
    '<label>Allowed read-only areas (comma-separated, default server only)' +
    '<input name="areas" maxlength="120" value="server" required></label>' +
    '<label>Pass lifetime<select name="hours" required><option value="1">1 hour for temporary D-4 testing</option><option value="24" selected>24 hours</option></select></label>' +
    '<label>Connected TEST account ID<input name="account" pattern="acct_[A-Za-z0-9]+" required maxlength="110"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Issue TEST read-only pass</button></form>' +
    '<p>This page stores your test Stripe key in encrypted storage. Keys are never entered in AI chat. Live keys are not accepted.</p>' +
    '<h2>Automated TEST Setup &amp; Readiness Report (owner only)</h2>' +
    '<p>Select one group for genuine custom MCP TEST reads and a targeted readiness report. Unknown/unreadable settings are NOT presumed to be defaults. No automatic change is made; Stripe Dashboard, OAuth and signed webhook delivery are separate acceptance gates.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="run-test-smoke">' +
    '<label>Selected TEST account ID<input name="account" pattern="acct_[A-Za-z0-9]+" maxlength="110" required autocomplete="off"></label>' +
    '<label>Test group<select name="focus" required><option value="account">G-5 TEST account &amp; payment configuration (4)</option><option value="webhooks">G-4 TEST event &amp; webhook reads (2)</option><option value="readiness">G-6 owner readiness checks (2)</option><option value="core">Core G-4/G-5/G-6 reads (8)</option><option value="administration">G-6 owner administration (3)</option></select></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Run read-only custom MCP TEST checks</button></form>' +
    (smokeResult ? '<h3>Custom MCP TEST result (not Dashboard acceptance)</h3><pre>' +
      escapeHtml(JSON.stringify(smokeResult,null,2)) + '</pre>' : '') +
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
    '<h2>Choose default account for new AI connections (owner only)</h2>' +
    '<p>Existing AI connections remain on their original accounts. Only the initial selection shown to new connections changes.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="request-default-account">' +
    '<label>Stripe account ID<input name="account" maxlength="80" required autocomplete="off"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Preview new default account</button></form>' +
    (defaultIntent ? '<h2>Final owner confirmation: default account</h2>' +
      '<p>New default: <strong>' + escapeHtml(defaultIntent.label || defaultIntent.stripe_account) +
      '</strong> (' + escapeHtml(defaultIntent.stripe_account) +
      '). Prior default: ' + escapeHtml(defaultIntent.expected_default || '(none)') +
      '. Existing connections will not be moved. An intervening change cancels this request.</p>' +
      '<form method="post" autocomplete="off">' + formHidden +
      '<input type="hidden" name="action" value="confirm-default-account">' +
      '<input type="hidden" name="id" value="' + escapeHtml(defaultIntent.id) + '">' +
      '<label><input type="checkbox" name="ownerDefaultConsent" value="yes" required> I personally approve this exact default-account selection.</label>' +
      '<label>Re-enter administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
      '<button type="submit">Set default account</button></form>' : '') +
    '<h2>Change the daily AI money-out limit (owner only)</h2>' +
    '<p>The standard remains $500 per Stripe account per Colorado day, shared by every AI connection. Changing an account limit never removes your separate approval requirement for each outgoing transaction.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="request-money-limit">' +
    '<label>Stripe account ID<input name="account" required maxlength="80" autocomplete="off"></label>' +
    '<label>New daily limit in USD (example 500.00)<input name="newLimitUsd" inputmode="decimal" required autocomplete="off"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Preview daily money-out limit</button></form>' +
    (moneyLimitIntent ? '<h2>Final owner confirmation: daily account limit</h2>' +
      '<p>Account: <strong>' + escapeHtml(moneyLimitIntent.label || moneyLimitIntent.stripe_account) +
      '</strong> (' + escapeHtml(moneyLimitIntent.stripe_account) +
      '). Current limit: <strong>' + escapeHtml(usd(moneyLimitIntent.expected_limit_cents)) +
      '</strong>. New limit: <strong>' + escapeHtml(usd(moneyLimitIntent.new_limit_cents)) +
      '</strong>. Already used today: <strong>' + escapeHtml(usd(moneyLimitIntent.usedTodayCents)) +
      '</strong>. All spending already reserved today still counts. Each AI money-out still needs your independent authenticated approval, and requests above this limit need a second explicit override.</p>' +
      '<form method="post" autocomplete="off">' + formHidden +
      '<input type="hidden" name="action" value="confirm-money-limit">' +
      '<input type="hidden" name="id" value="' + escapeHtml(moneyLimitIntent.id) + '">' +
      '<label><input type="checkbox" name="ownerLimitConsent" value="yes" required> I personally authorize changing the daily limit for this exact account.</label>' +
      '<label>Re-enter administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
      '<button type="submit">Set this account limit</button></form>' : '') +
    '<h2>Pending money-out requests (private TEST owner review)</h2>' +
    '<p>Viewing requests never approves or executes money. Each grant requires a separate password-authenticated confirmation for one exact request; crossing the account daily limit requires a second separate confirmation. No LIVE or Stripe payment tool is enabled here.</p>' +
    '<form method="post" autocomplete="off">' + formHidden +
    '<input type="hidden" name="action" value="view-money-requests">' +
    '<label>Stripe account ID<input name="account" required maxlength="80" autocomplete="off"></label>' +
    '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
    '<button type="submit">Privately view pending TEST requests</button></form>' +
    (moneyInbox ? '<h2>Verified pending requests</h2>' +
      '<p>Stripe account: <strong>' + escapeHtml(moneyInbox.account) +
      '</strong>. Shared Colorado-day usage: ' + escapeHtml(usd(moneyInbox.usedCents)) +
      '. Daily limit: ' + escapeHtml(usd(moneyInbox.limitCents)) + '.</p>' +
      (moneyInbox.rows.length ? '<ol>' + moneyInbox.rows.map(item =>
        '<li>Operation: ' + escapeHtml(item.tool) +
        '; target: ' + escapeHtml(item.target) +
        '; amount: ' + escapeHtml(usd(Number(item.amount_cents))) +
        '; TEST mode; request key: ' + escapeHtml(item.request_key) +
        '; note: ' + escapeHtml(item.description) +
        '; expires: ' + escapeHtml(item.expiresLocal) +
        '; status: ' + escapeHtml(item.approvedFresh ? (item.needsOverride ?
          (item.allow_over_limit ? 'Owner approved with separate override' :
            'Approved; separate over-limit owner action required') : 'Owner approved, not consumed') :
            'Awaiting owner approval (or renewed approval)') +
        (item.approvedFresh && (!item.needsOverride || item.allow_over_limit) ? '' :
          '<form method="post" autocomplete="off">' + formHidden +
          '<input type="hidden" name="action" value="request-money-decision">' +
          '<input type="hidden" name="account" value="' + escapeHtml(moneyInbox.account) + '">' +
          '<input type="hidden" name="requestKey" value="' + escapeHtml(item.request_key) + '">' +
          '<input type="hidden" name="kind" value="' +
            (item.approvedFresh ? 'override' : 'approve') + '">' +
          '<label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
          '<button type="submit">Privately preview ' +
            (item.approvedFresh ? 'separate over-limit confirmation' : 'individual approval') +
            '</button></form>') +
        '</li>').join('') + '</ol>' : '<p>No verified pending requests.</p>') +
      '<p>Each preview is independent. Submitting the preview form does not grant approval.</p>' : '') +
    (moneyDecisionIntent ? '<h2>Final owner confirmation — TEST ' +
      escapeHtml(moneyDecisionIntent.kind === 'override' ? 'OVER-LIMIT OVERRIDE' : 'INDIVIDUAL MONEY-OUT') +
      '</h2><p>Exact account: ' + escapeHtml(moneyDecisionIntent.stripe_account) +
      '; tool: ' + escapeHtml(moneyDecisionIntent.tool) +
      '; Stripe-derived target: ' + escapeHtml(moneyDecisionIntent.target) +
      '; amount: <strong>' + escapeHtml(usd(Number(moneyDecisionIntent.amount_cents))) +
      ' USD</strong>; mode: TEST; request key: ' + escapeHtml(moneyDecisionIntent.request_key) +
      '; preview must be confirmed before: ' + escapeHtml(new Intl.DateTimeFormat('en-US',{
        timeZone:'America/Denver',dateStyle:'medium',timeStyle:'short'
      }).format(new Date(Math.min(new Date(moneyDecisionIntent.expires_at).getTime(),
        new Date(moneyDecisionIntent.request_expires_at).getTime())))) +
      ' (earliest request or preview expiry). Once approved, the transaction authorization is usable for at most 10 minutes after confirmation and never beyond the original request expiry.</p><p>' + (moneyDecisionIntent.kind === 'override' ?
        'This is a SECOND separate owner confirmation for spending above the account daily cap. It does not change the standing limit.' :
        'This approval alone permits no operation above the daily cap; that would need a separate owner override.') +
      ' No Stripe money moves through this page.</p>' +
      '<form method="post" autocomplete="off">' + formHidden +
      '<input type="hidden" name="action" value="confirm-money-decision">' +
      '<input type="hidden" name="id" value="' + escapeHtml(moneyDecisionIntent.id) + '">' +
      '<label><input type="checkbox" name="ownerMoneyConsent" value="yes" required> I personally authorize ONLY this exact ' +
      escapeHtml(moneyDecisionIntent.kind === 'override' ? 'over-limit override' : 'TEST money-out request') +
      ', account, Stripe target, amount and request key.</label>' +
      '<label>Re-enter administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
      '<button type="submit">Confirm this ' +
      escapeHtml(moneyDecisionIntent.kind === 'override' ? 'separate override' : 'individual approval') +
      '</button></form>' : '') +
    '</body></html>';
}
export function createSetupHandler({ db, keyStore, oneTimeStore, reportDownload, provisionWebhookSecret, forgetWebhookSecret, runTestSmoke, issueRtcPass, lookupTestReceipt, env = process.env }) {
  return async function setup(req, res) {
    if (!only(res, req, ['GET','POST'])) return;
    let origin;
    try { origin = publicOrigin(env); }
    catch { return send(res, 503, { error: 'server_not_configured', description: 'Set PUBLIC_BASE_URL first' }); }
    res.setHeader('Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    // The owner's Vercel project may have multiple public aliases. Serving a
    // form on a noncanonical alias makes the browser send that alias as Origin
    // while POST deliberately accepts only PUBLIC_BASE_URL. Redirect only GET
    // to the fixed configured issuer; never trust Host to grant POST access.
    // Deliberately drop query values (including one-time reveal selectors).
    const requestHost=req.headers?.host;
    if(req.method==='GET' && typeof requestHost==='string' &&
       requestHost.toLowerCase()!==new URL(origin).host.toLowerCase()){
      res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Location',origin+'/api/stripe/setup');
      return send(res,302,'Open the canonical Stripe owner setup page.',
        'text/plain; charset=utf-8');
    }
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
    if(p.action==='lookup-test-receipt'){
      if(typeof lookupTestReceipt!=='function')
        return send(res,503,htmlPage({csrf:cookie,
          result:'TEST receipt readback is unavailable.'}),'text/html; charset=utf-8');
      if(typeof p.account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(p.account)||
        typeof p.endpoint!=='string'||!/^we_[A-Za-z0-9]{2,100}$/.test(p.endpoint)||
        typeof p.eventId!=='string'||!/^evt_[A-Za-z0-9]{2,100}$/.test(p.eventId))
        return send(res,400,htmlPage({csrf:cookie,
          result:'Select an exact TEST account, endpoint and event ID.'}),
          'text/html; charset=utf-8');
      try{
        const found=await lookupTestReceipt({account:p.account,
          endpoint:p.endpoint,eventId:p.eventId});
        if(!found)return send(res,404,htmlPage({csrf:cookie,
          result:'No signed TEST receipt recorded for this exact account, endpoint and event.'}),
          'text/html; charset=utf-8');
        // Trust only metadata with the requested event identity; never display
        // provider event objects, signatures, account secrets or stored payloads.
        const time=new Date(found.receivedAt);
        if(found.eventId!==p.eventId||
          typeof found.eventType!=='string'||
          !/^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(found.eventType)||
          !Number.isFinite(time.getTime()))throw new TypeError('Receipt not verifiable');
        return send(res,200,htmlPage({csrf:cookie,
          result:'Recorded signed TEST receipt. Event type: '+found.eventType+
            '. Recorded UTC: '+time.toISOString()+
            '. External Stripe delivery and Vercel ingress remain separately unverified.'}),
          'text/html; charset=utf-8');
      }catch{return send(res,503,htmlPage({csrf:cookie,
        result:'Unable to verify a signed TEST receipt.'}),'text/html; charset=utf-8');}
    }
    if(p.action==='issue-rtc-pass'){
      if(typeof issueRtcPass!=='function')return send(res,503,htmlPage({csrf:cookie,
        result:'Read-only pass issuance is unavailable.'}),'text/html; charset=utf-8');
      try{
        const hours=p.hours??'24';
        if(hours!=='1'&&hours!=='24')throw new TypeError('Invalid pass lifetime');
        const issued=await issueRtcPass({account:p.account,
          areas:p.areas??'server',hours:Number(hours)});
        if(!/^\/api\/stripe\/setup\?show=[A-Za-z0-9_-]{32}$/.test(issued.setupPath))
          throw new TypeError('Invalid private handoff');
        return send(res,200,htmlPage({csrf:cookie,result:
          'Issued one '+(issued.lifetimeHours??24)+'-hour TEST read-only pass (writes and money disabled, selected areas only). Connection ID: '+
          issued.id+'. Open this owner-only one-time reveal URL, re-enter your passphrase, and never share the credential in chat: '+issued.setupPath}),
          'text/html; charset=utf-8');
      }catch{return send(res,400,htmlPage({csrf:cookie,
        result:'Cannot issue a TEST pass. Verify enrolled account and owner access.'}),'text/html; charset=utf-8');}
    }
    if (p.action === 'forget-webhook-secret'){
      if(typeof forgetWebhookSecret!=='function')return send(res,503,htmlPage({csrf:cookie,
        result:'Private credential removal is unavailable.'}),'text/html; charset=utf-8');
      try{
        const removed=await forgetWebhookSecret({account:p.account,endpoint:p.endpoint});
        return send(res,removed?200:404,htmlPage({csrf:cookie,result:removed?
          'Encrypted TEST signing secret forgotten. Signature verification will now refuse this endpoint.':
          'No stored TEST signing secret was found for this endpoint.'}),'text/html; charset=utf-8');
      }catch{return send(res,400,htmlPage({csrf:cookie,
        result:'Unable to remove this TEST endpoint credential.'}),'text/html; charset=utf-8');}
    }
    if (p.action === 'provision-webhook-secret') {
      if(typeof provisionWebhookSecret!=='function')return send(res,503,htmlPage({csrf:cookie,
        result:'Private webhook verification setup is unavailable.'}),'text/html; charset=utf-8');
      try{
        const saved=await provisionWebhookSecret({account:p.account,endpoint:p.endpoint,secret:p.secret});
        return send(res,200,htmlPage({csrf:cookie,result:'Encrypted TEST signing secret saved for '+
          saved.account+' / '+saved.endpoint+'. No secret was returned.'}),'text/html; charset=utf-8');
      }catch{
        return send(res,400,htmlPage({csrf:cookie,
          result:'Unable to verify this TEST endpoint or save its signing secret.'}),'text/html; charset=utf-8');
      }
    }
    if (p.action === 'download-report') {
      // Password, lockout, Origin and CSRF checks above must precede key decryption.
      if (typeof reportDownload !== 'function') return send(res,503,htmlPage({csrf:cookie,
        result:'Private CSV delivery is not configured.'}),'text/html; charset=utf-8');
      try {
        const file=await reportDownload({account:p.account,run:p.run});
        if(!Buffer.isBuffer(file?.bytes)||
           !/^stripe-report-frr_[A-Za-z0-9]{2,100}\.csv$/.test(file.filename))
          throw new TypeError('Unverified report file');
        res.setHeader('Cache-Control','no-store, private, max-age=0');
        res.setHeader('X-Content-Type-Options','nosniff');
        res.setHeader('Content-Type','text/csv; charset=utf-8');
        res.setHeader('Content-Disposition','attachment; filename="'+file.filename+'"');
        // Consume the page token on successful delivery so the same form cannot be reused.
        res.setHeader('Set-Cookie','stripe_setup_csrf=; Max-Age=0; Path=/api/stripe/setup; HttpOnly; Secure; SameSite=Strict');
        return res.status(200).send(file.bytes);
      } catch {
        return send(res,404,htmlPage({csrf:cookie,
          result:'Verified TEST report CSV unavailable. Check the account, run status, and key permissions.'}),
          'text/html; charset=utf-8');
      }
    }
    if (p.action === 'run-test-smoke') {
      if(typeof runTestSmoke!=='function') return send(res,503,htmlPage({csrf:cookie,
        result:'Owner TEST verification is not configured.'}),'text/html; charset=utf-8');
      // Independent owner-browser allowlist; never render arbitrary returned
      // MCP tool names, fields or provider data from a mock/compromised runner.
      const supported={
        account:['account_get','account_list_capabilities',
          'account_list_payment_method_settings','account_list_apple_pay_domains'],
        webhooks:['event_list','webhook_list'],
        readiness:['admin_list_requirements','admin_check_setting'],
        core:['account_get','account_list_capabilities',
          'account_list_payment_method_settings','account_list_apple_pay_domains',
          'event_list','webhook_list','admin_list_requirements','admin_check_setting'],
        administration:['stripe_admin_overview','admin_review_security','admin_list_guided_settings']
      };
      if(typeof p.account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(p.account)||
        !Object.hasOwn(supported,p.focus))
        return send(res,400,htmlPage({csrf:cookie,
          result:'Select one exact TEST account and supported smoke group.'}),'text/html; charset=utf-8');
      const allowed=supported[p.focus];
      try {
        const report=await runTestSmoke({account:p.account,focus:p.focus});
        // Browser results are a narrow allowlist, not an arbitrary upstream reply.
        if(report?.account!==p.account||report.mode!=='test'||report.focus!==p.focus||
          report.source!=='custom_mcp_dispatch'||report.verifiedIdentity!==true||
          report.dashboardVerified!==false||report.writeOperations!==0||
          !Array.isArray(report.records)||report.records.length!==allowed.length||
          new Set(report.records.map(v=>v.tool)).size!==allowed.length||
          report.records.some(v=>!['observed','partial','not_readable','error'].includes(v.status)||
            !allowed.includes(v.tool)))
          throw new TypeError('Unverified custom MCP report');
        const safe=buildSetupReadinessReport({mode:'test',focus:p.focus,source:'custom_mcp_dispatch',
          dashboardVerified:false,writeOperations:0,
          records:report.records.map(v=>({tool:v.tool,status:v.status}))});
        return send(res,200,htmlPage({csrf:cookie,smokeResult:safe,
          result:'Read-only TEST Setup & Readiness Report. Only the listed exceptions merit follow-up; no setting changes or account readiness are certified.'}),
          'text/html; charset=utf-8');
      } catch {
        return send(res,503,htmlPage({csrf:cookie,
          result:'Private TEST verification could not establish provider identity or readbacks. No acceptance recorded.'}),
          'text/html; charset=utf-8');
      }
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
    if (p.action === 'view-money-requests') {
      if(typeof p.account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(p.account))
        return send(res,400,htmlPage({csrf:cookie,result:'Select a valid Stripe account.'}),
          'text/html; charset=utf-8');
      try {
        const account=await db.getStripeAccount(p.account);
        if(!account?.test_connected) return send(res,404,htmlPage({csrf:cookie,result:
          'A verified TEST-connected Stripe account is required.'}),
          'text/html; charset=utf-8');
        const [rows,usage]=await Promise.all([
          db.listPendingMoneyApprovals({account:p.account,limit:10}),
          db.getMoneyUsage({account:p.account,connection:'owner-inbox'})
        ]);
        const usedCents=Number(usage?.used_cents);
        const limitCents=Number(usage?.limit_cents);
        if(!Number.isSafeInteger(usedCents)||usedCents<0||
            !Number.isSafeInteger(limitCents)||limitCents<0||
            !Array.isArray(rows)||rows.length>10) throw Error('Unverified inbox');
        const formatter=new Intl.DateTimeFormat('en-US',{
          timeZone:'America/Denver',year:'numeric',month:'short',day:'numeric',
          hour:'numeric',minute:'2-digit',timeZoneName:'short'
        });
        const verified=rows.map(row=>{
          const amount=Number(row.amount_cents);
          const expires=new Date(row.expires_at);
          if(row.mode!=='test'||!Number.isSafeInteger(amount)||amount<=0||
              row.currency!=='usd'||!Number.isFinite(expires.getTime())||
              typeof row.target!=='string'||!row.target||
              typeof row.tool!=='string'||typeof row.request_key!=='string')
            throw Error('Invalid pending record');
          const approvedTime=row.approved_at===null?NaN:new Date(row.approved_at).getTime();
          const approvedFresh=Number.isFinite(approvedTime)&&
            approvedTime<=Date.now()&&approvedTime>Date.now()-10*60*1000;
          return {...row,amount_cents:amount,expiresLocal:formatter.format(expires),
            approvedFresh,needsOverride:usedCents>limitCents-amount};
        });
        res.setHeader('Cache-Control','no-store');
        return send(res,200,htmlPage({csrf:cookie,
          moneyInbox:{account:p.account,usedCents,limitCents,rows:verified}}),
          'text/html; charset=utf-8');
      } catch {
        return send(res,503,htmlPage({csrf:cookie,result:
          'Could not verify private pending money requests. No operation authorized.'}),
          'text/html; charset=utf-8');
      }
    }
    if (p.action === 'request-money-decision') {
      // Only an authenticated owner can stage a preview; the SQL store copies
      // every identity field from the provider-bound request, never the form.
      const id=randomBytes(24).toString('base64url');
      let staged=false;
      try {
        staged=await db.requestMoneyDecisionIntent({
          id,account:p.account,idempotencyKey:p.requestKey,kind:p.kind,
          expiresAt:new Date(Date.now()+10*60*1000)
        });
      } catch { staged=false; }
      if(!staged)return send(res,409,htmlPage({csrf:cookie,result:
        'This exact TEST request is missing, stale, already granted, or not eligible for this action. Reopen your private inbox.'}),
        'text/html; charset=utf-8');
      const moneyDecisionIntent=await db.getMoneyDecisionIntent(id);
      if(!moneyDecisionIntent)return send(res,409,htmlPage({csrf:cookie,result:
        'Request changed before the private review. No approval was granted.'}),
        'text/html; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      return send(res,200,htmlPage({csrf:cookie,moneyDecisionIntent,
        result:'Preview only. Recheck the full TEST transaction and independently confirm with your passphrase.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'confirm-money-decision') {
      if(p.ownerMoneyConsent!=='yes')return send(res,400,htmlPage({csrf:cookie,result:
        'Your explicit independent consent for this exact transaction is required.'}),
        'text/html; charset=utf-8');
      const intent=await db.getMoneyDecisionIntent(p.id);
      if(!intent)return send(res,410,htmlPage({csrf:cookie,result:
        'This owner intent is expired, used, altered or no longer eligible. No authorization granted.'}),
        'text/html; charset=utf-8');
      const granted=await db.consumeMoneyDecisionIntent(p.id);
      res.setHeader('Cache-Control','no-store');
      return send(res,granted?200:409,htmlPage({csrf:cookie,result:granted?
        (intent.kind==='override'?
          'You separately approved one over-limit TEST request. This is not a standing cap increase.' :
          'You approved exactly one TEST money-out request. The shared daily cap and all further checks still apply.') :
        'Another owner action or transaction changed this request. No new authorization granted.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'request-money-limit') {
      const newLimitCents=parseUsdCents(p.newLimitUsd);
      if (newLimitCents===null) return send(res,400,htmlPage({csrf:cookie,result:
        'Enter a valid USD limit with no more than two decimal places.'}),
        'text/html; charset=utf-8');
      const id=randomBytes(24).toString('base64url');
      let staged=false;
      try { staged=await db.requestMoneyLimitIntent({
        id,account:p.account,newLimitCents,
        expiresAt:new Date(Date.now()+10*60*1000)
      }); } catch { staged=false; }
      if(!staged) return send(res,404,htmlPage({csrf:cookie,result:
        'No eligible TEST-connected account exists or the limit is unchanged.'}),
        'text/html; charset=utf-8');
      const moneyLimitIntent=await db.getMoneyLimitIntent(id);
      let usedTodayCents;
      try {
        const usage=await db.getMoneyUsage({account:p.account,connection:'owner-settings'});
        usedTodayCents=Number(usage?.used_cents);
      } catch { usedTodayCents=NaN; }
      if(!Number.isSafeInteger(usedTodayCents)||usedTodayCents<0) {
        return send(res,503,htmlPage({csrf:cookie,result:
          'Daily money-out usage cannot be verified. No limit change has been made.'}),
          'text/html; charset=utf-8');
      }
      moneyLimitIntent.usedTodayCents=usedTodayCents;
      return send(res,200,htmlPage({csrf:cookie,moneyLimitIntent,result:
        'Preview only. No limit has changed yet. Review both amounts carefully.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'confirm-money-limit') {
      if(p.ownerLimitConsent!=='yes') return send(res,400,htmlPage({csrf:cookie,result:
        'Independent owner approval is required for this specific limit change.'}),
        'text/html; charset=utf-8');
      const intent=await db.getMoneyLimitIntent(p.id);
      if(!intent)return send(res,410,htmlPage({csrf:cookie,result:
        'The request expired or was already used; start again.'}),
        'text/html; charset=utf-8');
      const updated=await db.consumeMoneyLimitIntent(p.id);
      return send(res,updated?200:409,htmlPage({csrf:cookie,result:updated
        ? 'New daily limit for '+intent.stripe_account+': '+usd(intent.new_limit_cents)+
          '. Separate owner approval is still required for EVERY AI money-out.'
        : 'Account limit changed elsewhere or this request is stale. No change made.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'request-default-account') {
      const id=randomBytes(24).toString('base64url');
      let staged=false;
      try { staged=await db.requestDefaultAccountIntent({
        id,account:p.account,expiresAt:new Date(Date.now()+10*60*1000)
      }); } catch { staged=false; }
      if (!staged) return send(res,404,htmlPage({csrf:cookie,result:
        'No eligible TEST-connected Stripe account matches, or it is already the default.'}),
        'text/html; charset=utf-8');
      const defaultIntent=await db.getDefaultAccountIntent(id);
      return send(res,200,htmlPage({csrf:cookie,defaultIntent,result:
        'Preview only. The default account is unchanged until you confirm.'}),
        'text/html; charset=utf-8');
    }
    if (p.action === 'confirm-default-account') {
      if (p.ownerDefaultConsent!=='yes') return send(res,400,htmlPage({csrf:cookie,result:
        'A separate owner acknowledgement is required.'}),
        'text/html; charset=utf-8');
      const intent=await db.getDefaultAccountIntent(p.id);
      if (!intent) return send(res,410,htmlPage({csrf:cookie,result:
        'This default-account request expired or was already used.'}),
        'text/html; charset=utf-8');
      const changed=await db.consumeDefaultAccountIntent(p.id);
      return send(res,changed?200:409,htmlPage({csrf:cookie,result:changed ?
        'Default for new connections changed to '+intent.stripe_account+'.' :
        'Another setting changed or the request is stale. No change made.'}),
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
