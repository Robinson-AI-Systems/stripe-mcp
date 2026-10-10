// Stripe adapter injects provider-specific idempotency and money rules.
import { defineWrite as defineCoreWrite } from '../core/write.js';
import { idempotencyKey, classifyStripeWriteError } from '../stripe/client.js';
import { prepareMoney, reserveMoneyBeforeWrite, settleMoneyAfterWrite } from '../money.js';
import { authorizeLiveWrite } from './live-guard.js';
import { protectAppOwnedTarget, appRefundPreviewSuffix } from './app-guard.js';
export function defineWrite(spec) {
  if (spec?.money && typeof spec.money !== 'function') throw new TypeError('Money spec must be a function');
  if (spec?.appOwnedRefundAllowed === true && typeof spec.money !== 'function') {
    throw new TypeError('App-owned refund exception requires the guarded money contract');
  }
  const targetGuard = async (args, ctx, before) => {
    const appDecision = await protectAppOwnedTarget(args, ctx, before,
      { refundException:spec?.appOwnedRefundAllowed === true });
    if (appDecision !== true) return appDecision;
    return typeof spec?.targetGuard === 'function' ? spec.targetGuard(args, ctx, before) : true;
  };
  const summarize = async (before, args, ctx) => {
    const original = await spec.summarize(before,args,ctx);
    if (typeof original !== 'string') return original;
    return spec?.appOwnedRefundAllowed === true
      ? original + await appRefundPreviewSuffix(before,ctx) : original;
  };
  return defineCoreWrite({ ...spec, summarize, targetGuard, idempotency: idempotencyKey,
    classifyError: classifyStripeWriteError,
    modeGuard: (args, ctx) => authorizeLiveWrite({ args, ctx }),
    prepare: spec?.money ? async (args, ctx, before) =>
      prepareMoney(await spec.money(args, ctx, before), ctx?.connection?.mode) : null,
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
