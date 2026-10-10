import { randomBytes } from 'node:crypto';
// Live-mode decisions are server-side and never accepted from tool arguments.
// Nothing in the current MCP dispatcher grants liveAccessGranted. A future
// owner-only two-step activation must establish this server-owned gate.
export const LIVE_REAUTH_WINDOW_MS = 10 * 60 * 1000;

export function isRecentOwnerVerification({ confirmed, verifiedAt, now = Date.now() }) {
  return confirmed === true && Number.isSafeInteger(verifiedAt) &&
    Number.isSafeInteger(now) && verifiedAt <= now &&
    now - verifiedAt <= LIVE_REAUTH_WINDOW_MS;
}

export async function authorizeLiveWrite({ args, ctx, env = process.env }) {
  const connection = ctx?.connection;
  if (connection?.mode === 'test') return true;
  if (connection?.mode !== 'live' || !connection.stripeAccount ||
      args?.confirm !== true || env?.VERCEL_ENV !== 'production' ||
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
