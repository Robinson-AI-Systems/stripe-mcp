// CAP-4 D-4 — dispute and event READ tools verify every returned
// object against the connection's own mode. At baseline the family
// was refusal-only: handler gates refused every non-TEST connection
// before any provider call, and the projections hard-required
// `livemode===false`, so a LIVE object could never be read on any
// connection and no per-object verification followed the
// connection's mode. The LIVE happy paths, the projection mode
// contract, the provider-called wrong-mode refusals on LIVE
// connections and the descriptions below fail at the pre-D-4
// baseline. Six tests pass at baseline and after: the wrong-mode
// refusals on TEST connections (already enforced by the
// projections' hard check), the byte-identical TEST output pins
// and the reachability pin — proving TEST behavior and field sets
// did not move — and the LIVE dispute privacy test, which passes
// vacuously at baseline because the gate refuses everything (so
// nothing can leak) and gains its meaning after conversion, when
// real LIVE projections still leak nothing.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools as disputeTools,handlers as disputeReads,disputeSafe}
  from '../../src/tools/dispute-reads.js';
import {tools as eventTools,handlers as eventReads,eventSafe}
  from '../../src/tools/events-read.js';

const acct='acct_D4FAKE',duId='du_FAKE1234',evtId='evt_FAKE1234';
const parse=r=>JSON.parse(r.content[0].text);
const privateText='PRIVATE_CARD_EMAIL_SENTINEL';

const disputeBase={object:'dispute',id:duId,amount:2565,currency:'usd',
  created:1680203749,status:'needs_response',charge:'ch_FAKE1234',
  payment_intent:'pi_FAKE1234',reason:'fraudulent',
  evidence_details:{due_by:1680403749,past_due:false,has_evidence:true,
    submission_count:0},
  evidence:{billing_address:'PRIVATE CUSTOMER ADDRESS',
    customer_email_address:'private@example.test'},
  payment_method_details:{card:{last4:'9876'}}};
const dispute=(livemode,over={})=>({...disputeBase,livemode,...over});

const eventBase={id:evtId,object:'event',type:'charge.succeeded',
  created:1695680197,api_version:'2025-10-29.clover',pending_webhooks:1,
  data:{object:{id:'ch_FAKE1234',object:'charge',
    billing_details:{email:privateText},
    payment_method_details:{card:{number:privateText}}}},
  request:{id:'req_FAKE1234',idempotency_key:privateText},
  account:'acct_FAKE1234'};
const evt=(livemode)=>({...eventBase,livemode});

const liveSdkParts={accounts:{retrieve:async()=>({id:acct,
    object:'account',livemode:true})},
  balance:{retrieve:async()=>({object:'balance',livemode:true})}};
function disputeSdk(d,listData=[d]){
  return {...liveSdkParts,
    disputes:{list:vi.fn(async()=>({data:listData,has_more:false})),
      retrieve:vi.fn(async()=>d)}};
}
function eventSdk(e,listData=[e]){
  return {...liveSdkParts,
    events:{list:vi.fn(async()=>({object:'list',data:listData,
        has_more:false})),
      retrieve:vi.fn(async()=>e)}};
}
function testCtx(sdk){
  return {connection:{stripeAccount:acct,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
}
async function liveCtx(sdk){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,live_enabled:true,
    live_connected:true,money_limit_cents:0}]});
  return {db,connection:{stripeAccount:acct,mode:'live',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

describe('CAP-4 D-4 dispute reads verify the connection mode',()=>{
  it('serves verified LIVE disputes in list and get',async()=>{
    const s=disputeSdk(dispute(true)),ctx=await liveCtx(s);
    const list=parse(await disputeReads.dispute_list({limit:5},ctx));
    expect(s.disputes.list).toHaveBeenCalledWith({limit:5});
    expect(list.data[0]).toMatchObject({id:duId,amountMinor:2565,
      currency:'usd',status:'needs_response',evidenceDueUnix:1680403749,
      hasEvidence:true,needsResponse:true,submissionCount:0});
    expect(list.has_more).toBe(false);
    expect(parse(await disputeReads.dispute_get({disputeId:duId},ctx)).id)
      .toBe(duId);
  });
  it('mirrors deadline and submission-count edge fixtures in LIVE',async()=>{
    const edge=dispute(true,{status:'under_review',
      evidence_details:{due_by:1680403749,past_due:true,
        has_evidence:true,submission_count:2}});
    const ctx=await liveCtx(disputeSdk(edge));
    expect(parse(await disputeReads.dispute_get({disputeId:duId},ctx)))
      .toMatchObject({status:'under_review',submissionCount:2,
        pastDue:true,needsResponse:false,hasEvidence:true});
  });
  it('refuses a TEST dispute on a LIVE connection at the projection',async()=>{
    const s=disputeSdk(dispute(false)),ctx=await liveCtx(s);
    expect((await disputeReads.dispute_list({},ctx)).isError).toBe(true);
    expect(s.disputes.list).toHaveBeenCalled();
    expect((await disputeReads.dispute_get({disputeId:duId},ctx)).isError)
      .toBe(true);
    expect(s.disputes.retrieve).toHaveBeenCalledWith(duId);
  });
  it('refuses a LIVE dispute on a TEST connection in list and get',async()=>{
    const s=disputeSdk(dispute(true)),ctx=testCtx(s);
    expect((await disputeReads.dispute_list({},ctx)).isError).toBe(true);
    expect((await disputeReads.dispute_get({disputeId:duId},ctx)).isError)
      .toBe(true);
  });
  it('disputeSafe verifies a supplied mode in both directions; no-mode is historical',()=>{
    expect(disputeSafe(dispute(false))).toMatchObject({id:duId});
    expect(()=>disputeSafe(dispute(true))).toThrow();
    expect(disputeSafe(dispute(false),0,'test')).toMatchObject({id:duId});
    expect(disputeSafe(dispute(true),0,'live')).toMatchObject({id:duId});
    expect(()=>disputeSafe(dispute(true),0,'test')).toThrow();
    expect(()=>disputeSafe(dispute(false),0,'live')).toThrow();
  });
  it('keeps TEST dispute list output byte-identical to baseline',async()=>{
    const ctx=testCtx(disputeSdk(dispute(false)));
    const list=parse(await disputeReads.dispute_list({limit:5},ctx));
    expect(list.data[0]).toEqual({id:duId,charge:'ch_FAKE1234',
      paymentIntent:'pi_FAKE1234',amountMinor:2565,currency:'usd',
      status:'needs_response',reason:'fraudulent',
      createdAt:'Mar 30, 2023, 13:15:49 MDT',
      evidenceDueAt:'Apr 01, 2023, 20:49:09 MDT',
      evidenceDueUnix:1680403749,daysLeft:19450,needsResponse:true,
      pastDue:false,hasEvidence:true,submissionCount:0,
      evidenceFields:null,
      note:'Evidence contents and cardholder personal data are not returned.'});
    expect(list.has_more).toBe(false);
  });
  it('never leaks private evidence on LIVE dispute reads',async()=>{
    const ctx=await liveCtx(disputeSdk(dispute(true)));
    const serialized=JSON.stringify([
      await disputeReads.dispute_list({},ctx),
      await disputeReads.dispute_get({disputeId:duId},ctx)]);
    for(const secret of ['PRIVATE CUSTOMER ADDRESS',
      'private@example.test','9876'])expect(serialized).not.toContain(secret);
  });
  it('dispute descriptions name both modes',()=>{
    for(const t of disputeTools)expect(t.description).toContain('LIVE');
  });
});

describe('CAP-4 D-4 event reads verify the connection mode',()=>{
  it('serves verified LIVE events in list and get, incl. field-selected detail',async()=>{
    const s=eventSdk(evt(true)),ctx=await liveCtx(s);
    const list=parse(await eventReads.event_list({limit:2},ctx));
    expect(list.data[0]).toEqual({id:evtId,type:'charge.succeeded',
      createdAt:'Sep 25, 2023, 16:16:37 MDT'});
    const full=parse(await eventReads.event_list({detail:'full'},ctx));
    expect(full.data[0]).toMatchObject({objectId:'ch_FAKE1234',
      objectType:'charge',pendingWebhooks:1,
      apiVersion:'2025-10-29.clover'});
    expect(parse(await eventReads.event_get(
      {eventId:evtId,detail:'full',
        fields:['type','objectId']},ctx)))
      .toEqual({id:evtId,type:'charge.succeeded',
        objectId:'ch_FAKE1234'});
  });
  it('serves LIVE undelivered events with the provider filter and note',async()=>{
    const s=eventSdk(evt(true)),ctx=await liveCtx(s);
    const value=parse(await eventReads.event_list_undelivered(
      {limit:1,types:['invoice.paid','charge.succeeded']},ctx));
    expect(s.events.list).toHaveBeenCalledWith({limit:1,
      types:['invoice.paid','charge.succeeded'],delivery_success:false});
    expect(value.filter).toBe('Stripe delivery_success=false');
    expect(value.note).toMatch(/does not prove/);
    expect(JSON.stringify(value)).not.toContain(privateText);
  });
  it('refuses a TEST event on a LIVE connection at the projection',async()=>{
    const s=eventSdk(evt(false)),ctx=await liveCtx(s);
    expect((await eventReads.event_list({},ctx)).isError).toBe(true);
    expect(s.events.list).toHaveBeenCalled();
    expect((await eventReads.event_get({eventId:evtId},ctx)).isError)
      .toBe(true);
    expect(s.events.retrieve).toHaveBeenCalledWith(evtId);
  });
  it('refuses a LIVE event on a TEST connection in list and get',async()=>{
    const s=eventSdk(evt(true)),ctx=testCtx(s);
    expect((await eventReads.event_list({},ctx)).isError).toBe(true);
    expect((await eventReads.event_get({eventId:evtId},ctx)).isError)
      .toBe(true);
  });
  it('eventSafe verifies a supplied mode in both directions; no-mode is historical',()=>{
    expect(eventSafe(evt(false))).toEqual({id:evtId,
      type:'charge.succeeded',createdAt:'Sep 25, 2023, 16:16:37 MDT'});
    expect(()=>eventSafe(evt(true))).toThrow();
    expect(eventSafe(evt(true),{mode:'live',detail:'full'}))
      .toMatchObject({objectId:'ch_FAKE1234',pendingWebhooks:1});
    expect(eventSafe(evt(true),{mode:'live',detail:'full',
      select:['type','objectId']}))
      .toEqual({id:evtId,type:'charge.succeeded',
        objectId:'ch_FAKE1234'});
    expect(()=>eventSafe(evt(true),{mode:'test'})).toThrow();
    expect(()=>eventSafe(evt(false),{mode:'live'})).toThrow();
    expect(eventSafe(evt(false),{mode:'test'})).toEqual({id:evtId,
      type:'charge.succeeded',createdAt:'Sep 25, 2023, 16:16:37 MDT'});
  });
  it('keeps the embedded-object privacy shape on LIVE full reads',async()=>{
    const ctx=await liveCtx(eventSdk(evt(true)));
    const serialized=JSON.stringify([
      eventSafe(evt(true),{mode:'live',detail:'full'}),
      await eventReads.event_get({eventId:evtId,detail:'full'},ctx)]);
    expect(serialized).not.toContain(privateText);
    expect(serialized).not.toMatch(/billing_details|payment_method|req_FAKE/);
    expect(serialized).toContain('ch_FAKE1234');
  });
  it('keeps TEST event list output byte-identical to baseline',async()=>{
    const ctx=testCtx(eventSdk(evt(false)));
    const list=parse(await eventReads.event_list({limit:2},ctx));
    expect(list.data[0]).toEqual({id:evtId,type:'charge.succeeded',
      createdAt:'Sep 25, 2023, 16:16:37 MDT'});
    expect(list.has_more).toBe(false);
  });
  it('event descriptions name both modes',()=>{
    for(const t of eventTools)expect(t.description).toContain('LIVE');
  });
  it('registers exactly the five family tools, all read-only',()=>{
    expect(disputeTools.map(t=>t.name))
      .toEqual(['dispute_list','dispute_get']);
    expect(eventTools.map(t=>t.name)).toEqual([
      'event_list','event_get','event_list_undelivered']);
    for(const t of [...disputeTools,...eventTools])
      expect(t.writes).toBe(false);
  });
});
