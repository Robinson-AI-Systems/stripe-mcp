// Contract-generic MCP bearer authentication. Never forwards the bearer to the provider.
import { publicOrigin, send } from './http.js';
import { resolveGrantContext, contextMayOperate, journalBoundaryEvent } from '../developer/access.js';

export async function requireMcpToken(req, res, db, env = process.env) {
  const origin = publicOrigin(env);
  const challenge = 'Bearer resource_metadata="' + origin + '/.well-known/oauth-protected-resource"';
  // HTTP authentication scheme names are case-insensitive, while the exact
  // connector token bytes and kind remain strict. RTC passes use another door.
  const match = /^[Bb][Ee][Aa][Rr][Ee][Rr][ \t]+([A-Za-z0-9_-]{30,256})$/.exec(
    String(req.headers?.authorization || ''));
  if (!match) {
    res.setHeader('WWW-Authenticate', challenge);
    send(res, 401, { error: 'unauthorized', error_description: 'A valid connection is required' });
    return null;
  }
  const record = await db.getAccessToken(match[1]);
  if (!record || !['read_only','everyday','full'].includes(record.profile) ||
      !['catalog','compact'].includes(record.listing) ||
      !['test','live'].includes(record.mode)) {
    res.setHeader('WWW-Authenticate', challenge + ', error="invalid_token"');
    send(res, 401, { error: 'invalid_token' });
    return null;
  }
  // Fleet developer access boundary (D-001): resolve the grant's identity
  // context from server-side records only (issuance stamp, else the
  // registered client) and confine developer context to TEST. A developer
  // grant presented for LIVE customer operations fails closed with the
  // same indistinguishable refusal as any other invalid token.
  let context = record.context === 'developer' ? 'developer' : 'customer';
  if (context !== 'developer' && typeof db.getOAuthClient === 'function') {
    let client = null;
    try { client = await db.getOAuthClient(record.client_id); } catch { client = null; }
    context = resolveGrantContext({ record, client, origin });
  }
  if (!contextMayOperate({ context, mode: record.mode })) {
    await journalBoundaryEvent(db, { surface: 'mcp', context, mode: record.mode,
      reason: 'developer_live_access_refused', clientId: record.client_id });
    res.setHeader('WWW-Authenticate', challenge + ', error="invalid_token"');
    send(res, 401, { error: 'invalid_token' });
    return null;
  }
  if(record.mode==='live'){
    let account;
    try{account=env.VERCEL_ENV==='production'&&
      await db.getStripeAccount(record.stripe_account);}
    catch{account=null;}
    if(!account||account.id!==record.stripe_account||
      account.live_enabled!==true||account.live_connected!==true){
      res.setHeader('WWW-Authenticate',challenge+', error="invalid_token"');
      send(res,401,{error:'invalid_token'});
      return null;
    }
  }
  return Object.freeze({ clientId: record.client_id, stripeAccount: record.stripe_account,
    mode: record.mode, profile: record.profile, listing: record.listing, context,
    // The only LIVE write grant is the actual owner-consented persisted OAuth
    // token bit; no caller-controlled JSON can create it. Money is NOT granted.
    rtcLiveOwnerApproved:record.mode==='live'&&record.allow_writes===true,
    moneyLimitCents:0, resultScope: record.result_scope });
}
