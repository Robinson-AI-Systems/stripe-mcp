import {describe,it,expect,vi} from 'vitest';
import {inventory,collect,assertTestWhoami,report} from '../../scripts/smoke-readonly.mjs';
import {registry} from '../../src/tools/index.js';
const resp=(v,isError=false)=>({isError,content:[{type:'text',text:JSON.stringify(v)}]});
const account='acct_FIXTURE123';
describe('X-2 authentic and read-only whole registry smoke',()=>{
  it('classifies every registered read exactly once and never mistakes write-capable tools for reads',()=>{
    const reads=inventory();
    expect(reads.length).toBeGreaterThan(50);
    expect(reads.every(x=>x.writes===false)).toBe(true);
    expect(reads.map(x=>x.name)).toContain('tax_get_settings');
    expect(reads.map(x=>x.name)).toContain('quote_get_pdf_link');
    expect(reads.map(x=>x.name)).not.toContain('quote_accept');
    expect(reads.map(x=>x.name)).not.toContain('stripe_undo_change');
    expect(reads.map(x=>x.name)).not.toContain('meter_record_usage');
    console.log('X2_SMOKE_INVENTORY_START\n'+reads.map(x=>x.name).join('\n')+
      '\nX2_SMOKE_INVENTORY_END');
    expect(reads.length+registry.tools.filter(x=>x.writes===true).length)
      .toBe(registry.tools.length);
  });
  it('refuses LIVE or unverifiable whoami before every other call',async()=>{
    const tools=[{name:'stripe_whoami',writes:false,profiles:['read_only'],inputSchema:{
      type:'object',properties:{}}},{name:'the_secret',writes:false,
      profiles:['read_only'],inputSchema:{type:'object',properties:{}}}];
    const call=vi.fn(async _name=>resp({account,mode:'live',liveEnabled:true}));
    await expect(collect({tools,call})).rejects.toThrow(/TEST-only smoke refused/);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0]).toBe('stripe_whoami');
    expect(()=>assertTestWhoami(resp({account,mode:'test',liveEnabled:false})))
      .not.toThrow();
    expect(()=>assertTestWhoami(resp({account,mode:'live'})))
      .toThrow(/refused/);
    expect(()=>assertTestWhoami(resp({mode:'test'})))
      .toThrow(/refused/);
  });
  it('emits PASS only for a real test caller, and GAP for missing fixtures and denied calls',async()=>{
    const tools=[
      {name:'stripe_whoami',writes:false,profiles:['read_only'],inputSchema:{
        type:'object',properties:{}}},
      {name:'read_exact',writes:false,profiles:['read_only'],inputSchema:{
        type:'object',properties:{customerId:{type:'string'}},required:['customerId']}},
      {name:'read_other',writes:false,profiles:['read_only'],inputSchema:{
        type:'object',properties:{}}},
      {name:'danger',writes:true,profiles:['full'],inputSchema:{type:'object'}}
    ];
    const call=vi.fn(async name=>name==='read_other'?
      resp({done:false,error:'Denied'},true):resp({account,mode:'test',liveEnabled:false}));
    const out=await collect({tools,call,fixtures:{},origin:'https://test.invalid'});
    expect(out.reads).toBe(3);
    expect(out.rows.map(x=>[x.name,x.result])).toEqual([
      ['stripe_whoami','PASS'],['read_exact','GAP'],['read_other','GAP']]);
    expect(call).not.toHaveBeenCalledWith('read_exact',expect.anything());
    expect(call).not.toHaveBeenCalledWith('danger',expect.anything());
    const audit=report(out);
    expect(audit).toMatch(/read_exact/);
    expect(audit).not.toMatch(/real Stripe account credentials/);
  });
  it('inventory-only is an explicit non-provider GAP for every read',async()=>{
    const result=await collect({inventoryOnly:true});
    expect(result.rows).toHaveLength(inventory().length);
    expect(result.rows.every(x=>x.result==='GAP')).toBe(true);
    expect(report(result)).toContain('Not invoked: no verified authenticated TEST transport');
  });
});
