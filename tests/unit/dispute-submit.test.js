import {describe,it,expect,vi} from 'vitest';
import {makeDisputeSubmit,tools,handlers} from '../../src/tools/dispute-submit.js';
import {registry} from '../../src/tools/index.js';
import {listingForConnection} from '../../src/core/profiles.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const disputeId='du_TEST1234',chargeId='ch_TEST1234',fileId='file_TEST1234';
const secret='PRIVATE_EVIDENCE_SENTINEL';
const parse=r=>JSON.parse(r.content[0].text);
function fixture(options={}){
  const due=Math.floor(Date.now()/1000)+86400;
  let dispute={id:disputeId,object:'dispute',livemode:false,status:'needs_response',
    amount:8500,currency:'usd',charge:chargeId,metadata:{},
    evidence_details:{due_by:due,past_due:false,has_evidence:true,submission_count:0},
    evidence:{product_description:secret,receipt:fileId,shipping_date:null},
    ...(options.dispute??{})};
  const provider={disputes:{
    retrieve:vi.fn(async()=>structuredClone(dispute)),
    update:vi.fn(async(id,_params)=>{
      if(options.uncertain)return {object:'dispute',id};
      dispute={...dispute,status:'under_review',evidence_details:{
        ...dispute.evidence_details,submission_count:1}};
      return structuredClone(dispute);
    })},
    charges:{retrieve:vi.fn(async()=>({id:chargeId,object:'charge',livemode:false,
      amount:10000,currency:'usd',customer:null,metadata:options.chargeMetadata??{}}))},
    files:{retrieve:vi.fn(async()=>({id:fileId,object:'file',livemode:false,
      purpose:options.purpose??'dispute_evidence',size:100}))},
    customers:{retrieve:vi.fn(async()=>({id:'cus_TEST1234',object:'customer',
      metadata:{}}))}};
  const db=createFakeDb(),ctx={db,connectionId:'submission-fixture',
    connection:{stripeAccount:'acct_TEST1234',mode:'test',profile:'everyday'},
    services:{stripeForConnection:async()=>provider}};
  return {provider,db,ctx,call:(a)=>makeDisputeSubmit().handler(a,ctx)};
}
describe('G-2d1 irreversible TEST evidence submission, real handler',()=>{
  it('registers only an everyday/full guarded destructive write',()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({name:'dispute_submit_evidence',writes:true,
      safety:'C',profiles:['everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dispute_submit_evidence')).toHaveLength(1);
    const f=fixture();
    expect(listingForConnection(registry,f.ctx.connection,'catalog').map(x=>x.name))
      .toContain('dispute_submit_evidence');
  });
  it('previews every staged field safely without submitting and only confirms independent readback',async()=>{
    const f=fixture(),args={disputeId,requestKey:'submit-once'};
    const preview=parse(await f.call({...args,dryRun:true,confirm:true}));
    expect(preview.preview).toContain('IRREVERSIBLE');
    expect(preview.preview).toContain('product_description: text');
    expect(preview.preview).toContain('receipt: file '+fileId);
    expect(JSON.stringify(preview)).not.toContain(secret);
    expect(f.provider.disputes.update).not.toHaveBeenCalled();
    const missing=parse(await f.call(args));
    expect(missing.needsConfirmation).toBe(true);
    expect(f.provider.disputes.update).not.toHaveBeenCalled();
    const done=parse(await f.call({...args,confirm:true}));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.provider.disputes.update).toHaveBeenCalledWith(disputeId,{submit:true},
      {idempotencyKey:expect.stringMatching(/^rmcp_dispute_submit_evidence_/)});
    expect(f.provider.disputes.retrieve).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(done)).not.toContain(secret);
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(secret);
  });
  it('uses stable idempotency between preview and confirm, changed by retry key',async()=>{
    const a=fixture(),b=fixture();
    const first=parse(await a.call({disputeId,confirm:true,requestKey:'one'}));
    const second=parse(await b.call({disputeId,confirm:true,requestKey:'one'}));
    const third=parse(await fixture().call({disputeId,confirm:true,requestKey:'two'}));
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.idempotencyKey).not.toBe(third.idempotencyKey);
  });
  it('fails closed on empty, already-submitted, stale and unsupported evidence',async()=>{
    for(const d of [
      {evidence:{receipt:null,product_description:''}},
      {evidence_details:{due_by:Math.floor(Date.now()/1000)-1,past_due:false,
        has_evidence:true,submission_count:0}},
      {evidence_details:{due_by:Math.floor(Date.now()/1000)+86400,past_due:false,
        has_evidence:true,submission_count:1}},
      {evidence:{enhanced_evidence:{private:'complex'}}},
      {evidence:{product_description:'x'.repeat(12001)}}
    ]){
      const f=fixture({dispute:d});
      await expect(f.call({disputeId,confirm:true})).rejects.toThrow();
      expect(f.provider.disputes.update).not.toHaveBeenCalled();
    }
    const file=fixture({purpose:'identity_document'});
    await expect(file.call({disputeId,confirm:true})).rejects.toThrow();
    expect(file.provider.disputes.update).not.toHaveBeenCalled();
  });
  it('uncertain readback never means confirmed and has no inverse',async()=>{
    const f=fixture({uncertain:true});
    const answer=parse(await f.call({disputeId,confirm:true}));
    expect(answer).toMatchObject({done:false,confirmed:false});
    expect(answer.warning).toMatch(/Read-back/);
    expect(answer).not.toHaveProperty('inverse');
  });
  it('direct and indirect dispatcher allow only guarded TEST writes, never batched writes',async()=>{
    const f=fixture();
    const direct=await dispatchReadOnlyTool({registry,name:'dispute_submit_evidence',
      args:{disputeId,dryRun:true},connection:f.ctx.connection,db:f.db,
      services:f.ctx.services});
    expect(parse(direct).preview).toContain('IRREVERSIBLE');
    const indirect=await dispatchReadOnlyTool({registry,name:'stripe_call',
      args:{name:'dispute_submit_evidence',args:{disputeId,dryRun:true}},
      connection:f.ctx.connection,db:f.db,services:f.ctx.services});
    expect(parse(indirect).preview).toContain('IRREVERSIBLE');
    const batch=await dispatchReadOnlyTool({registry,name:'stripe_batch',
      args:{calls:[{name:'dispute_submit_evidence',args:{disputeId,confirm:true}}]},
      connection:f.ctx.connection,db:f.db,services:f.ctx.services});
    expect(batch.isError).toBe(true);
    expect(f.provider.disputes.update).not.toHaveBeenCalled();
  });
  it('blocks app-owned charge by default, LIVE, read_only and caller-provided submit override',async()=>{
    const f=fixture({chargeMetadata:{agreementId:'protected'}});
    const denied=parse(await f.call({disputeId,confirm:true}));
    expect(denied.done).toBe(false);
    expect(f.provider.disputes.update).not.toHaveBeenCalled();
    const preview=parse(await f.call({disputeId,outsideApp:true,dryRun:true}));
    expect(preview.needsConfirmation).toBe(true);
    await expect(f.call({disputeId,submit:true,confirm:true})).rejects.toThrow();
    const live=await handlers.dispute_submit_evidence({disputeId,confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    const ro=await handlers.dispute_submit_evidence({disputeId,confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,profile:'read_only'}});
    expect(live.isError).toBe(true);
    expect(ro.isError).toBe(true);
    expect(f.provider.disputes.update).not.toHaveBeenCalled();
  });
});
