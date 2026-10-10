// Stripe adapter injects provider-specific idempotency and money rules.
import { defineWrite as defineCoreWrite } from '../core/write.js';
import { idempotencyKey, classifyStripeWriteError } from '../stripe/client.js';
import { prepareMoney, reserveMoneyBeforeWrite, settleMoneyAfterWrite } from '../money.js';
export function defineWrite(spec) {
  if (spec?.money && typeof spec.money !== 'function') throw new TypeError('Money spec must be a function');
  return defineCoreWrite({ ...spec, idempotency: idempotencyKey,
    classifyError: classifyStripeWriteError,
    prepare: spec?.money ? async (args, ctx, before) =>
      prepareMoney(await spec.money(args, ctx, before)) : null,
    beforeApply: spec?.money ? reserveMoneyBeforeWrite : null,
    afterApply: spec?.money ? settleMoneyAfterWrite : null });
}
export function gone(reason = 'Operation unavailable') {
  return { isError: true, content: [{ type: 'text',
    text: JSON.stringify({ done: false, error: reason }) }] };
}
export const safetyNote = 'Every Stripe write requires a preview, confirmation, retry key and read-back; money out also needs the owner-approved daily limit.';
export function guard(connection) {
  return !!connection?.stripeAccount && connection.mode === 'test' &&
    ['everyday', 'full'].includes(connection.profile);
}
