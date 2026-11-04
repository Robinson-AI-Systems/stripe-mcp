// CAP-4 D-8 §B: workflow_dispute_kit_save follows the connection
// mode under the V2 write idiom (coordinator ruling 2 — §B is its
// own sibling unit, never folded into §A's read diff). The save's
// gate is the split writableMode (verifyModeContext over the same
// profile/audit checks; writable itself is byte-identical for the
// other five write composites), its examination is §A's converted
// examine() with the mode-aware verifier, and its writer is the
// already mode-converted dispute_save_evidence. TEST behavior is
// byte-identical to baseline.
import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
const A='acct_D8B987',OTHER='acct_D8BOTHER',C='cus_D8B987',
  CH='ch_D8B987',DU='du_D8B987',IN='in_D8B987',FILE='file_D8B987';
const LEGACY='An exact selected TEST account and permitted read profile are required';
const parse=r=>{const t=r.content?.[0]?.text;try{return JSON.parse(t);}catch{return t;}};
const text=r=>r.content?.[0]?.text??'';

function fixture(livemode){
  const calls=[];
  const db=createFakeDb({accounts:[
    {id:A,label:'D8B fixture',test_key_kind:'restricted',
      live_key_kind:'restricted',
      ...(livemode?{live_enabled:true,live_connected:true}:{})},
    {id:OTHER,label:'D8B other account'}]});
  const now=Math.floor(Date.now()/1000);
  const customer={object:'customer',id:C,livemode,
    metadata:{agreementId:'agreement_987'},email:'owner@example.invalid',
    name:'Fixture Owner'};
  const charge={object:'charge',id:CH,livemode,customer:C,
    payment_intent:'pi_D8B987',metadata:{agreementId:'agreement_987'},
    amount:3600,amount_refunded:0,status:'succeeded',paid:true,
    currency:'usd',refunded:false,disputed:true};
  const dispute={object:'dispute',id:DU,livemode,status:'needs_response',
    charge:CH,payment_intent:'pi_D8B987',amount:3600,currency:'usd',
    reason:'fraudulent',created:now-5000,evidence:{},
    evidence_details:{due_by:now+7200,submission_count:0,
      past_due:false,has_evidence:false}};
  const invoice={id:IN,object:'invoice',livemode,customer:C,
    currency:'usd',status:'paid',total:3600,amount_due:3600,
    amount_paid:3600,amount_remaining:0,
    lines:{data:[],has_more:false},metadata:{},created:now-4000};
  const file={object:'file',id:FILE,livemode,size:140,
    purpose:'dispute_evidence',created:now-3000,filename:'receipt.pdf'};
  const sdk={
    accounts:{retrieve:async()=>({id:A,object:'account',livemode,
      charges_enabled:true,details_submitted:true,business_profile:{},
      settings:{branding:{},payments:{}}})},
    balance:{retrieve:async()=>({object:'balance',livemode,
      available:[],pending:[]})},
    customers:{retrieve:async()=>customer},
    charges:{retrieve:async()=>charge},
    disputes:{retrieve:async()=>dispute,
      update:async(_id,p,opts)=>{
        calls.push({name:'dispute.update',params:p,opts});
        if(p.submit===true)throw Error('MUST NEVER submit');
        dispute.evidence={...dispute.evidence,...p.evidence};
        dispute.evidence_details.has_evidence=true;return dispute;
      }},
    invoices:{list:async()=>({data:[invoice],has_more:false}),
      retrieve:async()=>invoice,
      listLineItems:async()=>({data:[],has_more:false})},
    invoicePayments:{list:async()=>({data:[{object:'invoice_payment',
      id:'inpay_D8B987',invoice:IN,status:'paid',amount_paid:3600,
      amount_requested:3600,
      payment:{payment_intent:'pi_D8B987',charge:CH}}],has_more:false})},
    files:{retrieve:async()=>file}
  };
  if(livemode)vi.stubEnv('VERCEL_ENV','production');
  const ctx={connection:{mode:livemode?'live':'test',profile:'full',
    stripeAccount:A},connectionId:'d8b-fixture',db,
    ...(livemode?{liveAccessGranted:true}:{}),
    services:{stripeForConnection:async()=>sdk}};
  return {db,sdk,ctx,calls,dispute,charge,customer,invoice,
    call:(name,args)=>registry.handlers[name](args,ctx),
    callAs:(name,args,other)=>registry.handlers[name](args,other),
    async bind(){await db.bindKnownAppAccount(
      {id:'appliance-desk',account:A,expectedVersion:1,attach:true});}};
}
const EVIDENCE={productDescription:'Appliance rental service'};

describe('CAP-4 D-8 §B save — TEST baseline contract (preserved)',()=>{
  it('previews and confirms a TEST draft exactly as at baseline, never submit:true',async()=>{
    const f=fixture(false);
    const a={disputeId:DU,outsideApp:true,evidence:EVIDENCE};
    const preview=parse(await f.call('workflow_dispute_kit_save',a));
    expect(preview).toMatchObject({mode:'test',done:false,
      needsConfirmation:true,actualBankSubmission:false,
      stageFields:['productDescription']});
    expect(preview.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.call('workflow_dispute_kit_save',
      {...a,confirm:true,requestKey:'d8b-test-1',
        previewToken:preview.previewToken}));
    expect(done).toMatchObject({mode:'test',done:true,confirmed:true,
      draftFields:['product_description']});
    expect(f.calls.map(x=>x.name)).toEqual(['dispute.update']);
    expect(f.calls[0].params.submit).toBe(false);
    expect(f.dispute.evidence.product_description)
      .toBe('Appliance rental service');
  });
  it('TEST refusal texts are byte-identical',async()=>{
    const f=fixture(false);
    const bad=await f.call('workflow_dispute_kit_save',
      {disputeId:DU,evidence:{unknownField:'x'}});
    expect(bad.isError).toBe(true);
    expect(text(bad)).toBe('Only named draft evidence fields may be staged');
    const badId=await f.call('workflow_dispute_kit_save',
      {disputeId:'du_x',evidence:EVIDENCE});
    expect(badId.isError).toBe(true);
    expect(text(badId)).toBe(
      'Exact TEST dispute selection and documented inputs required');
    expect(f.calls).toHaveLength(0);
  });
  it('TEST save with a bound app stages with the verified agreement link',async()=>{
    const f=fixture(false);await f.bind();
    const a={disputeId:DU,invoiceId:IN,app:'appliance-desk',
      outsideApp:true,evidence:EVIDENCE};
    const preview=parse(await f.call('workflow_dispute_kit_save',a));
    expect(preview).toMatchObject({mode:'test',complete:true,
      agreement:{verifiedDocument:false}});
    expect(preview.agreement.url).toContain('/desk/agreements/');
    const done=parse(await f.call('workflow_dispute_kit_save',
      {...a,confirm:true,requestKey:'d8b-test-app',
        previewToken:preview.previewToken}));
    expect(done.done).toBe(true);
    expect(f.calls.map(x=>x.name)).toEqual(['dispute.update']);
  });
  it('TEST save refuses when the app binding names a different account',async()=>{
    const f=fixture(false);await f.bind();
    // The app profile is bound to A; this connection selected OTHER.
    // The agreement link read fails its account check, the examine
    // records the gap, and the save refuses on prerequisites —
    // the baseline wrong-account refusal, unchanged.
    const other={...f.ctx,connection:{mode:'test',profile:'full',
      stripeAccount:OTHER}};
    const out=await f.callAs('workflow_dispute_kit_save',
      {disputeId:DU,invoiceId:IN,app:'appliance-desk',
        outsideApp:true,evidence:EVIDENCE},other);
    expect(out.isError).toBe(true);
    expect(text(out)).toBe('Original dispute has unmet staging prerequisites');
    expect(f.calls).toHaveLength(0);
  });
  it('TEST save refuses a wrong-mode dispute and persists nothing',async()=>{
    const f=fixture(false);
    f.dispute.livemode=true;
    const out=await f.call('workflow_dispute_kit_save',
      {disputeId:DU,evidence:EVIDENCE});
    expect(out.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
});

describe('CAP-4 D-8 §B save — LIVE conversion',()=>{
  it('previews and confirms a LIVE draft end-to-end, never submit:true',async()=>{
    const f=fixture(true);
    const a={disputeId:DU,outsideApp:true,
      evidence:{...EVIDENCE,receiptFileId:FILE}};
    const preview=parse(await f.call('workflow_dispute_kit_save',a));
    expect(preview).toMatchObject({mode:'live',done:false,
      needsConfirmation:true,actualBankSubmission:false});
    expect(preview.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.call('workflow_dispute_kit_save',
      {...a,confirm:true,requestKey:'d8b-live-1',
        previewToken:preview.previewToken}));
    expect(done).toMatchObject({mode:'live',done:true,confirmed:true});
    expect(done.draftFields).toEqual(['product_description','receipt']);
    expect(f.calls.map(x=>x.name)).toEqual(['dispute.update']);
    expect(f.calls[0].params.submit).toBe(false);
    expect(f.dispute.evidence.product_description)
      .toBe('Appliance rental service');
    expect(f.dispute.evidence.receipt).toBe(FILE);
  });
  it('LIVE save refuses a wrong-mode dispute and persists nothing',async()=>{
    const f=fixture(true);
    f.dispute.livemode=false;
    const out=await f.call('workflow_dispute_kit_save',
      {disputeId:DU,evidence:EVIDENCE});
    expect(out.isError).toBe(true);
    expect(text(out)).toContain('LIVE');
    expect(text(out)).not.toBe(LEGACY);
    expect(f.calls).toHaveLength(0);
  });
  it('LIVE gate substitutes the mode word in both refusal layers',async()=>{
    const f=fixture(true);
    const badAccount={...f.ctx,connection:{mode:'live',profile:'full',
      stripeAccount:'not-an-account'}};
    const out=await f.callAs('workflow_dispute_kit_save',
      {disputeId:DU,evidence:EVIDENCE},badAccount);
    expect(out.isError).toBe(true);
    expect(text(out)).toBe('An exact selected LIVE account and '+
      'permitted read profile are required');
    const noDb={...f.ctx,db:{}};
    const out2=await f.callAs('workflow_dispute_kit_save',
      {disputeId:DU,evidence:EVIDENCE},noDb);
    expect(out2.isError).toBe(true);
    expect(text(out2)).toBe('Guarded LIVE write profile and '+
      'audit database required');
    expect(f.calls).toHaveLength(0);
  });
  it('LIVE save with a bound app records the agreement gap on the saved kit and still stages',async()=>{
    const f=fixture(true);await f.bind();
    const a={disputeId:DU,invoiceId:IN,app:'appliance-desk',
      outsideApp:true,evidence:EVIDENCE};
    const preview=parse(await f.call('workflow_dispute_kit_save',a));
    // project_record_link stays TEST-gated (ruling 4): the examine
    // records the gap and the agreement lands on the checklist; the
    // save proceeds on that recorded basis and invents no LIVE route.
    expect(preview).toMatchObject({mode:'live',agreement:null,
      done:false,needsConfirmation:true});
    expect(preview.gaps).toEqual([{section:'app_agreement_link',
      reason:'guarded_profile_route_unavailable'}]);
    expect(preview.checklist).toContain(
      'Signed agreement: open verified app record and attach actual document');
    const done=parse(await f.call('workflow_dispute_kit_save',
      {...a,confirm:true,requestKey:'d8b-live-app',
        previewToken:preview.previewToken}));
    expect(done).toMatchObject({mode:'live',done:true,confirmed:true});
    expect(done.gaps).toEqual([{section:'app_agreement_link',
      reason:'guarded_profile_route_unavailable'}]);
    expect(f.calls.map(x=>x.name)).toEqual(['dispute.update']);
    expect(f.calls[0].params.submit).toBe(false);
  });
  it('LIVE save with app still refuses when the dispute itself cannot stage',async()=>{
    const f=fixture(true);await f.bind();
    f.dispute.evidence_details.due_by=Math.floor(Date.now()/1000)-3;
    const out=await f.call('workflow_dispute_kit_save',
      {disputeId:DU,invoiceId:IN,app:'appliance-desk',
        outsideApp:true,evidence:EVIDENCE});
    expect(out.isError).toBe(true);
    expect(text(out)).toBe('Original dispute has unmet staging prerequisites');
    expect(f.calls).toHaveLength(0);
  });
});

describe('CAP-4 D-8 §B save — mode-partitioned persistence',()=>{
  it('a kit saved in TEST is never re-stamped or mutated by a LIVE read of the same dispute id',async()=>{
    const t=fixture(false);
    const a={disputeId:DU,outsideApp:true,evidence:EVIDENCE};
    const preview=parse(await t.call('workflow_dispute_kit_save',a));
    const done=parse(await t.call('workflow_dispute_kit_save',
      {...a,confirm:true,requestKey:'d8b-partition',
        previewToken:preview.previewToken}));
    expect(done).toMatchObject({mode:'test',done:true});
    // The TEST kit reads back in TEST with its staged state; the
    // evidence checklist item is discharged by the staged draft.
    const testKit=parse(await t.call('workflow_dispute_kit',
      {disputeId:DU}));
    expect(testKit.mode).toBe('test');
    expect(testKit.checklist).not.toContain(
      'Supporting charge/receipt and customer communication evidence');
    // A LIVE connection asking for the same dispute id is served
    // the LIVE dispute — its own object, unstaged — stamped live.
    // Nothing about the TEST record moves.
    const l=fixture(true);
    const liveKit=parse(await l.call('workflow_dispute_kit',
      {disputeId:DU}));
    expect(liveKit.mode).toBe('live');
    expect(liveKit.checklist).toContain(
      'Supporting charge/receipt and customer communication evidence');
    expect(t.dispute.evidence.product_description)
      .toBe('Appliance rental service');
    expect(l.dispute.evidence).toEqual({});
  });
  it('the save tool stays a guarded write naming either mode',()=>{
    const tool=registry.tools.find(t=>t.name==='workflow_dispute_kit_save');
    expect(tool).toBeTruthy();
    expect(tool.writes).toBe(true);
    expect(tool.writeContract).toBe('defineWrite-v1');
    expect(tool.description).toContain('either mode');
    expect(tool.description).not.toContain('TEST');
  });
});
