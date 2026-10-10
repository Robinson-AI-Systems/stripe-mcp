import Stripe from 'stripe';
import { createHash } from 'node:crypto';

// The only production Stripe SDK import. Never log or return the key.
export const STRIPE_API_VERSION = '2026-09-30.endive';
const OMIT = new Set(['dryRun','confirm','fields','detail','requestKey']);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('Plain JSON arguments required');
    return Object.fromEntries(Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => [k, canonical(value[k])]));
  }
  if (['bigint','function','symbol'].includes(typeof value)) throw new TypeError('JSON arguments required');
  return value;
}
export function idempotencyKey(ctx, tool, args = {}, { now = Date.now() } = {}) {
  const account = ctx?.stripeAccount || ctx?.account;
  if (!account || !['live','test'].includes(ctx?.mode) || !/^[a-z][a-z0-9_]{1,48}$/.test(tool) ||
      !args || typeof args !== 'object' || Array.isArray(args) || !Number.isFinite(now)) {
    throw new TypeError('Account, mode, tool, plain arguments, and time are required');
  }
  const requestKey = args.requestKey;
  if (requestKey !== undefined && (typeof requestKey !== 'string' || !requestKey || requestKey.length > 128)) {
    throw new TypeError('requestKey must be 1 to 128 characters');
  }
  const selected = requestKey ? ['request',requestKey] : ['args',canonical(Object.fromEntries(
    Object.entries(args).filter(([k]) => !OMIT.has(k)))),Math.floor(now / 600000)];
  return 'rmcp_' + tool + '_' + digest([account,ctx.mode,tool,...selected]);
}
export function makeStripeClient({ key, mode }, testOptions = {}) {
  if (typeof key !== 'string' || !['test','live'].includes(mode)) throw new TypeError('Stripe key and mode required');
  const match = /^(?:sk|rk)_(test|live)_[A-Za-z0-9]+$/.exec(key);
  if (!match || match[1] !== mode) throw new Error('Stripe key does not match the requested mode');
  if (mode === 'live' && process.env.VERCEL_ENV !== 'production') {
    throw new Error('Live Stripe keys refused on non-production deployments');
  }
  if (Object.keys(testOptions).length && process.env.VITEST !== 'true') {
    throw new Error('Stripe transport overrides are restricted to tests');
  }
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 30000, ...testOptions });
}
export async function listAll(listFn, params = {}, { max = 1000 } = {}) {
  if (typeof listFn !== 'function' || !Number.isInteger(max) || max < 1 || max > 1000) {
    throw new TypeError('Valid Stripe list function and cap (1–1000) required');
  }
  const items = [];
  let cursor = params.starting_after, capped = false;
  while (items.length < max) {
    const nextParams = { ...params, limit: Math.min(Math.max(1, Number(params.limit) || 100), max - items.length, 100) };
    if (cursor !== undefined) nextParams.starting_after = cursor;
    const page = await listFn(nextParams);
    if (!Array.isArray(page?.data) || typeof page.has_more !== 'boolean') throw new Error('Invalid Stripe list response');
    items.push(...page.data.slice(0,max-items.length));
    if (items.length === max && page.has_more) capped = true;
    if (!page.has_more || items.length === max) break;
    if (!page.data.length || typeof page.data.at(-1)?.id !== 'string') throw new Error('Pagination cannot advance');
    cursor = page.data.at(-1).id;
  }
  return { items, capped };
}

// Only official Stripe SDK error subclasses with definitive rejection status
// codes are safe to treat as an operation that never moved money. Any unknown,
// interrupted, idempotency-conflict or rate-limit response remains uncertain.
export function classifyStripeWriteError(error) {
  const e = Stripe.errors;
  if ((error instanceof e.StripeInvalidRequestError && [400, 404].includes(error.statusCode)) ||
      (error instanceof e.StripeAuthenticationError && error.statusCode === 401) ||
      (error instanceof e.StripePermissionError && error.statusCode === 403) ||
      (error instanceof e.StripeCardError && error.statusCode === 402)) {
    return 'rejected';
  }
  return 'uncertain';
}
