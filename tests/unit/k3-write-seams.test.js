import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createStripeCoreWriteAdapter} from '../../src/core/k3-write-seams.js';
import {createPrivateStripeWriteOverlay} from '../../scripts/k3-write-overlay.mjs';
describe('K-3 authentic Stripe write adapter / independent owner grants',()=>{
  const copy=new URL('../../src/core/k3-write-original-private.js',import.meta.url);
  const source=readFileSync(existsSync(copy)?copy:
    new URL('../../src/core/write.js',import.meta.url),'utf8');
  it('allows only reviewed generic package seam and detects source drift',()=>{
    expect(createPrivateStripeWriteOverlay(source)).toContain('robinson-mcp-core/write');
    expect(()=>createPrivateStripeWriteOverlay('not the original')).toThrow();
  });
  it('requires Stripe retry identity, ownership check and LIVE guard',()=>{
    expect(()=>createStripeCoreWriteAdapter({core:{}})).toThrow();
    let captured;
    const stage=createStripeCoreWriteAdapter({core:{defineWrite:opts=>{
      captured=opts;return {handler(){},tool:{writes:true}};}}});
    for(const s of [{},{idempotency(){},modeGuard(){}},
      {idempotency(){},modeGuard(){},targetGuard(){},prepare(){}}]){
      expect(()=>stage.defineWrite(s)).toThrow();
    }
    stage.defineWrite({idempotency(){},modeGuard(){},targetGuard(){}});
    expect(captured.idempotencyPrefix).toBe('rmcp_');
    expect(captured.accountOf({stripeAccount:'acct_Real_SOURCE'})).toBe('acct_Real_SOURCE');
    expect(captured.accountOf({})).toBeUndefined();
  });
  it('refuses money contract with no independent reservation or settlement',()=>{
    const stage=createStripeCoreWriteAdapter({core:{defineWrite:opts=>opts}});
    const hooks={idempotency(){},modeGuard(){},targetGuard(){},prepare(){}};
    expect(()=>stage.defineWrite({...hooks,beforeApply(){}})).toThrow();
    const safe=stage.defineWrite({...hooks,beforeApply(){},afterApply(){}});
    expect(typeof safe.beforeApply).toBe('function');
    expect(typeof safe.afterApply).toBe('function');
  });
});
