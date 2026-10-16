import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {APP_SEED} from '../../src/apps/profiles.js';
const A='acct_WORKFLOW987',C='cus_WORKFLOW987',CH='ch_WORKFLOW987',
  DU='du_WORKFLOW987',IN='in_WORKFLOW987',WE='we_WORKFLOW987';
const parse=r=>{const t=r.content?.[0]?.text;try{return JSON.parse(t);}catch{return t;}};
async function fixture(){
  const calls=[],db=createFakeDb({accounts:[{id:A,label:'Verified TEST fixture'}]});
  await db.bindKnownAppAccount({id:'appliance-desk',account:A,expectedVersion:1,attach:true});
  const now=Math.floor(Date.now()/1000);
  const customer={object:'customer',id:C,livemode:false,metadata:{agreementId:'agreement_987'},
    email:'owner@example.invalid',name:'TEST Owner'};
  const charge={object:'charge',id:CH,livemode:false,customer:C,payment_intent:'pi_WORKFLOW987',
    metadata:{agreementId:'agreement_987'},amount:3600,amount_refunded:0,
    status:'succeeded',paid:true,currency:'usd',refunded:false,disputed:true};
  const dispute={object:'dispute',id:DU,livemode:false,status:'needs_response',
    charge:CH,payment_intent:'pi_WORKFLOW987',amount:3600,currency:'usd',
    reason:'fraudulent',created:now-5000,
    evidence:{},evidence_details:{due_by:now+7200,submission_count:0,
      past_due:false,has_evidence:false}};
  const invoice={id:IN,object:'invoice',livemode:false,customer:C,currency:'usd',
    status:'paid',total:3600,amount_due:3600,amount_paid:3600,amount_remaining:0,
    lines:{data:[],has_more:false},metadata:{},created:now-4000};
  const required=APP_SEED.webhook_events;
  const hook={object:'webhook_endpoint',id:WE,livemode:false,status:'enabled',
    url:APP_SEED.webhook_url,created:now-1000,api_version:'2026-09-30.endive',
    application:null,connect:null,metadata:{},enabled_events:[
      required[0],required[1],'customer.updated','charge.succeeded']};
  const sdk={
    accounts:{retrieve:async()=>({id:A,object:'account',livemode:false,
      charges_enabled:true,details_submitted:false,business_profile:{},
      settings:{branding:{},payments:{}}})},
    customers:{retrieve:async()=>customer},
    charges:{retrieve:async()=>charge},
    disputes:{retrieve:async()=>dispute,
      update:async(_id,p,opts)=>{
        calls.push({name:'dispute.update',params:p,opts});
        if(p.submit===true)throw Error('MUST NEVER submit');
        dispute.evidence={...dispute.evidence,...p.evidence};
        dispute.evidence_details.has_evidence=true;return dispute;
      }},
    invoices:{
      list:async _a=>({data:[invoice],has_more:false}),
      retrieve:async()=>invoice,
      listLineItems:async()=>({data:[],has_more:false})
    },
    invoicePayments:{list:async()=>({data:[{object:'invoice_payment',id:'inpay_WORKFLOW987',
      invoice:IN,status:'paid',amount_paid:3600,amount_requested:3600,
      payment:{payment_intent:'pi_WORKFLOW987',charge:CH}}],has_more:false})},
    webhookEndpoints:{retrieve:async()=>hook,
      list:async()=>({data:[hook],has_more:false}),
      update:async(_id,p,opts)=>{
        calls.push({name:'webhook.update',params:p,opts});
        hook.enabled_events=[...p.enabled_events];return hook;
      }},
    events:{list:async p=>{calls.push({name:'event.list',params:p});return {data:[{
      object:'event',id:'evt_WORKFLOW987',type:'charge.succeeded',created:now-1000,
      livemode:false,pending_webhooks:2,data:{object:{id:CH,object:'charge'}}
    }],has_more:false};}}
  };
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:A},
    connectionId:'w678-fixture',db,services:{stripeForConnection:async()=>sdk}};
  const call=(name,args)=>registry.handlers[name](args,ctx);
  return {db,sdk,ctx,call,calls,hook,dispute,invoice,customer,required};
}
describe('W-6 original dispute kit, bank-submission safety and actual TEST guarded draft',()=>{
  it('resolves only payment-allocated invoice, app route, actual deadline and missing documents',async()=>{
    const f=await fixture();const r=parse(await f.call('workflow_dispute_kit',
      {disputeId:DU,invoiceId:IN,app:'appliance-desk'}));
    expect(r).toMatchObject({complete:true,actualBankSubmission:false,
      dispute:{id:DU,needsResponse:true},invoice:{id:IN},
      agreement:{verifiedDocument:false}});
    expect(r.agreement.url).toContain('/desk/agreements/');
    expect(r.checklist).toContain('Supporting charge/receipt and customer communication evidence');
    expect(f.calls).toHaveLength(0);
    expect(JSON.stringify(r)).not.toContain('owner@example.invalid');
  });
  it('previews and confirms draft through existing guarded native writer, never submit:true',async()=>{
    const f=await fixture();
    const a={disputeId:DU,outsideApp:true,
      evidence:{productDescription:'Test appliance rental service'}};
    const preview=parse(await f.call('workflow_dispute_kit_save',a));
    expect(preview.done).toBe(false);
    expect(preview.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.call('workflow_dispute_kit_save',
      {...a,confirm:true,requestKey:'w6-draft-1',previewToken:preview.previewToken}));
    expect(done).toMatchObject({done:true,confirmed:true,actualBankSubmission:false});
    expect(done.draftFields).toEqual(['product_description']);
    expect(f.calls.map(x=>x.name)).toEqual(['dispute.update']);
    expect(f.calls[0].params.submit).toBe(false);
    expect(f.dispute.evidence.product_description).toBe('Test appliance rental service');
  });
  it('does not stage expired dispute, stale evidence or invalid invoice association',async()=>{
    const f=await fixture(),a={disputeId:DU,outsideApp:true,
      evidence:{uncategorizedText:'Only synthetic facts'}};
    const p=parse(await f.call('workflow_dispute_kit_save',a));
    f.dispute.evidence_details.due_by=Math.floor(Date.now()/1000)-3;
    expect((await f.call('workflow_dispute_kit_save',
      {...a,confirm:true,requestKey:'expired',previewToken:p.previewToken})).isError).toBe(true);
    f.dispute.evidence_details.due_by=Math.floor(Date.now()/1000)+7000;
    f.ctx.connection.mode='live';
    expect((await f.call('workflow_dispute_kit', {disputeId:DU})).isError).toBe(true);
    f.ctx.connection.mode='test';
    f.sdk.invoicePayments.list=async()=>({data:[],has_more:false});
    expect((await f.call('workflow_dispute_kit',{disputeId:DU,invoiceId:IN})).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
});
describe('W-7 webhook exact coverage, three-day diagnostics and guarded add-only fix',()=>{
  it('distinguishes endpoint subscription from global event delivery and keeps URL private',async()=>{
    const f=await fixture();
    const result=parse(await f.call('workflow_webhook_health',{
      endpointId:WE,apps:['appliance-desk'],includeUndelivered:true}));
    expect(result.complete).toBe(true);
    expect(result.projects[0].status).toBe('missing_events');
    expect(result.projects[0].missingEvents.length).toBeGreaterThan(0);
    expect(result.undelivered).toMatchObject({
      endpointSpecific:false,lookbackDays:3,scope:'ALL_ACCOUNT_WEBHOOK_DESTINATIONS',
      observedCount:1});
    expect(f.calls[0].name).toBe('event.list');
    expect(JSON.stringify(result)).not.toContain('/api/webhooks/stripe');
    expect(JSON.stringify(result)).not.toContain('owner@example.invalid');
  });
  it('preserves unrelated subscriptions and verifies original update after independent confirmation',async()=>{
    const f=await fixture();
    const args={endpointId:WE,apps:['appliance-desk']};
    const p=parse(await f.call('workflow_webhook_health_fix',args));
    expect(p.needsConfirmation).toBe(true);
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.call('workflow_webhook_health_fix',{
      ...args,confirm:true,requestKey:'w7-repair',previewToken:p.previewToken}));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.hook.enabled_events).toEqual(expect.arrayContaining([
      ...f.required,'customer.updated','charge.succeeded']));
    expect(f.calls.filter(x=>x.name==='webhook.update')).toHaveLength(1);
  });
  it('refuses stale event coverage, foreign endpoint destination and LIVE writes',async()=>{
    const f=await fixture(),args={endpointId:WE,apps:['appliance-desk']};
    const p=parse(await f.call('workflow_webhook_health_fix',args));
    f.hook.enabled_events.push('invoice.finalized');
    expect((await f.call('workflow_webhook_health_fix',{
      ...args,confirm:true,requestKey:'w7-stale',previewToken:p.previewToken})).isError)
      .toBe(true);
    f.hook.url='https://unrelated.example/webhook';
    expect((await f.call('workflow_webhook_health_fix',args)).isError).toBe(true);
    f.ctx.connection.mode='live';
    expect((await f.call('workflow_webhook_health',args)).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('treats more than 30 enabled events as provider-complete coverage, not summary truncation',async()=>{
    const f=await fixture();
    f.hook.enabled_events=Array.from({length:40},(_,i)=>'sample.event_'+i);
    f.hook.enabled_events.push(...f.required);
    const health=parse(await f.call('workflow_webhook_health',
      {endpointId:WE,apps:['appliance-desk'],includeUndelivered:false}));
    expect(health.projects[0].status).toBe('covered');
    expect(health.endpoint.enabledEventCount).toBeGreaterThan(30);
    expect(health.complete).toBe(true);
  });
});
describe('W-8 selected bound app actual P-3 readiness versus LIVE disabled',()=>{
  it('reports all 21 TEST rows, user decisions, separate LIVE unknown, no product copy',async()=>{
    const f=await fixture();
    const result=parse(await f.call('workflow_go_live_checklist',{
      apps:['appliance-desk'],webhookEndpoint:WE}));
    expect(result).toMatchObject({projectCount:1,complete:true,
      liveParity:'not_verified',liveProviderQueried:false,
      anyLiveWrite:false,autoCatalogCopy:false,readyToGoLive:false});
    const first=result.projects[0];
    expect(first.test.checks).toHaveLength(21);
    expect(first.test.checks.find(x=>x.id==='S6').status).toBe('needs_decision');
    expect(first.catalog).toMatchObject({ownedByApp:true,
      eligibleForFutureCopyPlan:false,copyExecuted:false});
    expect(first.live).toMatchObject({readPerformed:false,parityVerified:false});
    expect(f.calls).toHaveLength(0);
  });
  it('fails unknown app, missing account binding and direct LIVE mode',async()=>{
    const f=await fixture();
    expect((await f.call('workflow_go_live_checklist',{apps:['other-tenant']})).isError)
      .toBe(true);
    f.ctx.connection.mode='live';
    expect((await f.call('workflow_go_live_checklist',{})).isError).toBe(true);
  });
});
