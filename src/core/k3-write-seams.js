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
      const bind=prepare=>core.defineWrite({...spec,
        prepare,
        // Stripe's original source idempotencyKey uses "rmcp_" including
        // account, tool and stable request key; preserve that exact prefix.
        idempotencyPrefix:'rmcp_',
        // Only the transport/service-chosen connection may bind the account.
        accountOf:connection=>connection?.stripeAccount
      });
      const declaration=bind(spec.prepare);
      return Object.freeze({...declaration,async handler(args,ctx){
        // Portable core returns generic errors for thrown preview failures.
        // Stripe's original API deliberately exposes a TypeError for its
        // own deterministic invalid-USD input contract. Keep the exception
        // only for this safe local validator, not provider/DB exceptions.
        // Per-invocation capture avoids authorization races between requests.
        let sourceMoneyError=null;
        const prepare=spec.prepare?async(...params)=>{
          try{return await spec.prepare(...params);}
          catch(e){
            if(e instanceof TypeError &&
              /^Verified USD money amount and short safe description required/.test(e.message))
              sourceMoneyError=e;
            throw e;
          }
        }:null;
        const invocation=bind(prepare);
        const result=await invocation.handler(args,ctx);
        if(sourceMoneyError)throw sourceMoneyError;
        return result;
      }});

    }
  });
}
