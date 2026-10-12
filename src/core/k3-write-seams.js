// K-3 Stripe-owned money/write seam; private core injected ONLY during CI.
// Runtime original src/core/write.js and src/tools/write.js stay standalone.
// The service retains idempotency, owner approvals, daily caps, app and LIVE guards.
export function createStripeCoreWriteAdapter({core}){
  if(typeof core?.defineWrite!=='function')
    throw new TypeError('Reviewed core guarded write implementation required');
  return Object.freeze({
    defineWrite(spec){
      if(!spec||typeof spec!=='object'||Array.isArray(spec)||
        typeof spec.idempotency!=='function'||
        typeof spec.modeGuard!=='function'||
        typeof spec.targetGuard!=='function')
        throw new TypeError('Stripe service-owned retry, LIVE and app guards are mandatory');
      if(spec.prepare && (typeof spec.beforeApply!=='function'||
        typeof spec.afterApply!=='function'))
        throw new TypeError('Stripe independent owner money reservation/settlement is mandatory');
      return core.defineWrite({...spec,
        // Stripe's original source idempotencyKey uses "rmcp_" including
        // account, tool and stable request key; preserve that exact prefix.
        idempotencyPrefix:'rmcp_',
        // Only the transport/service-chosen connection may bind the account.
        accountOf:connection=>connection?.stripeAccount
      });
    }
  });
}
