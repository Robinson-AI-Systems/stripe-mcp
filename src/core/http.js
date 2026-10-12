// Service-independent HTTP helpers. Never derive OAuth issuer from an untrusted Host header.
export function publicOrigin(env = process.env) {
  const value = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  let url;
  try { url = new URL(value); } catch { throw new Error('PUBLIC_BASE_URL must be configured as an HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || url.pathname !== '/') {
    throw new Error('PUBLIC_BASE_URL must be configured as an HTTPS origin');
  }
  return url.origin;
}

export function send(res, status, value, contentType = 'application/json; charset=utf-8') {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', contentType);
  return res.status(status).send(contentType.startsWith('application/json') ? JSON.stringify(value) : value);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export const MAX_HTTP_BODY_BYTES = 16 * 1024;

// Frameworks can pre-parse JSON, but caller objects are not trusted JSON.
// Never stringify them directly: getters or toJSON methods can execute code.
// A detached descriptor-only tree preserves JSON values without invoking them.
export function safePreparsedObject(body) {
  const seen = new WeakSet();
  let entries = 0;
  function copy(value, depth) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || depth > 32 || seen.has(value)) throw new Error('Invalid request body');
    const array = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
      throw new Error('Invalid request body');
    seen.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > MAX_HTTP_BODY_BYTES || (array && descriptors.length.value > MAX_HTTP_BODY_BYTES))
      throw new Error('Invalid request body');
    const result = array ? [] : Object.create(null);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (typeof key !== 'string' || !descriptor.enumerable ||
          !Object.hasOwn(descriptor, 'value') ||
          key === '__proto__' || key === 'constructor' || key === 'prototype' ||
          (array && !/^(0|[1-9][0-9]*)$/.test(key)))
        throw new Error('Invalid request body');
      if (++entries > MAX_HTTP_BODY_BYTES) throw new Error('Invalid request body');
      result[key] = copy(descriptor.value, depth + 1);
    }
    if (array && Object.keys(result).length !== descriptors.length.value)
      throw new Error('Invalid request body');
    seen.delete(value);
    return result;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request body');
  const inert = copy(body, 0);
  // Only inert, null-prototype records / ordinary arrays reach stringify.
  if (Buffer.byteLength(JSON.stringify(inert), 'utf8') > MAX_HTTP_BODY_BYTES)
    throw new Error('Invalid request body');
  return inert;
}

// Preserve the original wire-byte limit and Content-Length/rawBody mismatch
// checks even when a framework also provides a parsed body.
export function incomingBodyWithinLimit(req) {
  if (req.method !== 'POST') return true;
  const supplied = req.headers?.['content-length'];
  let declared;
  if (supplied !== undefined) {
    if (typeof supplied !== 'string' || !/^(0|[1-9]\d*)$/.test(supplied)) return false;
    declared = Number(supplied);
    if (!Number.isSafeInteger(declared) || declared > MAX_HTTP_BODY_BYTES) return false;
  }
  const raw = req.rawBody;
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    try { safePreparsedObject(body); } catch { return false; }
  }
  if (raw !== undefined) {
    if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) return false;
    const bytes = Buffer.byteLength(raw);
    if (bytes > MAX_HTTP_BODY_BYTES || (declared !== undefined && bytes !== declared)) return false;
  } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const bytes = Buffer.byteLength(body);
    if (bytes > MAX_HTTP_BODY_BYTES || (declared !== undefined && bytes !== declared)) return false;
  } else if (body && typeof body === 'object') {
    // Original wire bytes cannot be reconstructed from framework-parsed JSON.
    if (declared === undefined) return false;
  }
  return true;
}

export function paramsOf(req) {
  if (req.method === 'GET') return req.query || {};
  const contentType = String(req.headers?.['content-type'] || '').split(';')[0].toLowerCase();
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body) && !Array.isArray(body))
    return safePreparsedObject(body);
  if (typeof body !== 'string' || Buffer.byteLength(body) > MAX_HTTP_BODY_BYTES)
    throw new Error('Invalid request body');
  if (contentType === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(body));
  if (contentType === 'application/json') {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return safePreparsedObject(parsed);
  }
  throw new Error('Unsupported request body');
}
export const only = (res, req, methods) => {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  send(res, 405, { error: 'method_not_allowed' });
  return false;
};
