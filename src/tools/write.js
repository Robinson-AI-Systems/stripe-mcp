// Stripe adapter injects provider-specific idempotency and money rules.
import { defineWrite as defineCoreWrite } from '../core/write.js';
import { idempotencyKey, classifyStripeWriteError } from '../stripe/client.js';
import { prepareMoney, reserveMoneyBeforeWrite, settleMoneyAfterWrite } from '../money.js';
import { authorizeLiveWrite } from './live-guard.js';
import { protectAppOwnedTarget } from './app-guard.js';
import { toStripeToolError } from './errors.js';
import { shapeToolResult } from './util.js';
export function defineWrite(spec) {
  if (spec?.money && typeof spec.money !== 'function') throw new TypeError('Money spec must be a function');
  if (spec?.targetGuard !== undefined && typeof spec.targetGuard !== 'function') {
    throw new TypeError('Custom targetGuard must be a function');
  }
  if (spec?.appOwnedRefundAllowed === true && typeof spec.money !== 'function') {
    throw new TypeError('App-owned refund exception requires the guarded money contract');
  }
  if (typeof spec?.summarize !== 'function') {
    throw new TypeError('The guarded write summary must be a function');
  }
  const targetGuard = async (args, ctx, before) => {
    const appDecision = await protectAppOwnedTarget(args, ctx, before, {
      refundException:spec?.appOwnedRefundAllowed === true,returnOwnership:true
    });
    if (appDecision !== true && appDecision?.allowed !== true) return appDecision;
    const custom = spec?.targetGuard ? await spec.targetGuard(args,ctx,before) : true;
    if (custom !== true) return custom;
    return appDecision;
  };
  const summarize = async (before, args, ctx, guarded) => {
    const original = await spec.summarize(before,args,ctx);
    if (typeof original !== 'string') return original;
    return spec?.appOwnedRefundAllowed === true && guarded?.ownership
      ? original + ' The rental app will see this refund and record it.' : original;
  };
  const guarded = defineCoreWrite({ ...spec, summarize, targetGuard, idempotency: idempotencyKey,
    classifyError: classifyStripeWriteError,
    modeGuard: (args, ctx) => authorizeLiveWrite({ args, ctx }),
    prepare: spec?.money ? async (args, ctx, before) =>
      prepareMoney(await spec.money(args, ctx, before), ctx?.connection?.mode) : null,
    beforeApply: spec?.money ? reserveMoneyBeforeWrite : null,
    afterApply: spec?.money ? settleMoneyAfterWrite : null });
  // These metadata values reflect the validated, installed money hook above.
  // No tool may claim '
    try { return shapeToolResult(await guarded.handler(args,ctx), {mode:ctx?.connection?.mode}); }
    catch (error) {
      const formatted=toStripeToolError(error,{
        mode:ctx?.connection?.mode, requiredPermission:spec?.requiredPermission
      });
      if (formatted) return formatted;
      throw error;
    }
  }});
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
 while omitting a provider-derived money specification.
  const declaredTool=Object.freeze({...guarded.tool,
    safety:spec.money ? '
    try { return shapeToolResult(await guarded.handler(args,ctx), {mode:ctx?.connection?.mode}); }
    catch (error) {
      const formatted=toStripeToolError(error,{
        mode:ctx?.connection?.mode, requiredPermission:spec?.requiredPermission
      });
      if (formatted) return formatted;
      throw error;
    }
  }});
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
 : 'P',
    moneySpec:spec.money ? 'provider-derived' : null});
  return Object.freeze({...guarded,tool:declaredTool, async handler(args,ctx) {
    try { return shapeToolResult(await guarded.handler(args,ctx), {mode:ctx?.connection?.mode}); }
    catch (error) {
      const formatted=toStripeToolError(error,{
        mode:ctx?.connection?.mode, requiredPermission:spec?.requiredPermission
      });
      if (formatted) return formatted;
      throw error;
    }
  }});
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
