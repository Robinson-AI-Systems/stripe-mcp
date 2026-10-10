// Portable OAuth security primitives. No Stripe imports.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_WINDOW_MINUTES = 15;
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export function hashToken(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('Credential must be non-empty');
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
export function secretsMatch(supplied, expected) {
  if (typeof expected !== 'string' || !expected) return false;
  return timingSafeEqual(Buffer.from(hashToken(String(supplied ?? '')), 'hex'), Buffer.from(hashToken(expected), 'hex'));
}
export function verifyPkce(verifier, challenge, method = 'S256') {
  if (method !== 'S256' || typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return false;
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9~._-]{43,128}$/.test(verifier)) return false;
  return secretsMatch(createHash('sha256').update(verifier).digest('base64url'), challenge);
}
export function validRedirectUri(value) {
  try {
    const u = new URL(value);
    return !u.username && !u.password && !u.hash && !!u.hostname &&
      (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)));
  } catch { return false; }
}
export function clientIp(req) {
  const h = req?.headers || {};
  const get = (v) => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim();
  const raw = get(h['x-vercel-forwarded-for']) || get(h['x-real-ip']) || req?.socket?.remoteAddress || '';
  const ip = raw.replace(/^\[([^\]]+)\](?::\d+)?$/, '$1').split('%')[0];
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return 'unknown';
  return ip.toLowerCase().split(':').slice(0, 4).join(':') + '::/64';
}
export async function evaluateLogin({ ip, supplied, expected, store }) {
  if (!expected) throw new Error('Login passphrase is not configured');
  const attempt = await store.recordLoginAttempt(ip);
  const count = await store.countRecentFailedLogins(ip, LOCKOUT_WINDOW_MINUTES);
  if (count > MAX_FAILED_LOGINS) return { status: 'locked' };
  if (!secretsMatch(supplied, expected)) return { status: 'wrong', attemptsLeft: MAX_FAILED_LOGINS - count };
  await store.markLoginAttemptSucceeded(attempt);
  return { status: 'ok' };
}
