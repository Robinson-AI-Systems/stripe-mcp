import { createHash, randomBytes } from 'node:crypto';
// Live-mode decisions are server-side and never accepted from tool arguments.
// LIVE grants come from the server's separately owner-approved connection, not
// caller arguments. Preview is allowed before confirm; the original defineWrite
// guard still refuses every write without confirmation and an audit record.
export const LIVE_REAUTH_WINDOW_MS = 10 * 60 * 1000;

export function isRecentOwnerVerification({ confirmed, verifiedAt, now = Date.now() }) {
  return confirmed === true && Number.isSafeInteger(verifiedAt) &&
    Number.isSafeInteger(now) && verifiedAt <= now &&
    now - verifiedAt <= LIVE_REAUTH_WINDOW_MS;
}

/** Fingerprint of the exact LIVE-enablement state the owner was shown.
 * Canonical fields: the one-time intent, the Stripe account, the enrolled
 * LIVE credential's kind and last4, the current enabled/connected state,
 * the deployment environment and the intent expiry. Any change to those
 * facts changes the fingerprint and voids a confirmation given against
 * the old one. The digest carries no secret: kind and last4 are the same
 * non-secret identifiers the owner page already displays. */
export function liveEnableFingerprint({ intentId, account, environment } = {}) {
  const expires = account?.expires_at ?? account?.expiresAt;
  const expiryMs = expires instanceof Date ? expires.getTime() : Date.parse(expires);
  const state = {
    action: 'stripe_enable_live',
    intent: typeof intentId === 'string' ? intentId : '',
    account: typeof account?.stripe_account === 'string' ? account.stripe_account
      : typeof account?.id === 'string' ? account.id : '',
    keyKind: typeof account?.live_key_kind === 'string' ? account.live_key_kind : null,
    keyLast4: typeof account?.live_key_last4 === 'string' ? account.live_key_last4 : null,
    liveEnabled: account?.live_enabled === true,
    liveConnected: account?.live_connected === true,
    environment: typeof environment === 'string' && environment ? environment : 'local',
    expiresAt: Number.isFinite(expiryMs) ? new Date(expiryMs).toISOString() : null
  };
  const hex = createHash('sha256').update(JSON.stringify(state)).digest('hex')
    .slice(0, 20).toUpperCase();
  return 'LIVE-' + hex.match(/.{5}/g).join('-');
}

export async function authorizeLiveWrite({ ctx, env = process.env }) {
  const connection = ctx?.connection;
  if (connection?.mode === 'test') return true;
  if (connection?.mode !== 'live' || !connection.stripeAccount ||
      env?.VERCEL_ENV !== 'production' ||
      ctx?.liveAccessGranted !== true ||
      typeof ctx?.db?.getStripeAccount !== 'function') return false;
  try {
    // Read state on every live operation; a revoked account takes effect
    // immediately, including on existing OAuth access tokens.
    const account = await ctx.db.getStripeAccount(connection.stripeAccount);
    return account?.id === connection.stripeAccount &&
      account.live_enabled === true && account.live_connected === true;
  } catch {
    return false;
  }
}


/** Stage an account-specific, ten-minute pending LIVE intent after a confirmed
 * first-step owner command. The actual account flag is NOT changed here.
 * B-8 must make this helper reachable only from its FULL-profile, confirmed tool.
 */
export async function requestLiveEnableIntent({ db, connection, confirm, now = Date.now() }) {
  if (confirm !== true || connection?.mode !== 'test' || connection?.profile !== 'full' ||
      !connection?.stripeAccount || !Number.isSafeInteger(now) ||
      typeof db?.createLiveEnableIntent !== 'function') {
    return { accepted:false, reason:'Explicit first-step confirmation from a full TEST connection required' };
  }
  const id=randomBytes(24).toString('base64url');
  await db.createLiveEnableIntent({id,account:connection.stripeAccount,
    expiresAt:new Date(now + LIVE_REAUTH_WINDOW_MS)});
  return {accepted:true, id, account:connection.stripeAccount, expiresInSeconds:600,
    requiresOwnerSetupPage:true, liveEnabled:false};
}
