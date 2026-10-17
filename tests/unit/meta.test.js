import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {listingForConnection,publicToolInfo} from '../../src/core/profiles.js';
import {evaluateBudgets,verifyDefaultFixture} from '../../scripts/check-budgets.mjs';
const connection={stripeAccount:'acct_TEST123',mode:'test',profile:'read_only',
  listing:'compact',clientId:'agent',resultScope:'11111111-1111-4111-8111-111111111111'};
const call=(name,args={},r=registry,c=connection)=>dispatchReadOnlyTool({
  registry:r,name,args,connection:c,db:{async listStripeAccounts(){return [];}},
  services:{}});
const parse=r=>JSON.parse(r.content[0].text);
describe('C-2 progressive tool disclosure and wrapped execution',()=>{
  it('lists compact baseline plus authorized workflow readers but retains the catalog',()=>{
    const compact=listingForConnection(registry,connection).map(t=>t.name);
    expect(compact).toEqual(['stripe_whoami','stripe_get_result',
      'stripe_search_tools','stripe_describe_tool','stripe_call','stripe_batch','workflow_app_readiness',
      'workflow_money_snapshot','workflow_failed_payments','workflow_customer_overview',
      'workflow_dispute_kit','workflow_webhook_health','workflow_go_live_checklist',
      'workflow_month_end_close','workflow_find','api_search']);
    expect(listingForConnection(registry,{...connection,listing:'catalog'}).length)
      .toBe(registry.tools.filter(t=>t.writes===false&&
        t.profiles.includes('read_only')).length);
    expect(listingForConnection(registry,connection,'catalog')).toHaveLength(129);
    expect(listingForConnection(registry,connection,'read_only')).toHaveLength(16);
  });
  it('searches, describes, delegates and batches through the same read-only gate',async()=>{
    const search=parse(await call('stripe_search_tools',{query:'accounts'}));
    expect(search.matches.map(t=>t.name)).toContain('stripe_list_accounts');
    const described=parse(await call('stripe_describe_tool',{name:'stripe_list_accounts'}));
    expect(described.safety).toBe('READ ONLY');
    expect(described.inputSchema.properties.detail.enum).toEqual(['summary','full']);
    const via=parse(await call('stripe_call',{name:'stripe_list_accounts',args:{}}));
    expect(via).toMatchObject({accounts:[],hasMore:false,nextOffset:null});
    const batch=parse(await call('stripe_batch',{calls:[
      {name:'stripe_list_accounts',args:{}},
      {name:'stripe_list_accounts',args:{}}
    ]}));
    expect(batch.count).toBe(2);
    expect(batch.results.every(x=>!x.result.isError)).toBe(true);
  });
  it('rejects guessed hidden tools, direct writes, nested meta calls and mixed write batches',async()=>{
    let touched=0;
    const fake={tools:[...registry.tools,{name:'owner_delete',writes:true,
      profiles:['full'],inputSchema:{type:'object',properties:{}}}],
      handlers:{...registry.handlers,owner_delete:async()=>{touched++;return {content:[]};}}};
    for(const [name,args] of [
      ['stripe_call',{name:'owner_delete',args:{confirm:true}}],
      ['stripe_call',{name:'stripe_call',args:{name:'stripe_list_accounts'}}],
      ['stripe_batch',{calls:[{name:'stripe_list_accounts'},{name:'owner_delete'}]}],
      ['stripe_batch',{calls:Array.from({length:11},()=>({name:'stripe_list_accounts'}))}],
      ['stripe_describe_tool',{name:'owner_delete'}]
    ]){
      expect((await call(name,args,fake,{...connection,profile:'full'})).isError)
        .toBe(true);
    }
    expect(touched).toBe(0);
    const hidden={...connection,profile:'not_a_profile'};
    expect((await call('stripe_call',{name:'stripe_list_accounts'},fake,hidden))
      .isError).toBe(true);
    const write=await call('owner_delete',{confirm:true},fake,{...connection,profile:'full'});
    expect(write.isError).toBe(true);
    expect(touched).toBe(0);
  });

  it('delegates an original LIVE write to the guarded dispatcher but never read-only or deep batch calls',async()=>{
    const {vi}=await import('vitest');
    vi.stubEnv('VERCEL_ENV','production');
    try{
      const {defineWrite}=await import('../../src/tools/write.js');
      let writes=0;
      const original=defineWrite({name:'live_safe_write',
        read:async()=>({id:'safe_123',livemode:true}),
        summarize:async()=> 'Owner-selected LIVE resource metadata update.',
        apply:async()=>{writes++;},
        readAfter:async()=>({id:'safe_123',livemode:true,updated:true}),
        verify:async(_b,after)=>after.updated===true});
      const fake={tools:[...registry.tools,{...original.tool,area:'payments',
        profiles:['full']}],handlers:{...registry.handlers,
        live_safe_write:original.handler}};
      const db={recordChange:async()=>1,
        getStripeAccount:async id=>({id,live_enabled:true,live_connected:true})};
      const c={...connection,mode:'live',profile:'full',rtcLiveOwnerApproved:true,
        moneyLimitCents:0};
      const invoke=(name,args,curr=c)=>dispatchReadOnlyTool({
        registry:fake,name,args,connection:curr,db,services:{}});
      const discovered=parse(await invoke('stripe_search_tools',{query:'live_safe_write'}));
      expect(discovered.matches.some(t=>t.name==='live_safe_write'&&
        t.safety==='GUARDED LIVE WRITE')).toBe(true);
      const preview=parse(await invoke('stripe_call',
        {name:'live_safe_write',args:{}}));
      expect(preview).toMatchObject({mode:'LIVE',done:false,needsConfirmation:true});
      expect(writes).toBe(0);
      const complete=parse(await invoke('stripe_call',{name:'live_safe_write',
        args:{confirm:true,requestKey:'isolated-confirmed-live'}}));
      expect(complete).toMatchObject({mode:'LIVE',done:true,confirmed:true});
      expect(writes).toBe(1);
      expect((await invoke('stripe_batch',{calls:[{name:'live_safe_write'}]})).isError).toBe(true);
      expect((await invoke('stripe_call',{name:'live_safe_write',
        args:{confirm:true,requestKey:'not-authorized'}},
        {...c,rtcLiveOwnerApproved:false})).isError).toBe(true);
      expect(writes).toBe(1);
    }finally{vi.unstubAllEnvs();}
  });
  it('enforces exact budget thresholds with a pinned tokenizer, not string length approximations',async()=>{
    const budget=evaluateBudgets();
    expect(budget.failures).toEqual([]);
    expect(budget.counts.compact).toBeLessThan(5000);
    const bad={tools:[{name:'oversized',description:'x'.repeat(161),
      writes:false,profiles:['everyday'],inputSchema:{type:'object'}}]};
    expect(evaluateBudgets(bad).failures.join(' ')).toMatch(/description >160/);
    expect((await verifyDefaultFixture()).ok).toBe(true);
    const advertised=registry.tools.map(publicToolInfo);
    expect(advertised.every(t=>(t.description||'').length<=160)).toBe(true);
  });
});