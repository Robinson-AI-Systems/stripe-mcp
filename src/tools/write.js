// Provider-specific adapter for the generic guarded-write engine.
import { defineWrite as defineCoreWrite } from '../core/write.js';
import { idempotencyKey } from '../stripe/client.js';

export function defineWrite(spec) {
  if (spec?.money) {
    // B-1b reserves and enforces money before any money-changing tool is allowed.
    throw new Error('Money-changing write procedures are not enabled without the daily limit gate');
  }
  return defineCoreWrite({ ...spec, idempotency: idempotencyKey });
}
export function gone(reason = 'Operation unavailable') {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ done: false, error: reason }) }] };
}
export const safetyNote = 'All writes require a preview, explicit confirmation, stable retry key and read-back.';
export function guard(connection) {
  return !!connection?.stripeAccount && connection.mode === 'test' &&
    ['everyday', 'full'].includes(connection.profile);
}
