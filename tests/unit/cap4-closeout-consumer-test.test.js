// CAP-4 CLOSEOUT — the consumer test, fixture-form run.
//
// Census element 4 (frozen) designs the consumer test: an agent
// holding only this connection attempts Stripe's whole project
// scope in five phases (A–E); every step scores PASS / GUIDED /
// NO-DISPOSITIONED / FAIL under the frozen rules in
// tests/helpers/consumer-test.js, and the test passes as a whole
// only with zero FAILs. The live run belongs to CAP-5: it is
// executed at a checked release against the deployed server, in
// TEST for A–D and on the owner's LIVE-consented connection for
// E. This suite is NOT that run and claims none of its scores.
//
// What this suite does:
//   * pins the frozen step table (27 steps, Phases A–E, in the
//     frozen order) so the instrument CAP-5 runs cannot drift;
//   * proves the scorer implements the frozen pass/fail shape,
//     including the success-without-read-back FAIL, the
//     wrong-reason FAIL, and the cross-unit asymmetry;
//   * runs the instrument in fixture form against this tree:
//     every step's named surfaces are probed (registry presence +
//     Full-profile admission — the consumer holds an ordinary
//     Full grant), guided steps resolve their guided form, and
//     handler-probe steps execute their primary read against a
//     fake provider with read-back. The fixture verdicts are
//     reported in fixture terms (FIXTURE-PASS / FIXTURE-GUIDED /
//     SURFACE-ONLY / NOT-RUN / FIXTURE-FAIL); a fixture FAIL is a
//     FAIL, named with its owning card — never massaged. Only
//     FIXTURE-PASS and FIXTURE-GUIDED steps have any fixture
//     claim at all; SURFACE-ONLY and NOT-RUN steps are CAP-5's
//     work, listed as such.
import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {DASHBOARD_SETTINGS,whereIsSetting}
  from '../../src/data/dashboard-map.js';
import {CONSUMER_STEPS,scoreStep,summarize}
  from '../helpers/consumer-test.js';

const parse=r=>JSON.parse(r.content[0].text);
const page=data=>({data,has_more:false});
const ACCT='acct_CTFAKE';

// --- The frozen table ---------------------------------------------------
describe('CAP-4 consumer test — the frozen step table',()=>{
  it('carries exactly the 27 frozen steps, Phases A–E, in order',()=>{
    expect(CONSUMER_STEPS.map(s=>s.id)).toEqual([
      'A1','A2','A3','A4','A5','A6',
      'B1','B2','B3','B4','B5','B6',
      'C1','C2','C3','C4',
      'D1','D2','D3','D4','D5','D6',
      'E1','E2','E3','E4','E5']);
    for(const s of CONSUMER_STEPS){
      expect(s.phase,s.id).toBe(s.id[0]);
      expect(s.text.length,s.id).toBeGreaterThan(20);
      expect(s.owning,s.id).toBeTruthy();
      expect(['cap5-test','cap5-live','cap5-owner'],s.id)
        .toContain(s.execClass);
      expect(['handler','guided','surface','none'],s.id)
        .toContain(s.probe);
      expect(s.tools.length,s.id).toBeGreaterThan(0);
    }
  });
  it('phases A–D execute in TEST under CAP-5; D1 and Phase E carry the LIVE/owner classes',()=>{
    for(const s of CONSUMER_STEPS){
      if(s.phase==='E')expect(s.execClass,s.id).not.toBe('cap5-test');
      else if(s.id==='D1')expect(s.execClass).toBe('cap5-live');
      else if(s.id==='C2')expect(s.execClass).toBe('cap5-owner');
      else expect(s.execClass,s.id).toBe('cap5-test');
    }
  });
});

// --- The frozen scorer ----------------------------------------------------
describe('CAP-4 consumer test — the scorer implements the frozen shape',()=>{
  it('PASS requires completion through the connection with read-back',()=>{
    expect(scoreStep({completed:true,readBack:true})).toBe('PASS');
    expect(scoreStep({completed:true,readBack:false})).toBe('FAIL');
    expect(scoreStep({completed:true})).toBe('FAIL');
  });
  it('GUIDED is the guided form completed with read-back, and counts as served',()=>{
    expect(scoreStep({completed:true,viaGuided:true,readBack:true}))
      .toBe('GUIDED');
    expect(scoreStep({completed:true,viaGuided:true,readBack:false}))
      .toBe('FAIL');
  });
  it('a "no" with a named disposition scores NO-DISPOSITIONED',()=>{
    for(const kind of ['provider-impossible','deliberately-out'])
      expect(scoreStep({completed:false,
        disposition:{kind,record:'named'}})).toBe('NO-DISPOSITIONED');
  });
  it('a refusal whose reason is wrong is a FAIL even with a disposition',()=>{
    expect(scoreStep({completed:false,refusalReasonTrue:false,
      disposition:{kind:'deliberately-out',record:'named'}}))
      .toBe('FAIL');
  });
  it('a "no" with no disposition, and a silent refusal, are FAILs',()=>{
    expect(scoreStep({completed:false})).toBe('FAIL');
    expect(scoreStep({completed:false,disposition:null})).toBe('FAIL');
  });
  it('the asymmetry: other-unit ownership scores only when that unit\u2019s record carries the step',()=>{
    const base={completed:false,
      disposition:{kind:'other-unit',record:'named unit'}};
    expect(scoreStep({...base,owningRecordCarriesStep:true}))
      .toBe('NO-DISPOSITIONED');
    expect(scoreStep({...base,owningRecordCarriesStep:false}))
      .toBe('FAIL');
    expect(scoreStep(base)).toBe('FAIL');
  });
  it('the whole test passes only with zero FAILs; counts are reported, never averaged',()=>{
    const ok=summarize(['PASS','GUIDED','NO-DISPOSITIONED','PASS']);
    expect(ok).toEqual({counts:{PASS:2,GUIDED:1,
      'NO-DISPOSITIONED':1,FAIL:0},total:4,passes:true});
    const bad=summarize(['PASS','PASS','PASS','FAIL']);
    expect(bad.passes).toBe(false);
    expect(bad.counts.FAIL).toBe(1);
  });
});

// --- Fixture-form run -------------------------------------------------------
// Fake provider for the handler-probe steps. Shapes follow the
// owning families' own suites (D-7 account, D-5 portal, test
// clocks, customers, D-6 report types).
const verified={accounts:{retrieve:async()=>({object:'account',
    id:ACCT,livemode:false})},
  balance:{retrieve:async()=>({object:'balance',livemode:false})}};
const sdk={
  ...verified,
  accounts:{retrieve:async()=>({object:'account',id:ACCT,
    livemode:false,country:'US',default_currency:'usd',
    charges_enabled:true,payouts_enabled:true,details_submitted:true,
    email:'owner@example.test',
    requirements:{currently_due:['company.tax_id'],past_due:[],
      pending_verification:[],eventually_due:[],
      current_deadline:1794000000}})},
  billingPortal:{configurations:{list:async()=>page([{
    id:'bpc_CTFAKE',object:'billing_portal.configuration',
    livemode:false,name:'Default',active:true,is_default:true,
    default_return_url:'https://example.com/return',
    business_profile:{headline:'Acme',
      privacy_policy_url:'https://example.com/privacy',
      terms_of_service_url:'https://example.com/terms'},
    features:{payment_method_update:{enabled:true},
      invoice_history:{enabled:true},
      subscription_cancel:{enabled:false},
      subscription_update:{enabled:true}}}])}},
  testHelpers:{testClocks:{list:async()=>page([{
    id:'clock_CTFAKE',object:'test_helpers.test_clock',
    name:'Consumer fixture clock',frozen_time:1790000000,
    status:'ready',livemode:false,deletes_after:1790200000}])}},
  customers:{search:async()=>page([{id:'cus_CTFAKE',
    object:'customer',livemode:false,deleted:false,
    name:'Fixture Person',email:'fixture@example.test',
    phone:null,metadata:{},created:1790000000,
    balance:0,currency:'usd',delinquent:false}])},
  reporting:{reportTypes:{list:async()=>page([{
    id:'balance.summary.1',object:'reporting.report_type',
    livemode:false,data_available_start:1680000000,
    data_available_end:1690000000,
    default_columns:['category','net_amount'],
    name:'Balance Summary',version:1}])}},
};
const ctx={connection:{stripeAccount:ACCT,mode:'test',
    profile:'full'},db:createFakeDb({accounts:[{id:ACCT}]}),
  services:{stripeForConnection:async()=>sdk}};

const handlerProbes={
  A1:async()=>{
    const out=parse(await registry.handlers
      .admin_list_requirements({},ctx));
    expect(out).toMatchObject({mode:'test',observed:true,
      totals:{currentlyDue:1}});
  },
  A6:async()=>{
    const out=parse(await registry.handlers
      .portal_list_configurations({},ctx));
    expect(out.data[0]).toMatchObject({id:'bpc_CTFAKE',
      features:{paymentMethodUpdate:true,invoiceHistory:true,
        subscriptionCancel:false}});
  },
  B6:async()=>{
    const out=parse(await registry.handlers.testclock_list({},ctx));
    expect(out.data[0]).toMatchObject({id:'clock_CTFAKE',
      status:'ready'});
  },
  D2:async()=>{
    const out=parse(await registry.handlers
      .customer_find({term:'fixture@example.test'},ctx));
    expect(out.data[0]).toMatchObject({id:'cus_CTFAKE'});
  },
  D6:async()=>{
    const out=parse(await registry.handlers
      .report_list_types({},ctx));
    expect(out.data[0]).toMatchObject({id:'balance.summary.1'});
  },
};

async function fixtureRun(){
  const results=[];
  for(const step of CONSUMER_STEPS){
    const fail=why=>({step:step.id,verdict:'FIXTURE-FAIL',why,
      owning:step.owning});
    // Surface probe — runs for every step, whatever its class:
    // every named tool must exist and admit the consumer's Full
    // profile. A missing link is a fixture FAIL with its owner.
    let surfaceOk=true,why=null;
    for(const name of step.tools){
      const tool=registry.tools.find(t=>t.name===name);
      if(!tool){surfaceOk=false;why=`tool ${name} not registered`;
        break;}
      if(!tool.profiles?.includes('full')){
        surfaceOk=false;
        why=`tool ${name} not admitted on the Full profile`;
        break;}
      if(typeof registry.handlers[name]!=='function'){
        surfaceOk=false;why=`tool ${name} has no handler`;break;}
    }
    if(!surfaceOk){results.push(fail(why));continue;}
    if(step.probe==='guided'){
      const entry=DASHBOARD_SETTINGS[step.guided];
      const lookup=whereIsSetting(step.guided.replaceAll('_',' '));
      if(!entry||!Array.isArray(entry.steps)||
        entry.steps.length<2||lookup.found!==true||
        !lookup.dashboardUrl||lookup.changeMade!==false){
        results.push(fail(`guided form for ${step.guided} does `+
          'not resolve to link + clicks + verification'));
        continue;}
      results.push({step:step.id,verdict:'FIXTURE-GUIDED',
        owning:step.owning});
      continue;}
    if(step.probe==='handler'){
      try{
        await handlerProbes[step.id]();
        results.push({step:step.id,verdict:'FIXTURE-PASS',
          owning:step.owning});
      }catch(e){
        results.push(fail(`handler probe failed: ${e.message}`));}
      continue;}
    if(step.probe==='surface'){
      results.push({step:step.id,verdict:'SURFACE-ONLY',
        owning:step.owning});
      continue;}
    results.push({step:step.id,verdict:'NOT-RUN',
      owning:step.owning});
  }
  return results;
}

describe('CAP-4 consumer test — fixture-form run against this tree',()=>{
  it('reports every step exactly once, in frozen order',async()=>{
    const results=await fixtureRun();
    expect(results.map(r=>r.step)).toEqual(
      CONSUMER_STEPS.map(s=>s.id));
  });
  it('scores zero fixture FAILs',async()=>{
    const results=await fixtureRun();
    const fails=results.filter(r=>r.verdict==='FIXTURE-FAIL');
    expect(fails,JSON.stringify(fails)).toEqual([]);
  });
  it('the handler-probe steps pass in fixture form with read-back',async()=>{
    const results=await fixtureRun();
    for(const id of ['A1','A6','B6','D2','D6'])
      expect(results.find(r=>r.step===id).verdict,id)
        .toBe('FIXTURE-PASS');
  });
  it('the guided steps resolve their guided form in fixture form',async()=>{
    const results=await fixtureRun();
    for(const id of ['A3','A4','C4'])
      expect(results.find(r=>r.step===id).verdict,id)
        .toBe('FIXTURE-GUIDED');
  });
  it('no CAP-5-only step is dressed as a fixture pass',async()=>{
    const results=await fixtureRun();
    // D1 and Phase E are LIVE/owner substance: their fixture
    // verdict is NOT-RUN, and every step CAP-5 must still execute
    // is named with its execution class in the table.
    for(const id of ['D1','E1','E2','E3'])
      expect(results.find(r=>r.step===id).verdict,id)
        .toBe('NOT-RUN');
    for(const s of CONSUMER_STEPS)
      expect(s.execClass,s.id).toBeTruthy();
    const counts={};
    for(const r of results)
      counts[r.verdict]=(counts[r.verdict]??0)+1;
    // The fixture report, stated plainly: 5 FIXTURE-PASS,
    // 3 FIXTURE-GUIDED, 15 SURFACE-ONLY, 4 NOT-RUN, 0 FAIL.
    expect(counts).toEqual({'FIXTURE-PASS':5,'FIXTURE-GUIDED':3,
      'SURFACE-ONLY':15,'NOT-RUN':4});
  });
});
