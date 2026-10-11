import {describe,it,expect,vi} from 'vitest';
import {makeDisputeAccept,tools,handlers} from '../../src/tools/dispute-accept.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {idempotencyKey} from '../../src/stripe/client.js';
import {prepareMoney} from '../../src/money.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='du_TEST1234',charge='ch_TEST1234',account='acct_TEST1234';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({amount=8500,limit=50000,record={},chargeMetadata={},uncertain=false}={}){
  let dispute={id,object:'dispute',status:'needs_response',livemode:false,
    amount,currency:'usd',charge,metadata:{},...record};
  const provider={disputes:{
    retrieve:vi.fn(async()=>structuredClone(dispute)),
    close:vi.fn(async()=>{if(!uncertain)dispute={...dispute,status:'lost'};
      return structuredClone(dispute);})},
    charges:{retrieve:vi.fn(async()=>({id:charge,object:'charge',
      amount:10000,currency:'usd',livemode:false,customer:null,
      metadata:chargeMetadata}))},
    customers:{retrieve:vi.fn(async()=>({id:'cus_TEST1234',object:'customer',metadata:{}}))}};
  const db=createFakeDb({accounts:[{id:account,money_limit_cents:limit}]});
  const ctx={db,connectionId:'acceptance-client',
    connection:{stripeAccount:account,mode:'test',profile:'everyday',
      resultScope:'authenticated-scope'},
    services:{stripeForConnection:async()=>provider}};
  const call=a=>makeDisputeAccept().handler(a,ctx);
  return {provider,db,ctx,call};
}
async function grant(f,args){
  const key=idempotencyKey(f.ctx.connection,'dispute_accept',args);
  expect(await f.db.approveMoneyRequest({account,idempotencyKey:key})).toBe(true);
  return key;
}
describe('G-2d2 dispute acceptance seven-case money-out actual-handler contract',()=>{
  it('declares one USD money write, with protected selected dispute target',()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({name:'dispute_accept',safety:'$',writes:true,
      profiles:['everyday','full'],moneySpec:'provider-derived'});
    expect(registry.tools.filter(t=>t.name==='dispute_accept')).toHaveLength(1);
    expect(prepareMoney({amountCents:8500,currency:'usd',direction:'out',targetId:id,
      description:'Test dispute acceptance'}).previewLine).toContain('$85.00');
    expect(()=>prepareMoney({amountCents:8500,currency:'usd',direction:'out',
      targetId:'du_?',description:'Invalid'})).toThrow();
  });
  it('1/2 dryRun and confirm alone never authorize close or reserve money',async()=>{
    const f=fixture(),args={disputeId:id,requestKey:'one'};
    const preview=parse(await f.call({...args,dryRun:true,confirm:true}));
    expect(preview.preview).toContain('$85.00');
    expect(preview.preview).toContain('IRREVERSIBLY');
    expect(preview.needsConfirmation).toBe(false);
    const missing=parse(await f.call(args));
    expect(missing.needsConfirmation).toBe(true);
    const unapproved=parse(await f.call({...args,confirm:true}));
    expect(unapproved.done).toBe(false);
    expect(unapproved.error).toMatch(/explicit approval is required/);
    expect(f.provider.disputes.close).not.toHaveBeenCalled();
    expect((await f.db.getMoneyUsage({account,connection:f.ctx.connectionId})).used_cents).toBe(0);
  });
  it('3 owner grant confirms one close with provider-derived disputed cents, not charge amount',async()=>{
    const f=fixture(),args={disputeId:id,confirm:true,requestKey:'confirmed'};
    parse(await f.call(args));
    const key=await grant(f,args);
    const confirmed=parse(await f.call(args));
    expect(confirmed).toMatchObject({done:true,confirmed:true,idempotencyKey:key});
    expect(f.provider.disputes.close).toHaveBeenCalledExactlyOnceWith(id,{},{
      idempotencyKey:key});
    expect(f.provider.disputes.retrieve).toHaveBeenCalledTimes(3);
    expect((await f.db.getMoneyUsage({account,connection:f.ctx.connectionId})).used_cents).toBe(8500);
    await expect(f.call({...args,requestKey:'new'})).rejects.toThrow(/ordinary, open/);
    expect(f.provider.disputes.close).toHaveBeenCalledTimes(1);
  });
  it('4 uncertain provider readback remains charged and cannot repeat',async()=>{
    const f=fixture({uncertain:true}),args={disputeId:id,confirm:true,requestKey:'uncertain'};
    parse(await f.call(args));await grant(f,args);
    const result=parse(await f.call(args));
    expect(result).toMatchObject({done:false,confirmed:false});
    expect(result.warning).toMatch(/Read-back/);
    expect((await f.db.getMoneyUsage({account,connection:f.ctx.connectionId})).used_cents).toBe(8500);
    const retry=parse(await f.call(args));
    expect(retry.done).toBe(false);
    expect(f.provider.disputes.close).toHaveBeenCalledTimes(1);
  });
  it('5 app-owned charge denied by default and outsideApp cannot grant money consent',async()=>{
    const f=fixture({chargeMetadata:{agreementId:'private-rental'}});
    const args={disputeId:id,outsideApp:true,confirm:true};
    expect(parse(await f.call({disputeId:id,confirm:true})).done).toBe(false);
    expect(parse(await f.call(args)).error).toMatch(/explicit approval is required/);
    expect(f.provider.disputes.close).not.toHaveBeenCalled();
  });
  it('6 LIVE, read_only, warning disputes and unknown parameters cannot close',async()=>{
    for(const row of [{record:{status:'warning_needs_response'}},
      {record:{status:'lost'}},{record:{livemode:true}},
      {record:{currency:'eur'}},{record:{amount:0}}]){
      const f=fixture(row);
      await expect(f.call({disputeId:id,confirm:true})).rejects.toThrow();
      expect(f.provider.disputes.close).not.toHaveBeenCalled();
    }
    const f=fixture();
    const live=await handlers.dispute_accept({disputeId:id,confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    const ro=await handlers.dispute_accept({disputeId:id,confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,profile:'read_only'}});
    expect(live.isError).toBe(true);expect(ro.isError).toBe(true);
    await expect(f.call({disputeId:id,amountCents:1,confirm:true})).rejects.toThrow();
    await expect(f.call({disputeId:id,ownerApproved:true,confirm:true})).rejects.toThrow();
    expect(f.provider.disputes.close).not.toHaveBeenCalled();
  });
  it('7 shared daily cap requires separate authenticated override, never caller override',async()=>{
    const f=fixture({limit:8000}),args={disputeId:id,confirm:true,requestKey:'cap'};
    parse(await f.call(args));await grant(f,args);
    const blocked=parse(await f.call(args));
    expect(blocked.error).toMatch(/limit exceeded/i);
    expect(f.provider.disputes.close).not.toHaveBeenCalled();
    expect(await f.db.approveMoneyOverride({account,idempotencyKey:
      idempotencyKey(f.ctx.connection,'dispute_accept',args)})).toBe(true);
    const approved=parse(await f.call(args));
    expect(approved.done).toBe(true);
    expect(f.provider.disputes.close).toHaveBeenCalledTimes(1);
  });
  it('direct and stripe_call keep money guard, batch denies side effects',async()=>{
    const f=fixture();
    const invoke=(name,args)=>dispatchReadOnlyTool({registry,name,args,
      connection:f.ctx.connection,db:f.db,services:f.ctx.services});
    expect(parse(await invoke('dispute_accept',{disputeId:id,confirm:true})).error)
      .toMatch(/explicit approval is required/);
    expect(parse(await invoke('stripe_call',{name:'dispute_accept',
      args:{disputeId:id,confirm:true}})).error).toMatch(/explicit approval is required/);
    expect((await invoke('stripe_batch',{calls:[{
      name:'dispute_accept',args:{disputeId:id,confirm:true}}]})).isError).toBe(true);
    expect(f.provider.disputes.close).not.toHaveBeenCalled();
  });
});
