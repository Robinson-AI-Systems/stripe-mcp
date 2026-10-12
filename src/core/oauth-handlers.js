// Contract-generic OAuth HTTP handlers. No Stripe-specific imports.
import { randomToken, hashToken, secretsMatch, verifyPkce, validRedirectUri, evaluateLogin, clientIp, LOCKOUT_WINDOW_MINUTES } from './oauth.js';
import { publicOrigin, send, escapeHtml, paramsOf, only } from './http.js';

const PROFILES = ['read_only', 'everyday', 'full'];
const LISTINGS = ['catalog', 'compact'];
const MODES = ['test']; // Explicit Batch B activation is required before live can be enabled.
const tokenResponse = (access, refresh) => ({
  access_token: access, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh
});
const bad = (res, status, code, description) => send(res, status, { error: code, error_description: description });
const str = (x) => typeof x === 'string' ? x : '';

export function createOAuthHandlers({ db, env = process.env }) {
  function urls() {
    const origin = publicOrigin(env);
    return { origin, resource: origin + '/api/mcp' };
  }
  function validateResource(value) {
    const { resource } = urls();
    return value === resource;
  }
  async function register(req, res) {
    if (!only(res, req, ['POST'])) return;
    let p;
    try { p = paramsOf(req); } catch { return bad(res, 400, 'invalid_client_metadata', 'Malformed registration'); }
    if (!Array.isArray(p.redirect_uris) || p.redirect_uris.length < 1 || p.redirect_uris.length > 8 ||
      !p.redirect_uris.every(x => typeof x === 'string' &&
        Buffer.byteLength(x, 'utf8') <= 2048 && validRedirectUri(x)) ||
      new Set(p.redirect_uris).size !== p.redirect_uris.length) {
      return bad(res, 400, 'invalid_client_metadata', 'One to eight valid, distinct redirect URIs (max 2048 bytes each) required');
    }
    if (p.client_name !== undefined && (typeof p.client_name !== 'string' ||
      p.client_name.length > 100 || /[\x00-\x1f\x7f]/.test(p.client_name))) {
      return bad(res, 400, 'invalid_client_metadata', 'Client name must be printable and at most 100 characters');
    }
    if (p.response_types !== undefined && (!Array.isArray(p.response_types) ||
      p.response_types.length !== 1 || p.response_types[0] !== 'code')) {
      return bad(res, 400, 'invalid_client_metadata', 'Only authorization code response type is supported');
    }
    if (p.grant_types !== undefined && (!Array.isArray(p.grant_types) ||
      !p.grant_types.includes('authorization_code') || p.grant_types.length > 2 ||
      new Set(p.grant_types).size !== p.grant_types.length ||
      !p.grant_types.every(x => ['authorization_code','refresh_token'].includes(x)))) {
      return bad(res, 400, 'invalid_client_metadata', 'Unsupported or duplicate grant types');
    }
    // RFC 7591 default for a new confidential client is HTTP Basic. Preserve
    // explicit legacy POST and PKCE-only public registrations unmodified.
    // Owner passphrase, exact TEST account/profile and S256 remain mandatory.
    const method = p.token_endpoint_auth_method === undefined
      ? 'client_secret_basic' : p.token_endpoint_auth_method;
    if (!['client_secret_post','client_secret_basic','none'].includes(method)) {
      return bad(res, 400, 'invalid_client_metadata', 'Unsupported client authentication');
    }
    const id = randomToken(24), secret = method === 'none' ? null : randomToken(32);
    await db.createOAuthClient({ clientId: id, clientSecret: secret,
      tokenEndpointAuthMethod: method, redirectUris: p.redirect_uris,
      clientName: str(p.client_name) });
    return send(res, 201, { client_id: id,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      redirect_uris: p.redirect_uris, token_endpoint_auth_method: method,
      grant_types: ['authorization_code','refresh_token'], response_types: ['code'] });
  }
  function authorizePage(p, accounts, error = '') {
    const fields = ['client_id','redirect_uri','response_type','code_challenge','code_challenge_method','state','resource'];
    const hidden = fields.map(name => '<input type="hidden" name="' + name + '" value="' + escapeHtml(p[name]) + '">').join('');
    const accountList = accounts.length ? accounts.map(a => '<option value="' + escapeHtml(a.id) + '"' +
      (p.stripe_account === a.id ? ' selected' : '') + '>' + escapeHtml(a.label) + '</option>').join('') : '';
    const profileList = PROFILES.map(v => '<option value="' + v + '"' + (p.profile === v ? ' selected' : '') + '>' + v + '</option>').join('');
    const listingList = LISTINGS.map(v => '<option value="' + v + '"' + (p.listing === v ? ' selected' : '') + '>' + v + '</option>').join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Connect Robinson Stripe MCP</title><style>body{font:16px system-ui,sans-serif;max-width:410px;margin:6vh auto;padding:20px}form{display:grid;gap:14px}input,select,button{font:inherit;padding:10px}button{cursor:pointer}p{line-height:1.5}</style></head><body>' +
      '<h1>Connect Stripe MCP</h1>' + (error ? '<p role="alert">' + escapeHtml(error) + '</p>' : '') +
      (accounts.length ? '<p>Choose the Stripe account and permissions for this AI connection.</p>' :
       '<p>No Stripe accounts connected yet. Add a test account securely through the setup page when A-5 is available.</p>') +
      '<form method="post">' + hidden +
      '<label>Stripe account<select name="stripe_account" required>' + accountList + '</select></label>' +
      '<label>Profile<select name="profile">' + profileList + '</select></label>' +
      '<label>Tool listing<select name="listing">' + listingList + '</select></label>' +
      '<input type="hidden" name="mode" value="test"><label>Administrator passphrase<input type="password" name="passphrase" required autocomplete="current-password"></label>' +
      '<button type="submit"' + (!accounts.length ? ' disabled' : '') + '>Authorize this connection</button></form></body></html>';
  }
  async function authorize(req, res) {
    if (!only(res, req, ['GET', 'POST'])) return;
    let p;
    try { p = paramsOf(req); } catch { return bad(res, 400, 'invalid_request', 'Malformed authorization request'); }
    const client = await db.getOAuthClient(str(p.client_id));
    if (!client || !client.redirect_uris?.includes(p.redirect_uri) || !validRedirectUri(p.redirect_uri)) {
      return bad(res, 400, 'invalid_request', 'Unknown client or redirect address');
    }
    if (p.response_type !== 'code' || p.code_challenge_method !== 'S256' ||
      !/^[A-Za-z0-9_-]{43}$/.test(str(p.code_challenge)) || !validateResource(p.resource)) {
      return bad(res, 400, 'invalid_request', 'Authorization code, S256 PKCE, and exact MCP resource are required');
    }
    const accounts = await db.listStripeAccounts();
    if (req.method === 'GET') {
      // Claude's tool-search client defaults to catalog; other clients use
      // compact, with an explicit owner choice taking precedence.
      const listing=p.listing||(/claude/i.test(client.client_name||'')?'catalog':'compact');
      return send(res,200,authorizePage({...p,listing},accounts),'text/html; charset=utf-8');
    }
    if (!env.ADMIN_PASSPHRASE) return bad(res, 503, 'server_not_configured', 'Admin passphrase is not configured');
    const verdict = await evaluateLogin({ ip: clientIp(req), supplied: p.passphrase,
      expected: env.ADMIN_PASSPHRASE, store: db });
    if (verdict.status === 'locked') {
      res.setHeader('Retry-After', String(LOCKOUT_WINDOW_MINUTES * 60));
      return send(res, 429, authorizePage(p, accounts, 'Too many sign-in attempts'), 'text/html; charset=utf-8');
    }
    if (verdict.status !== 'ok') return send(res, 401, authorizePage(p, accounts, 'Incorrect passphrase'), 'text/html; charset=utf-8');
    if (!MODES.includes(p.mode) || !PROFILES.includes(p.profile) || !LISTINGS.includes(p.listing) ||
      !accounts.some(a => a.id === p.stripe_account)) {
      return send(res, 400, authorizePage(p, accounts, 'Invalid account, mode, or connection settings'), 'text/html; charset=utf-8');
    }
    const code = randomToken(32);
    await db.createAuthCode({ code, clientId: p.client_id, redirectUri: p.redirect_uri,
      codeChallenge: p.code_challenge, codeChallengeMethod: 'S256', stripeAccount: p.stripe_account,
      mode: p.mode, profile: p.profile, listing: p.listing });
    const destination = new URL(p.redirect_uri);
    destination.searchParams.set('code', code);
    if (typeof p.state === 'string') destination.searchParams.set('state', p.state);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', destination.toString());
    return res.status(302).end();
  }
  async function token(req, res) {
    if (!only(res, req, ['POST'])) return;
    let p;
    try { p = paramsOf(req); } catch { return bad(res, 400, 'invalid_request', 'Malformed token request'); }
    if (!validateResource(p.resource)) return bad(res, 400, 'invalid_target', 'Token resource must be this MCP');
    // RFC 6749: confidential clients may authenticate with HTTP Basic. Never
    // accept two credential mechanisms on the same request.
    const authHeader = String(req.headers?.authorization || '');
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authHeader);
    let basic = null;
    if (match) {
      const decoded = Buffer.from(match[1], 'base64');
      const value = decoded.toString('utf8');
      const colon = value.indexOf(':');
      if (decoded.toString('base64') === match[1] && colon > 0 &&
        colon === value.lastIndexOf(':')) {
        basic = { id: value.slice(0, colon), secret: value.slice(colon + 1) };
      }
    }
    const clientId = basic?.id || str(p.client_id);
    const client = await db.getOAuthClient(clientId);
    const method = client?.token_endpoint_auth_method;
    const validPublic = method === 'none' && !authHeader &&
      (p.client_secret === undefined || p.client_secret === '');
    const validPost = method === 'client_secret_post' && !authHeader &&
      typeof p.client_secret === 'string' && !!p.client_secret &&
      secretsMatch(hashToken(p.client_secret), client?.client_secret_hash);
    const validBasic = method === 'client_secret_basic' && !!basic &&
      (p.client_id === undefined || p.client_id === clientId) &&
      p.client_secret === undefined && !!basic.secret &&
      secretsMatch(hashToken(basic.secret), client?.client_secret_hash);
    if (!client || !(validPublic || validPost || validBasic)) {
      // RFC 6749 §5.2 requires an authentication challenge on failed header auth.
      if (authHeader) res.setHeader('WWW-Authenticate', 'Basic realm="Stripe MCP OAuth"');
      return bad(res, 401, 'invalid_client', 'Client credentials rejected');
    }
    if (p.grant_type === 'authorization_code') {
      if (!p.code || !client.redirect_uris.includes(p.redirect_uri) || !p.code_verifier) {
        return bad(res, 400, 'invalid_grant', 'Missing or invalid authorization details');
      }
      const record = await db.consumeAuthCode(p.code);
      if (!record || record.client_id !== clientId || record.redirect_uri !== p.redirect_uri ||
        !verifyPkce(p.code_verifier, record.code_challenge, record.code_challenge_method)) {
        return bad(res, 400, 'invalid_grant', 'Code is expired, used, or failed PKCE');
      }
      const accessToken = randomToken(32), refreshToken = randomToken(32);
      await db.createAccessToken({ accessToken, refreshToken, clientId: clientId,
        stripeAccount: record.stripe_account, mode: record.mode, profile: record.profile, listing: record.listing });
      return send(res, 200, tokenResponse(accessToken, refreshToken));
    }
    if (p.grant_type === 'refresh_token') {
      if (!str(p.refresh_token)) return bad(res, 400, 'invalid_grant', 'Missing refresh token');
      const accessToken = randomToken(32), refreshToken = randomToken(32);
      const rotated = await db.rotateRefreshToken({ refreshToken: p.refresh_token, clientId: clientId,
        accessToken, newRefreshToken: refreshToken });
      if (!rotated) return bad(res, 400, 'invalid_grant', 'Refresh credential is expired, used, or revoked');
      return send(res, 200, tokenResponse(accessToken, refreshToken));
    }
    return bad(res, 400, 'unsupported_grant_type', 'Supported grants: authorization_code and refresh_token');
  }
  function metadata(req, res) {
    if (!only(res, req, ['GET'])) return;
    const { origin } = urls();
    return send(res, 200, { issuer: origin, authorization_endpoint: origin + '/api/oauth/authorize',
      token_endpoint: origin + '/api/oauth/token', registration_endpoint: origin + '/api/oauth/register',
      response_types_supported: ['code'], grant_types_supported: ['authorization_code','refresh_token'],
      code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['client_secret_post','client_secret_basic','none'] });
  }
  function resourceMetadata(req, res) {
    if (!only(res, req, ['GET'])) return;
    const { origin, resource } = urls();
    return send(res, 200, { resource, authorization_servers: [origin] });
  }
  return { register, authorize, token, metadata, resourceMetadata };
}
