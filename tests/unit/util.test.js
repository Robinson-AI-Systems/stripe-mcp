import {describe,expect,it} from 'vitest';
import {compact,displayCurrencyMinor,denverLocalTime,shapeToolResult} from
  '../../src/tools/util.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {defineWrite} from '../../src/tools/write.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const resultText=result=>JSON.parse(result.content[0].text);
describe('B-5 compact presentation with privacy and currency safety',()=>{
  it('adds USD displays without changing integer cents',()=>{
    const data={currency:'usd',amount:12345,amount_refunded:300,
      unit_amount:1999,total:12345,fee:300};
    const x=compact(data);
    expect(x).toMatchObject({amount:12345,amount_display:'$123.45',
      amount_refunded_display:'$3.00',unit_amount_display:'$19.99',
      total_display:'$123.45',fee_display:'$3.00'});
    expect(data.amount_display).toBeUndefined();
  });
  it('uses zero decimal units for JPY and supports nested currency overrides',()=>{
    const x=compact({currency:'usd',amount:100,lines:[{currency:'jpy',amount:1200},
      {amount:250}]});
    expect(x.amount_display).toBe('$1.00');
    expect(x.lines[0].amount_display).toContain('¥1,200');
    expect(x.lines[1].amount_display).toBe('$2.50');
    expect(displayCurrencyMinor(100,'eur')).toContain('1.00');
  });
  it('does not guess money conversion for missing or invalid currencies and amounts',()=>{
    expect(compact({amount:1234}).amount_display).toBeUndefined();
    expect(compact({currency:'usd',amount:1.9}).amount_display).toBeUndefined();
    expect(displayCurrencyMinor(Number.MAX_SAFE_INTEGER+1,'usd')).toBeNull();
    expect(displayCurrencyMinor(100,'invalid')).toBeNull();
  });
  it('shows Denver time across daylight-saving transition',()=>{
    const before=Math.floor(Date.parse('2026-11-01T07:30:00Z')/1000);
    const after=Math.floor(Date.parse('2026-11-01T08:30:00Z')/1000);
    const shaped=compact({created:before,trial_end:after});
    expect(shaped.created_local).toContain('MDT');
    expect(shaped.trial_end_local).toContain('MST');
    expect(denverLocalTime(-1)).toBeNull();
  });
  it('redacts nested secret names, camelCase variants and key-shaped strings',()=>{
    const raw={currency:'usd',client_secret:'pi_test_secret_123',
      auth:{accessToken:'top_secret',Authorization:'Bearer abcdefghijklmnopqrstuvwxyz',
        password:'mypassword',other:'sk_live_SHOULDNOTLEAK123'},
      results:[{webhookSecret:'whsec_SHOULDNOTLEAK123',customer:'cus_regular'},
        {note:'Safe text rk_test_DONTLEAK123456'}]};
    const x=compact(raw);
    expect(x.client_secret).toBe('[hidden]');
    expect(x.auth.accessToken).toBe('[hidden]');
    expect(x.auth.Authorization).toBe('[hidden]');
    expect(x.auth.other).toBe('[hidden]');
    expect(x.results[0].webhookSecret).toBe('[hidden]');
    expect(JSON.stringify(x)).not.toMatch(/SHOULDNOTLEAK|DONTLEAK|mypassword|top_secret/);
    expect(x.results[0].customer).toBe('cus_regular');
  });
  it('preserves original companion keys and does not silently truncate data',()=>{
    const data={currency:'usd',amount:25,amount_display:'Owner supplied',created:1760000000,
      nested:[{id:'item_1',currency:'usd',amount:49},{id:'item_2',currency:'usd',amount:98}]};
    const x=compact(data);
    expect(x.amount_display).toBe('Owner supplied');
    expect(x.nested).toHaveLength(2);
    expect(x.nested[1].amount_display).toBe('$0.98');
  });
  it('preserves tool output metadata and adds an explicit LIVE banner',()=>{
    const input={isError:true,content:[{type:'text',text:JSON.stringify({
      mode:'test',currency:'jpy',amount:2500,client_secret:'hide'
    })},{type:'image',data:'untouched'}]};
    const result=shapeToolResult(input,{mode:'LIVE'});
    expect(result.isError).toBe(true);
    expect(result.content[1]).toEqual(input.content[1]);
    expect(resultText(result)).toMatchObject({mode:'LIVE',amount_display:'¥2,500',
      client_secret:'[hidden]'});
  });
  it('sanitizes plain-text credential strings without corrupting ordinary text',()=>{
    const r=shapeToolResult({content:[{type:'text',text:'Connected sk_test_SENSITIVE123456'}]});
    expect(r.content[0].text).toBe('Connected [hidden]');
  });
  it('refuses cycles instead of claiming a complete yet truncated result',()=>{
    const x={a:1};x.self=x;
    expect(()=>compact(x)).toThrow(/Circular provider result/);
  });
  it('shapes actual read-only MCP responses at the shared boundary',async()=>{
    const registry={tools:[{name:'stripe_fake_result',writes:false,profiles:['read_only']}],
      handlers:{stripe_fake_result:async()=>({content:[{type:'text',text:JSON.stringify({
        currency:'usd',amount:1210,created:1793518200,secret:'hidden_value'
      })}]})}};
    const response=await dispatchReadOnlyTool({registry,name:'stripe_fake_result',
      connection:{stripeAccount:'acct_1',mode:'test',profile:'read_only'},db:{}});
    expect(resultText(response).amount_display).toBe('$12.10');
    expect(resultText(response).secret).toBe('[hidden]');
  });
  it('shapes internal write output without weakening the confirmation guard',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_1',label:'Fake'}]});
    const op=defineWrite({name:'stripe_fake_b5_format',
      read:async()=>({currency:'usd',amount:100}),
      summarize:async()=> 'Update fake Stripe record.',
      apply:async()=>{throw Error('Unexpected write');},
      readAfter:async()=>({}),verify:async()=>true
    });
    const ctx={db,connection:{stripeAccount:'acct_1',mode:'test',profile:'full'}};
    const res=await op.handler({dryRun:true},ctx);
    expect(resultText(res)).toMatchObject({done:false,mode:'test'});
  });
});
