import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {summarizeProvider} from '../../src/tools/summaries.js';
import {projectFields,readDetail,splitResult,resultPage} from '../../src/tools/result-rules.js';
import {publicToolInfo} from '../../src/core/profiles.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

describe('C-1 compact safe provider summaries and fields',()=>{
  it('includes only the important safe fields and preserves paging metadata',()=>{
    const obj={object:'customer',id:'cus_FAKE123',name:'Janet',email:'test@example.test',
      currency:'usd',balance:1000,balance_display:'$10.00',
      secret:'must-not-appear',other:'extra'};
    expect(summarizeProvider(obj)).toMatchObject({object:'customer',id:'cus_FAKE123',
      name:'Janet',balance_display:'$10.00'});
    expect(summarizeProvider(obj)).not.toHaveProperty('secret');
    expect(summarizeProvider({data:[obj],has_more:true,url:'/fake'}))
      .toMatchObject({has_more:true,data:[{id:'cus_FAKE123'}]});
    expect(readDetail(obj,{detail:'full'})).toHaveProperty('other');
    expect(readDetail(obj)).not.toHaveProperty('other');
    expect(readDetail(obj,{fields:'other'})).toEqual({other:'extra'});
    const list={data:[{id:'cus_A',name:'Ada',balance:100},
      {id:'cus_B',name:'Ben',balance:200}],has_more:false};
    expect(projectFields(list,'data.id,data.name')).toEqual({
      value:{data:[{id:'cus_A',name:'Ada'},{id:'cus_B',name:'Ben'}]},
      unknown:[]});
    expect(readDetail(list,{fields:'data.balance'})).toEqual({
      data:[{balance:100},{balance:200}]});
  });
  it('allows bounded dotted selection with explicit unknown notes; refuses prototype paths',()=>{
    const obj={customer:{name:'J',address:{city:'Greeley'}},id:'cus_FAKE123'};
    expect(projectFields(obj,'customer.name, customer.address.city')).toEqual({
      value:{customer:{name:'J',address:{city:'Greeley'}}},unknown:[]});
    expect(readDetail(obj,{fields:'id,customer.wrong'}))
      .toEqual({id:'cus_FAKE123',unavailableFields:['customer.wrong']});
    for(const invalid of ['__proto__.x','constructor.name','id,id',
      'a,'.repeat(20),'a.0','not allowed']){
      expect(()=>projectFields(obj,invalid)).toThrow();
    }
    expect(()=>readDetail(obj,{detail:'unfiltered'})).toThrow();
  });
  it('returns bounded byte chunks that reconstruct exact JSON including unicode',()=>{
    const obj={message:'💳'.repeat(2000),values:[1,2,3]};
    const {pages,totalBytes}=splitResult(obj);
    expect(pages.length).toBeGreaterThan(2);
    for(const text of pages)expect(Buffer.byteLength(text,'utf8')).toBeLessThanOrEqual(2500);
    expect(Buffer.byteLength(JSON.stringify(obj),'utf8')).toBe(totalBytes);
    const fragments=pages.map((_,i)=>resultPage({pages},i).fragment);
    expect(JSON.parse(fragments.join(''))).toEqual(obj);
    expect(resultPage({pages},0).nextPage).toBe(1);
    expect(()=>resultPage({pages},pages.length)).toThrow();
  });
  it('publishes consistent read annotations and safely conservative write hints',()=>{
    const read=publicToolInfo(registry.tools.find(x=>x.name==='stripe_whoami'));
    expect(read.annotations).toMatchObject({readOnlyHint:true,destructiveHint:false,
      idempotentHint:true,openWorldHint:true});
    expect(read.inputSchema.properties.detail.enum).toEqual(['summary','full']);
    expect(read.inputSchema.properties.fields.type).toBe('string');
    const write=publicToolInfo({name:'danger',writes:true,profiles:['full'],annotations:{},
      inputSchema:{type:'object',properties:{},additionalProperties:false}});
    expect(write.annotations).toMatchObject({readOnlyHint:false,destructiveHint:true,
      idempotentHint:false});
  });
});
describe('C-1 paged handles isolated to a verified OAuth connection',()=>{
  it('does not silently truncate, does not leak secrets and permits only same-scope retrieval across refresh',async()=>{
    const db=createFakeDb();
    const access='A'.repeat(40),refresh='B'.repeat(40);
    await db.createAccessToken({accessToken:access,refreshToken:refresh,
      clientId:'same-client',stripeAccount:'acct_FAKE',mode:'test',profile:'full'});
    const first=await db.getAccessToken(access);
    expect(first.result_scope).toMatch(/^[0-9a-f-]{36}$/);
    const connection={clientId:'same-client',stripeAccount:'acct_FAKE',
      mode:'test',profile:'full',resultScope:first.result_scope};
    const huge={customer:'cus_FAKE',rows:Array.from({length:220},(_,i)=>
      ({id:'item_'+i,notes:'verbose '.repeat(25)})),
      secret:'sk_test_FAKESECRET1234567'};
    const r={tools:[...registry.tools,{name:'stripe_fixture_big',
      writes:false,profiles:['read_only','everyday','full'],inputSchema:{type:'object',
        properties:{},additionalProperties:false}}],
      handlers:{...registry.handlers,stripe_fixture_big:async()=>({
        content:[{type:'text',text:JSON.stringify(huge)}]})}};
    const prepared=await dispatchReadOnlyTool({registry:r,name:'stripe_fixture_big',
      args:{detail:'full'},connection,db});
    expect(prepared.isError).not.toBe(true);
    expect(Buffer.byteLength(JSON.stringify(prepared),'utf8')).toBeLessThanOrEqual(8192);
    const preview=JSON.parse(prepared.content[0].text);
    expect(preview.handle).toMatch(/^res_/);
    expect(preview.pageCount).toBeGreaterThan(1);
    expect(JSON.stringify(prepared)).not.toContain('FAKESECRET');
    const saved=await dispatchReadOnlyTool({registry,name:'stripe_get_result',
      args:{handle:preview.handle,page:1},connection,db});
    expect(saved.isError).not.toBe(true);
    const unauthorized=await dispatchReadOnlyTool({registry,name:'stripe_get_result',
      args:{handle:preview.handle},connection:{...connection,resultScope:randomUUID()},db});
    expect(unauthorized.isError).toBe(true);
    await db.rotateRefreshToken({refreshToken:refresh,clientId:'same-client',
      accessToken:'C'.repeat(40),newRefreshToken:'D'.repeat(40)});
    expect((await db.getAccessToken('C'.repeat(40))).result_scope).toBe(first.result_scope);
    const pieces=[];
    for(let page=0;page<preview.pageCount;page++){
      const a=await dispatchReadOnlyTool({registry,name:'stripe_get_result',
        args:{handle:preview.handle,page},connection,db});
      pieces.push(JSON.parse(a.content[0].text).fragment);
    }
    const restored=JSON.parse(pieces.join(''));
    expect(JSON.stringify(restored)).not.toContain('FAKESECRET');
    expect(restored.secret).toBe('[hidden]');
    expect(restored.rows.at(-1).id).toBe('item_219');
    const projection=await dispatchReadOnlyTool({registry,name:'stripe_get_result',
      args:{handle:preview.handle,fields:'customer,missingField'},connection,db});
    const projected=JSON.parse(projection.content[0].text);
    expect(projected.unavailableFields).toEqual(['missingField']);
  });
});
