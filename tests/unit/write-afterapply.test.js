import {describe,it,expect,vi} from 'vitest';
import {defineWrite} from '../../src/tools/write.js';
const account='acct_POSTSAFE123';
const connection={stripeAccount:account,mode:'test',profile:'full'};
const result=ret=>JSON.parse(ret.content[0].text);
describe('X-1 and E-4 guarded non-money post-verification hooks',()=>{
  it('does not invoke afterApply on preview, but invokes it exactly once after verified provider readback',async()=>{
    const afterApply=vi.fn(async()=>{}),provider=vi.fn(async()=>{});
    let state={id:'prod_POSTSAFE123',object:'product',active:true,
      metadata:{},livemode:false};
    const logs=[];
    const ctx={connection,connectionId:'post-guard',db:{
      recordChange:async x=>{logs.push(x);return logs.length;}},
      services:{}};
    const op=defineWrite({
      name:'test_post_verify',
      read:async()=>state,
      summarize:()=> 'exact native object',
      apply:async()=>{await provider();state={...state,active:false};},
      readAfter:async()=>state,
      verify:(_before,after)=>after.active===false,
      afterApply,
      inverse:()=>null,
      resultId:null
    });
    expect(result(await op.handler({dryRun:true},ctx)).done).toBe(false);
    expect(afterApply).not.toHaveBeenCalled();
    const done=result(await op.handler({confirm:true,requestKey:'post-123'},ctx));
    expect(done.done).toBe(true);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(afterApply).toHaveBeenCalledTimes(1);
    expect(afterApply.mock.calls[0][0].status).toBe('confirmed');
    expect(logs.at(-1).dryRun).toBe(false);
  });
  it('fails closed if a verified provider write cannot complete its SQL posthook',async()=>{
    let writes=0;
    const op=defineWrite({name:'test_hook_refusal',read:async()=>({id:'prod_SAFE'}),
      summarize:()=> 'safe mutation',apply:async()=>{writes++;},
      readAfter:async()=>({id:'prod_SAFE'}),verify:()=>true,
      afterApply:async()=>{throw new TypeError('Lost original SQL journal');}});
    const db={recordChange:async()=>1};
    const reply=await op.handler({confirm:true,requestKey:'lost-audit'},
      {db,connection,connectionId:'post-guard'});
    expect(reply.isError).toBe(true);
    expect(result(reply).done).toBe(false);
    expect(writes).toBe(1);
  });
});
