import {describe,it,expect,vi} from 'vitest';
import {makeDisputeDraft,tools,handlers} from '../../src/tools/dispute-evidence-draft.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const id='du_FAKE123',chargeId='ch_FAKE123',fileId='file_FAKE123';
const privateText='Privately verified shipping receipt #38271';
const due=Math.floor(Date.now()/1000)+86400;
const initial={id,object:'dispute',status:'needs_response',livemode:false,
  amount:1200,currency:'usd',charge:chargeId,metadata:{},
  evidence_details:{due_by:due,past_due:false,submission_count:0},
  evidence:{product_description:null,receipt:null,uncategorized_text:null}};
const parse=r=>JSON.parse(r.content[0].text);
function fixture({record=initial,chargeMetadata={},filePurpose='dispute_evidence'}={}){
  let dispute=structuredClone(record);
  const s={disputes:{
    retrieve:vi.fn(async()=>dispute),
    update:vi.fn(async(_id,params)=>{
      dispute={...dispute,evidence:{...dispute.evidence,...params.evidence}};
      return dispute;
    })},
    charges:{retrieve:vi.fn(async()=>({object:'charge',id:chargeId,
      livemode:false,customer:null,metadata:chargeMetadata}))},
    files:{retrieve:vi.fn(async()=>({object:'file',id:fileId,
      size:140,purpose:filePurpose,livemode:false}))},
    customers:{retrieve:vi.fn(async()=>({object:'customer',id:'cus_FAKE',
      metadata:{}}))}
  };
  const ctx={connection:{mode:'test',profile:'everyday',stripeAccount:'acct_FAKE123'},
    db:createFakeDb(),services:{stripeForConnection:async()=>s}};
  const op=makeDisputeDraft();
  return {s,ctx,call:a=>op.handler(a,ctx)};
}
describe('G-2c TEST dispute draft, never submit',()=>{
  it('declares guarded write for everyday/full, not read-only',()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({name:'dispute_save_evidence',
      writes:true,writeContract:'defineWrite-v1'});
    expect(tools[0].profiles).not.toContain('read_only');
    expect(registry.tools.filter(x=>x.name==='dispute_save_evidence')).toHaveLength(1);
  });
  it('previews without update then saves exactly selected fields with submit false',async()=>{
    const f=fixture(),args={disputeId:id,productDescription:privateText,
      receiptFileId:fileId,requestKey:'first-attempt'};
    const preview=parse(await f.call({...args,dryRun:true}));
    expect(preview.needsConfirmation).toBe(true);
    expect(preview.preview).toContain('submit:false');
    expect(preview.preview).not.toContain(privateText);
    expect(f.s.disputes.update).not.toHaveBeenCalled();
    const done=parse(await f.call({...args,confirm:true}));
    expect(done).toMatchObject({done:true,confirmed:true,disputeId:id,
      draftFields:['product_description','receipt'],
      evidenceSubmitted:false,needsBankSubmission:true});
    expect(f.s.disputes.update).toHaveBeenCalledWith(id,
      {submit:false,evidence:{product_description:privateText,receipt:fileId}},
      {idempotencyKey:expect.stringMatching(/^rmcp_dispute_save_evidence_/)});
    expect(f.s.files.retrieve).toHaveBeenCalledWith(fileId);
    expect(JSON.stringify(done)).not.toContain(privateText);
  });
  it('refuses past-due/submitted disputes and unsupported evidence fields',async()=>{
    const past=fixture({record:{...initial,evidence_details:{
      ...initial.evidence_details,past_due:true}}});
    await expect(past.call({disputeId:id,productDescription:'some'})).rejects.toThrow();
    const already=fixture({record:{...initial,
      evidence_details:{...initial.evidence_details,submission_count:1}}});
    await expect(already.call({disputeId:id,productDescription:'some'})).rejects.toThrow();
    const f=fixture();
    await expect(f.call({disputeId:id,unknownField:'unsafe'})).rejects.toThrow();
    await expect(f.call({disputeId:id})).rejects.toThrow();
    expect(f.s.disputes.update).not.toHaveBeenCalled();
  });
  it('refuses foreign/incorrect-purpose evidence files and app-owned charge by default',async()=>{
    const unsafe=fixture({filePurpose:'identity_document'});
    await expect(unsafe.call({disputeId:id,receiptFileId:fileId,dryRun:true}))
      .rejects.toThrow();
    expect(unsafe.s.disputes.update).not.toHaveBeenCalled();
    const app=fixture({chargeMetadata:{agreementId:'fake-rental'}});
    const refused=await app.call({disputeId:id,productDescription:'safe',confirm:true});
    expect(refused.isError).toBe(true);
    expect(app.s.disputes.update).not.toHaveBeenCalled();
    const bypassPreview=parse(await app.call({disputeId:id,
      productDescription:'safe',outsideApp:true,dryRun:true}));
    expect(bypassPreview.needsConfirmation).toBe(true);
    expect(app.s.disputes.update).not.toHaveBeenCalled();
  });
  it('does not claim confirmation if Stripe did not retain staged evidence',async()=>{
    const f=fixture();
    f.s.disputes.update.mockImplementation(async()=>({object:'dispute'}));
    const result=parse(await f.call({disputeId:id,uncategorizedText:'evidence',confirm:true}));
    expect(result.confirmed).toBe(false);
    expect(result).not.toHaveProperty('draftFields');
  });
  it('denies LIVE and profile read-only dispatch',async()=>{
    const f=fixture();
    const live=await handlers.dispute_save_evidence({disputeId:id,
      productDescription:'safe',confirm:true},{...f.ctx,
      connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    const readOnly=await f.call({disputeId:id,productDescription:'safe',confirm:true});
    expect(readOnly.done).toBeUndefined();
  });
});
