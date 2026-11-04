// Pure preview fingerprint for the guarded-write lifecycle. No provider
// imports and no secrets: the digest covers only the evaluated state a
// preview was based on — the target's before-state as read by the handler
// and the prepared preview facts (operation, account, mode, and the money
// spec where the write has one). Canonicalization is deterministic
// (object keys sorted recursively) so the same evaluated state always
// produces the same fingerprint, in the grouped uppercase-hex format of
// the LIVE-enablement fingerprint in src/tools/live-guard.js.
import { createHash } from 'node:crypto';

function canonical(value, seen = new Set()) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') return Number.isFinite(value) ? value : String(value);
  if (type === 'bigint') return value.toString();
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const out = value.map(item => canonical(item, seen));
    seen.delete(value);
    return out;
  }
  if (type === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') continue;
      out[key] = canonical(item, seen);
    }
    seen.delete(value);
    return out;
  }
  return String(value);
}

/** Fingerprint of the exact evaluated state behind a write preview.
 * A confirmation that presents this fingerprint is re-verified against a
 * fresh evaluation; any drift in the target's before-state or in the
 * prepared money/preview facts changes the fingerprint and voids the
 * confirmation. */
export function writePreviewFingerprint({ tool, account, mode, before, prepared } = {}) {
  const state = {
    action: 'guarded_write_preview',
    tool: typeof tool === 'string' ? tool : '',
    account: typeof account === 'string' ? account : '',
    mode: typeof mode === 'string' ? mode : '',
    before: canonical(before),
    previewLine: typeof prepared?.previewLine === 'string' ? prepared.previewLine : null,
    amountCents: Number.isSafeInteger(prepared?.amountCents) ? prepared.amountCents : null,
    currency: typeof prepared?.currency === 'string' ? prepared.currency : null,
    direction: typeof prepared?.direction === 'string' ? prepared.direction : null
  };
  const hex = createHash('sha256').update(JSON.stringify(state)).digest('hex')
    .slice(0, 20).toUpperCase();
  return 'WRITE-' + hex.match(/.{5}/g).join('-');
}
