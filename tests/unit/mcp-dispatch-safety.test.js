import {describe,it,expect} from 'vitest';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {overlayDispatch} from '../../scripts/k3-dispatch-overlay.mjs';
import {readFileSync} from 'node:fs';
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
  it('preserves original MCP SDK transport while temporarily swapping dispatch',()=>{
    const code=readFileSync(new URL('../../src/core/mcp-server.js',import.meta.url),'utf8');
    expect(overlayDispatch(code)).toContain("robinson-mcp-core/mcp-dispatch");
    expect(overlayDispatch(code)).toContain('createMcpHandler');
    expect(()=>overlayDispatch('unrelated')).toThrow();
  });
});
