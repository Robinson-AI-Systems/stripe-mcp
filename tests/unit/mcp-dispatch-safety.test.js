import {describe,it,expect} from 'vitest';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {publicToolInfo} from '../../src/core/profiles.js';
import {tools as devTools,handlers as devHandlers} from '../../src/tools/dev-seed.js';
import {overlayDispatch} from '../../scripts/k3-dispatch-overlay.mjs';
import {createStripeCoreDispatcher} from '../../src/core/k3-dispatch-seams.js';
import {readFileSync,existsSync} from 'node:fs';
const conn={stripeAccount:'acct_TESTK3',mode:'test',profile:'full',
  listing:'catalog',resultScope:'k3-scope'};
const error=r=>r?.isError===true;
describe('original MCP source dispatch + portable adapter safety',()=>{
  it('denies inherited handler names and request/metadata getters without invoking them',async()=>{
    let getters=0,calls=0;
    const inherited=await dispatchReadOnlyTool({registry:{tools:[{
      name:'constructor',writes:false,profiles:['full']}],handlers:{}},
      name:'constructor',args:{},connection:conn,db:{}});
    expect(error(inherited)).toBe(true);
    const t={writes:false,profiles:['full']};
    Object.defineProperty(t,'name',{enumerable:true,get(){getters++;return 'stripe_read';}});
    const args={};
    Object.defineProperty(args,'detail',{enumerable:true,get(){getters++;return 'full';}});
    const out=await dispatchReadOnlyTool({registry:{tools:[
      t,{name:'stripe_read',writes:false,profiles:['full']}],
      handlers:{stripe_read:async()=>{calls++;return {content:[{type:'text',text:'{}'}]};}}},
      name:'stripe_read',args,connection:conn,db:{}});
    expect(error(out)).toBe(true);
    expect([getters,calls]).toEqual([0,0]);
  });
  it('freezes selected account before asynchronous service execution',async()=>{
    const mutable={...conn};
    const registry={tools:[{name:'stripe_read',writes:false,profiles:['full']}],
      handlers:{stripe_read:async(_args,ctx)=>{
        await Promise.resolve();
        return {content:[{type:'text',text:JSON.stringify({
          account:ctx.connection.stripeAccount})}]};
      }}};
    const task=dispatchReadOnlyTool({registry,name:'stripe_read',args:{},
      connection:mutable,db:{}});
    mutable.stripeAccount='acct_FORGED';
    expect(JSON.parse((await task).content[0].text).account).toBe('acct_TESTK3');
  });
  it('never invokes write handlers through nested runRead',async()=>{
    let writes=0;
    const registry={tools:[
      {name:'stripe_read',writes:false,profiles:['full']},
      {name:'stripe_write',writes:true,profiles:['full'],
        area:'payments',writeContract:'defineWrite-v1'}],
    handlers:{
      stripe_read:async(_a,ctx)=>ctx.runRead('stripe_write',{confirm:true}),
      stripe_write:async()=>{writes++;return {content:[{type:'text',text:'{}'}]};}
    }};
    const out=await dispatchReadOnlyTool({registry,name:'stripe_read',
      args:{},connection:conn,db:{}});
    expect(error(out)).toBe(true);
    expect(writes).toBe(0);
  });
  it('portable dispatcher forwards only persisted owner LIVE write consent to original handler',async()=>{
    let called=0;
    const tool={name:'api_write',area:'universal',writes:true,profiles:['full'],
      writeContract:'defineWrite-v1'};
    const registry={tools:[tool],handlers:{api_write:async(_args,ctx)=>{
      called++;
      return {content:[{type:'text',text:JSON.stringify({
        liveAccessGranted:ctx.liveAccessGranted})}]};
    }}};
    const core={createGuardedMcpDispatcher:({registry:copy,authorizeTool})=>({
      dispatch:async({name,args,connection,db,services})=>{
        const selected=copy.tools.find(t=>t.name===name);
        if(!await authorizeTool(selected,connection))return {isError:true};
        return copy.handlers[name](args,{connection,db,services});
      }})};
    const dispatch=createStripeCoreDispatcher({core,registry,
      sourceDispatch:async()=>{throw Error('Unexpected nested path');}});
    const entitled={...conn,mode:'live',rtcLiveOwnerApproved:true,
      moneyLimitCents:0};
    const granted=await dispatch({name:'api_write',args:{},
      connection:entitled,db:{},services:{}});
    expect(JSON.parse(granted.content[0].text)).toEqual({
      liveAccessGranted:true});
    expect(called).toBe(1);
    const denied=await dispatch({name:'api_write',args:{},
      connection:{...entitled,rtcLiveOwnerApproved:false},
      db:{},services:{}});
    expect(denied.isError).toBe(true);
    expect(called).toBe(1);
    const readOnly=await dispatch({name:'api_write',args:{},
      connection:{...entitled,profile:'read_only'},
      db:{},services:{}});
    expect(readOnly.isError).toBe(true);
    expect(called).toBe(1);
  });
  it('preserves original MCP SDK transport while temporarily swapping dispatch',()=>{
    const pristine=new URL('../../src/core/k3-mcp-original-private.js',import.meta.url);
    const code=readFileSync(existsSync(pristine)?pristine:
      new URL('../../src/core/mcp-server.js',import.meta.url),'utf8');
    expect(overlayDispatch(code)).toContain("robinson-mcp-core/mcp-dispatch");
    expect(overlayDispatch(code)).toContain('createMcpHandler');
    expect(()=>overlayDispatch('unrelated')).toThrow();
  });
});

describe('public read presentation controls work through real strict native handlers',()=>{
  const tool=devTools.find(x=>x.name==='dev_list_runs');
  function fixture(){
    const calls=[];
    const db={listDevRuns:async args=>{
      calls.push(args);
      return [{id:'run_'+'b'.repeat(24),scenario:'event-product-updated',
        size:1,status:'completed',object_count:2,
        created_at:'2026-10-14T05:00:00Z',completed_at:'2026-10-14T05:01:00Z'}];
    }};
    const registry={tools:[tool],handlers:{dev_list_runs:devHandlers.dev_list_runs}};
    return {calls,db,registry};
  }
  it('advertises and honors full and dotted selection without leaking options to dev_list_runs',async()=>{
    const f=fixture();
    expect(publicToolInfo(tool).inputSchema.properties)
      .toHaveProperty('detail');
    expect(publicToolInfo(tool).inputSchema.properties)
      .toHaveProperty('fields');
    const result=await dispatchReadOnlyTool({
      registry:f.registry,name:'dev_list_runs',
      args:{limit:3,offset:0,detail:'full',fields:'runs.id,hasMore'},
      connection:conn,db:f.db});
    expect(result.isError).not.toBe(true);
    const value=JSON.parse(result.content[0].text);
    expect(value).toMatchObject({runs:[{id:'run_'+'b'.repeat(24)}],
      hasMore:false});
    expect(value.runs[0].scenario).toBeUndefined();
    expect(f.calls).toEqual([{account:conn.stripeAccount,limit:3,offset:0}]);
  });
  it('rejects malformed generic selectors and still denies unknown business arguments',async()=>{
    for(const args of [
      {limit:1,detail:'compact'},
      {limit:1,fields:'__proto__.value'},
      {limit:1,fields:'runs.id,runs.id'},
      {limit:1,detail:'full',unknownBusinessArgument:true}
    ]){
      const f=fixture();
      const result=await dispatchReadOnlyTool({
        registry:f.registry,name:'dev_list_runs',args,connection:conn,db:f.db});
      expect(result.isError,args).toBe(true);
      expect(f.calls,args).toHaveLength(0);
    }
  });
  it('preserves handlers with native fields arrays and native detail enums',async()=>{
    let received=null;
    const native={name:'native_read',writes:false,profiles:['full'],
      inputSchema:{type:'object',properties:{
        detail:{type:'string',enum:['full','compact']},
        fields:{type:'array',items:{type:'string'}}
      },additionalProperties:false}};
    const registry={tools:[native],handlers:{native_read:async args=>{
      received=args;
      return {content:[{type:'text',text:JSON.stringify({id:'original'})}]};
    }}};
    const result=await dispatchReadOnlyTool({registry,name:'native_read',
      args:{fields:['id'],detail:'full'},connection:conn,db:{}});
    expect(result.isError).not.toBe(true);
    expect(received).toEqual({fields:['id'],detail:'full'});
  });
});
