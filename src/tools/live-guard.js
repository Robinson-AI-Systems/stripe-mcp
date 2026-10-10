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

export function withLiveBanner(value, mode) {
  return mode === 'live' ? { mode: 'LIVE', ...value, mode: 'LIVE' } : value;
}
