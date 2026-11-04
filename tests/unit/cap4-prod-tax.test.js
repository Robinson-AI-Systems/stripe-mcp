// CAP-4 PROD-TAX — Tax-area closure (verification card; zero
// census operations claimed, deliberately). This suite pins the
// facts the closure rests on, re-derived at this baseline:
//
//   * the pinned catalog's Tax area is exactly 31 operations
//     across the four census families (tax, tax_codes, tax_ids
//     including the customer-scoped rows, tax_rates);
//   * every Tax POST/DELETE carries exactly one D-9
//     classification row — six allow (the two tax_rates rows
//     are the whitelist baseline rows) and seven native-owns
//     (the tax family owns calculations and the two
//     transaction creates; the customer family owns the
//     tax_ids writes);
//   * the native tools those dispositions name are registered
//     (19 tax-named tools; the registry stands at 343);
//   * the door serves the Tax GETs no native tool governs —
//     per-object mode verification proven here in both modes
//     and both wrong-mode directions on two representative
//     rows (registrations/{id}, tax_ids/{id});
//   * the native Tax reads execute on a LIVE connection
//     through the verified seam — the gap-fill legs: the E-4
//     suite (final-native-e4.test.js, "rejects wrong provider
//     mode and refuses tax calculation based on non-mode
//     matching fixture") proves the TEST-connection direction
//     for the shared safe() projection, but no test exercised
//     a tax-native read through the LIVE client route. The
//     two legs below prove it serves a LIVE object and
//     refuses a TEST object on a LIVE connection.
//
// Baseline accounting: every test in this suite passes at
// pristine baseline 31850422 by design. This unit changes no
// behavior; the pins (and the two LIVE legs, which fill a
// test-coverage gap in already-correct behavior) make the
// closure rest on re-runnable facts rather than prose.
import {describe,it,expect,vi,afterEach} from 'vitest';
import {catalog} from '../../src/stripe/openapi-index.js';
import {UNIVERSAL_WRITE_TABLE}
  from '../../src/stripe/universal-classification.js';
import {handlers} from '../../src/tools/universal.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

afterEach(()=>vi.unstubAllEnvs());

const fam=p=>
  /^\/v1\/tax(\/|$)/.test(p)?'tax':
  /^\/v1\/tax_codes(\/|$)/.test(p)?'tax_codes':
  /^\/v1\/tax_ids(\/|$)/.test(p)?'tax_ids':
  /^\/v1\/tax_rates(\/|$)/.test(p)?'tax_rates':
  /^\/v1\/customers\/\{customer\}\/tax_ids(\/|$)/.test(p)?
    'tax_ids (customer-scoped)':null;
const allOps=[...catalog().operations.values()];
const taxOps=allOps.filter(o=>fam(o.path));
const key=o=>o.method+' '+o.path;

const EXPECTED=[
  'GET /v1/tax/associations/find',
  'POST /v1/tax/calculations',
  'GET /v1/tax/calculations/{calculation}',
  'GET /v1/tax/calculations/{calculation}/line_items',
  'GET /v1/tax/locations',
  'POST /v1/tax/locations',
  'GET /v1/tax/locations/{location}',
  'GET /v1/tax/registrations',
  'POST /v1/tax/registrations',
  'GET /v1/tax/registrations/{id}',
  'POST /v1/tax/registrations/{id}',
  'GET /v1/tax/settings',
  'POST /v1/tax/settings',
  'GET /v1/tax/transactions/{transaction}',
  'GET /v1/tax/transactions/{transaction}/line_items',
  'POST /v1/tax/transactions/create_from_calculation',
  'POST /v1/tax/transactions/create_reversal',
  'GET /v1/tax_codes',
  'GET /v1/tax_codes/{id}',
  'GET /v1/tax_ids',
  'POST /v1/tax_ids',
  'DELETE /v1/tax_ids/{id}',
  'GET /v1/tax_ids/{id}',
  'GET /v1/customers/{customer}/tax_ids',
  'POST /v1/customers/{customer}/tax_ids',
  'DELETE /v1/customers/{customer}/tax_ids/{id}',
  'GET /v1/customers/{customer}/tax_ids/{id}',
  'GET /v1/tax_rates',
  'POST /v1/tax_rates',
  'GET /v1/tax_rates/{tax_rate}',
  'POST /v1/tax_rates/{tax_rate}'
];
const ALLOW=new Map([
  ['POST /v1/tax/locations','create'],
  ['POST /v1/tax/registrations','create'],
  ['POST /v1/tax/registrations/{id}','update'],
  ['POST /v1/tax/settings','settings'],
  ['POST /v1/tax_rates','create'],
  ['POST /v1/tax_rates/{tax_rate}','update']
]);
const NATIVE_OWNS=new Map([
  ['POST /v1/tax/calculations','tax'],
  ['POST /v1/tax/transactions/create_from_calculation','tax'],
  ['POST /v1/tax/transactions/create_reversal','tax'],
  ['POST /v1/tax_ids','customer'],
  ['DELETE /v1/tax_ids/{id}','customer'],
  ['POST /v1/customers/{customer}/tax_ids','customer'],
  ['DELETE /v1/customers/{customer}/tax_ids/{id}','customer']
]);
const rowFor=k=>{
  const [method,...rest]=k.split(' '),path=rest.join(' ');
  return UNIVERSAL_WRITE_TABLE.filter(
    r=>r.method===method&&r.path===path);
};

describe('CAP-4 PROD-TAX — the sweep set',()=>{
  it('the pinned catalog Tax area is exactly the 31 operations',()=>{
    expect(taxOps.map(key).sort()).toEqual([...EXPECTED].sort());
    expect(taxOps.filter(o=>o.method==='GET')).toHaveLength(18);
  });
  it('every Tax POST/DELETE has exactly one D-9 classification row',()=>{
    const writes=taxOps.filter(o=>o.method!=='GET');
    expect(writes).toHaveLength(13);
    for(const o of writes)expect(rowFor(key(o)),key(o)).toHaveLength(1);
  });
  it('the six allow rows match the card trace (registrations, settings, locations, tax rates)',()=>{
    for(const [k,kind] of ALLOW){
      const [row]=rowFor(k);
      expect(row.disposition,k).toBe('allow');
      expect(row.kind,k).toBe(kind);
    }
  });
  it('the seven native-owns rows name the owning family (tax for calculations/transactions, customer for tax_ids)',()=>{
    for(const [k,family] of NATIVE_OWNS){
      const [row]=rowFor(k);
      expect(row.disposition,k).toBe('native-owns');
      expect(row.family,k).toBe(family);
    }
  });
  it('the two tax_rates rows are the whitelist baseline rows',()=>{
    for(const k of ['POST /v1/tax_rates','POST /v1/tax_rates/{tax_rate}']){
      const [row]=rowFor(k);
      expect(row.baseline,k).toBe(true);
    }
  });
  it('registers all 19 tax-named native tools; the registry stands at 343',()=>{
    const names=registry.tools.map(t=>t.name);
    for(const n of ['tax_get_settings','tax_calculate',
      'tax_list_registrations','tax_list_transactions',
      'tax_get_transaction','tax_list_codes','tax_get_code',
      'tax_update_settings','tax_add_registration',
      'tax_end_registration','tax_record_transaction',
      'tax_reverse_transaction','taxrate_list','taxrate_get',
      'taxrate_create','taxrate_update','customer_list_tax_ids',
      'customer_add_tax_id','customer_delete_tax_id'])
      expect(names,n).toContain(n);
    expect(registry.tools).toHaveLength(343);
  });
});

// The door harness (PROD-PAYMENT's shape): api_read resolves the
// operation from the pinned catalog and calls the provider
// through rawRequest; the door mode-verifies the returned
// object against the connection.
const acct='acct_PRODTAX';
const parse=r=>{try{return JSON.parse(r.content[0].text);}
  catch{return r.content[0].text;}};
function doorCtx(mode,fixture){
  const calls=[];
  const stripe={rawRequest:async(method,path)=>{
    calls.push({method,path});
    return JSON.parse(JSON.stringify(fixture));}};
  return {calls,ctx:{connection:{mode,profile:'full',
    stripeAccount:acct},
    services:{stripeForConnection:async()=>stripe}}};
}
const reg=(livemode)=>({id:'taxreg_PRODTAX',
  object:'tax.registration',livemode,status:'active',
  country:'US',active_from:1700000000});
const tid=(livemode)=>({id:'txi_PRODTAX',object:'tax_id',
  livemode,type:'eu_vat',value:'DE123456789',
  owner:{type:'account'}});
const MODE_ERR='Provider response does not match authenticated account mode';

describe('CAP-4 PROD-TAX — door-served Tax GETs are mode-verified',()=>{
  it('serves GET /v1/tax/registrations/{id} mode-matched in TEST and LIVE',async()=>{
    for(const [mode,fx] of [['test',reg(false)],['live',reg(true)]]){
      const {ctx:c,calls}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetTaxRegistrationsId',pathParams:{id:'taxreg_PRODTAX'}},c));
      expect(r.operationId).toBe('GetTaxRegistrationsId');
      expect(calls).toHaveLength(1);
    }
  });
  it('refuses GET /v1/tax/registrations/{id} wrong-mode in both directions',async()=>{
    for(const [mode,fx] of [['test',reg(true)],['live',reg(false)]]){
      const {ctx:c}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetTaxRegistrationsId',pathParams:{id:'taxreg_PRODTAX'}},c));
      expect(r).toBe(MODE_ERR);
    }
  });
  it('serves GET /v1/tax_ids/{id} mode-matched in TEST and LIVE',async()=>{
    for(const [mode,fx] of [['test',tid(false)],['live',tid(true)]]){
      const {ctx:c,calls}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetTaxIdsId',pathParams:{id:'txi_PRODTAX'}},c));
      expect(r.operationId).toBe('GetTaxIdsId');
      expect(calls).toHaveLength(1);
    }
  });
  it('refuses GET /v1/tax_ids/{id} wrong-mode in both directions',async()=>{
    for(const [mode,fx] of [['test',tid(true)],['live',tid(false)]]){
      const {ctx:c}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetTaxIdsId',pathParams:{id:'txi_PRODTAX'}},c));
      expect(r).toBe(MODE_ERR);
    }
  });
});

// The gap-fill legs: a tax-native read through the LIVE client
// route (selectedAccountClient: production deployment, an
// independently enabled + connected account, and the verified
// LIVE account/balance read before any object is touched).
function liveCtx(providerLive){
  vi.stubEnv('VERCEL_ENV','production');
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    tax:{settings:{retrieve:async()=>({id:null,
      object:'tax.settings',livemode:providerLive,
      defaults:{tax_behavior:'exclusive',tax_code:'txcd_ABC123'},
      head_office:{address:{country:'US'}}})}}};
  const db=createFakeDb({accounts:[{id:acct,label:'PROD-TAX',
    live_enabled:true,live_connected:true}]});
  return {db,connection:{stripeAccount:acct,mode:'live',
    profile:'full'},connectionId:'prodtax-live',
    services:{stripeForConnection:async()=>sdk}};
}

describe('CAP-4 PROD-TAX — native Tax reads on a LIVE connection (gap-fill)',()=>{
  it('tax_get_settings serves a LIVE object on a LIVE connection',async()=>{
    const r=await registry.handlers.tax_get_settings({},liveCtx(true));
    expect(r.isError).not.toBe(true);
    expect(JSON.parse(r.content[0].text).livemode).toBe(true);
  });
  it('tax_get_settings refuses a TEST object on a LIVE connection',async()=>{
    const r=await registry.handlers.tax_get_settings({},liveCtx(false));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain(
      'did not prove selected account/mode');
  });
});
