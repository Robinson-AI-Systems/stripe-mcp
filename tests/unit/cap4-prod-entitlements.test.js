// CAP-4 PROD-ENTITLEMENTS — entitled-product coverage completion.
// This suite pins the facts the unit's dispositions rest on,
// re-derived at this baseline:
//
//   * the pinned catalog's CAP-4 area (entitlements,
//     product_catalog, products, prices) is exactly 25
//     operations; the catalog as a whole is 559 operations
//     with zero /v2/ paths and zero commerce paths — the
//     three claimed v2 commerce import operations cannot be
//     named by the server's machinery (fleet v2 rule, ruling
//     3(iv); PROD-BILLING #341 / PROD-EVENTS #342 disposition
//     (a) inherited);
//   * every area POST/DELETE carries exactly one D-9
//     classification row, all native-owns / catalog;
//   * the two claimed v1 list reads are native and projected
//     (E-2: feature_list, entitlement_list_active) with exact
//     field sets and wrong-mode refusal;
//   * the two claimed v1 by-id GETs have no native read; the
//     guarded universal read serves them with per-object mode
//     verification in both modes and both wrong-mode
//     directions (the interim route the disposition records);
//   * the reason no native by-id read is built in this unit:
//     the everyday catalog stands at exactly 19,999 / 20,000
//     tokens with zero headroom, and the leanest honest forms
//     of the two candidate reads — measured here with the
//     real budget evaluator, exactly as they would be added
//     to catalog-extras' specsRead — cost +78 / +84 tokens
//     each and break the cap on their own. The builds are
//     blocked on the budget, flagged for a coordinator
//     ruling, not silently converted to a door claim.
//
// Baseline accounting: every test in this suite passes at
// pristine baseline c27de601 by design. This unit changes
// no source behavior; the pins make the dispositions rest
// on re-runnable facts rather than prose.
import {describe,it,expect} from 'vitest';
import {catalog} from '../../src/stripe/openapi-index.js';
import {UNIVERSAL_WRITE_TABLE}
  from '../../src/stripe/universal-classification.js';
import {handlers} from '../../src/tools/universal.js';
import {registry} from '../../src/tools/index.js';
import {evaluateBudgets} from '../../scripts/check-budgets.mjs';

const fam=p=>
  /^\/v1\/entitlements(\/|$)/.test(p)?'entitlements':
  /^\/v1\/product_catalog(\/|$)/.test(p)?'product_catalog':
  /^\/v1\/products(\/|$)/.test(p)?'products':
  /^\/v1\/prices(\/|$)/.test(p)?'prices':null;
const allOps=[...catalog().operations.values()];
const areaOps=allOps.filter(o=>fam(o.path));
const key=o=>o.method+' '+o.path;

const EXPECTED=[
  'GET /v1/entitlements/active_entitlements',
  'GET /v1/entitlements/active_entitlements/{id}',
  'GET /v1/entitlements/features',
  'GET /v1/entitlements/features/{id}',
  'POST /v1/entitlements/features',
  'POST /v1/entitlements/features/{id}',
  'GET /v1/product_catalog/trial_offers',
  'GET /v1/product_catalog/trial_offers/{id}',
  'POST /v1/product_catalog/trial_offers',
  'POST /v1/product_catalog/trial_offers/{id}',
  'DELETE /v1/products/{id}',
  'DELETE /v1/products/{product}/features/{id}',
  'GET /v1/products',
  'GET /v1/products/{id}',
  'GET /v1/products/{product}/features',
  'GET /v1/products/{product}/features/{id}',
  'GET /v1/products/search',
  'POST /v1/products',
  'POST /v1/products/{id}',
  'POST /v1/products/{product}/features',
  'GET /v1/prices',
  'GET /v1/prices/{price}',
  'GET /v1/prices/search',
  'POST /v1/prices',
  'POST /v1/prices/{price}'
];
const rowFor=k=>{
  const [method,...rest]=k.split(' '),path=rest.join(' ');
  return UNIVERSAL_WRITE_TABLE.filter(
    r=>r.method===method&&r.path===path);
};

describe('CAP-4 PROD-ENTITLEMENTS — the sweep set',()=>{
  it('the pinned catalog stands at 559 operations with zero /v2/ and zero commerce paths',()=>{
    expect(allOps).toHaveLength(559);
    expect(allOps.filter(o=>o.path.startsWith('/v2/'))).toHaveLength(0);
    expect(allOps.filter(o=>o.path.includes('commerce'))).toHaveLength(0);
  });
  it('the area is exactly the 25 operations across the four families',()=>{
    expect(areaOps.map(key).sort()).toEqual([...EXPECTED].sort());
    expect(areaOps.filter(o=>o.method==='GET')).toHaveLength(14);
  });
  it('every area POST/DELETE has exactly one D-9 row: native-owns, catalog family',()=>{
    const writes=areaOps.filter(o=>o.method!=='GET');
    expect(writes).toHaveLength(11);
    for(const o of writes){
      const rows=rowFor(key(o));
      expect(rows,key(o)).toHaveLength(1);
      expect(rows[0].disposition,key(o)).toBe('native-owns');
      expect(rows[0].family,key(o)).toBe('catalog');
    }
  });
  it('registers the native entitlement and catalog reads; the registry stands at 344',()=>{
    const names=registry.tools.map(t=>t.name);
    for(const n of ['feature_list','feature_list_for_product',
      'entitlement_list_active','feature_create',
      'feature_attach_to_product','feature_detach_from_product',
      'product_list','product_get','product_search',
      'price_list','price_get','price_search'])
      expect(names,n).toContain(n);
    expect(registry.tools).toHaveLength(344);
  });
  it('no native by-id entitlement read exists at this baseline (the blocked builds)',()=>{
    const names=registry.tools.map(t=>t.name);
    expect(names).not.toContain('feature_get');
    expect(names).not.toContain('entitlement_get_active');
  });
});

describe('CAP-4 PROD-ENTITLEMENTS — the budget fact the blocked builds rest on',()=>{
  const sid=prefix=>({type:'string',
    pattern:'^'+prefix+'_[A-Za-z0-9_]{2,100}$'});
  const candidate=(name,props,required)=>({
    name,area:'catalog',profiles:['read_only','everyday','full'],
    writes:false,detailFieldsSupported:false,
    annotations:{readOnlyHint:true},
    description:name.replaceAll('_',' '),
    inputSchema:{type:'object',properties:props,
      ...(required.length?{required}:{}),
      additionalProperties:false}});
  it('the everyday catalog stands at exactly 19,999 tokens with no failures',()=>{
    const {failures,counts}=evaluateBudgets(registry);
    expect(failures).toEqual([]);
    expect(counts.everyday).toBe(19999);
  });
  it('the leanest honest feature_get alone breaks the everyday cap (+78)',()=>{
    const {failures,counts}=evaluateBudgets({tools:[
      ...registry.tools,
      candidate('feature_get',{featureId:sid('feat')},['featureId'])]});
    expect(counts.everyday).toBe(20077);
    expect(failures).toContain('Everyday catalog >=20000 tokens');
  });
  it('the leanest honest entitlement_get_active alone breaks the everyday cap (+84)',()=>{
    const {failures,counts}=evaluateBudgets({tools:[
      ...registry.tools,
      candidate('entitlement_get_active',
        {entitlementId:sid('ent')},['entitlementId'])]});
    expect(counts.everyday).toBe(20083);
    expect(failures).toContain('Everyday catalog >=20000 tokens');
  });
});

// The existing native reads (E-2, catalog-extras): exact
// projected field sets and the shared safe() wrong-mode
// refusal, exercised through the registry handlers on a
// TEST connection with a fake SDK (the E-2 fixture shape).
const acct='acct_PRODENT';
const parse=r=>{try{return JSON.parse(r.content[0].text);}
  catch{return r.content[0].text;}};
function nativeCtx(providerLive){
  const sdk={entitlements:{
    features:{list:async()=>({data:[{id:'feat_ENT1',
      object:'entitlements.feature',livemode:providerLive,
      lookup_key:'premium-access',name:'Premium',active:true,
      metadata:{}}],has_more:false})},
    activeEntitlements:{list:async()=>({data:[{id:'ent_ENT1',
      object:'entitlements.active_entitlement',
      livemode:providerLive,feature:'feat_ENT1',
      lookup_key:'premium-access'}],has_more:false})}}};
  return {connection:{mode:'test',profile:'full',
    stripeAccount:acct},
    services:{stripeForConnection:async()=>sdk}};
}

describe('CAP-4 PROD-ENTITLEMENTS — native entitlement reads are projected and mode-aware',()=>{
  it('feature_list serves the exact projected field set',async()=>{
    const r=parse(await registry.handlers.feature_list(
      {},nativeCtx(false)));
    expect(Object.keys(r.data[0]).sort()).toEqual(
      ['active','id','lookupKey','name']);
    expect(r.data[0]).toMatchObject({id:'feat_ENT1',
      lookupKey:'premium-access'});
  });
  it('entitlement_list_active serves the exact projected field set',async()=>{
    const r=parse(await registry.handlers.entitlement_list_active(
      {customerId:'cus_ENT1'},nativeCtx(false)));
    expect(Object.keys(r.data[0]).sort()).toEqual(
      ['feature','id','lookupKey']);
    expect(r.data[0]).toMatchObject({id:'ent_ENT1',
      feature:'feat_ENT1',lookupKey:'premium-access'});
  });
  it('both reads refuse a wrong-mode provider object',async()=>{
    const f=await registry.handlers.feature_list(
      {},nativeCtx(true));
    expect(f.isError).toBe(true);
    const a=await registry.handlers.entitlement_list_active(
      {customerId:'cus_ENT1'},nativeCtx(true));
    expect(a.isError).toBe(true);
  });
});

// The door harness (PROD-TAX's shape): api_read resolves the
// operation from the pinned catalog and calls the provider
// through rawRequest; the door mode-verifies the returned
// object against the connection. These pins prove the
// interim route the by-id dispositions record.
function doorCtx(mode,fixture){
  const calls=[];
  const stripe={rawRequest:async(method,path)=>{
    calls.push({method,path});
    return JSON.parse(JSON.stringify(fixture));}};
  return {calls,ctx:{connection:{mode,profile:'full',
    stripeAccount:acct},
    services:{stripeForConnection:async()=>stripe}}};
}
const feat=livemode=>({id:'feat_ENT1',
  object:'entitlements.feature',livemode,
  lookup_key:'premium-access',name:'Premium',active:true,
  metadata:{}});
const actEnt=livemode=>({id:'ent_ENT1',
  object:'entitlements.active_entitlement',livemode,
  feature:'feat_ENT1',lookup_key:'premium-access'});
const MODE_ERR='Provider response does not match authenticated account mode';

describe('CAP-4 PROD-ENTITLEMENTS — door-served by-id GETs are mode-verified',()=>{
  it('serves GET /v1/entitlements/features/{id} mode-matched in TEST and LIVE',async()=>{
    for(const [mode,fx] of [['test',feat(false)],['live',feat(true)]]){
      const {ctx:c,calls}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetEntitlementsFeaturesId',pathParams:{id:'feat_ENT1'}},c));
      expect(r.operationId).toBe('GetEntitlementsFeaturesId');
      expect(calls).toHaveLength(1);
    }
  });
  it('refuses GET /v1/entitlements/features/{id} wrong-mode in both directions',async()=>{
    for(const [mode,fx] of [['test',feat(true)],['live',feat(false)]]){
      const {ctx:c}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetEntitlementsFeaturesId',pathParams:{id:'feat_ENT1'}},c));
      expect(r).toBe(MODE_ERR);
    }
  });
  it('serves GET /v1/entitlements/active_entitlements/{id} mode-matched in TEST and LIVE',async()=>{
    for(const [mode,fx] of [['test',actEnt(false)],['live',actEnt(true)]]){
      const {ctx:c,calls}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetEntitlementsActiveEntitlementsId',
          pathParams:{id:'ent_ENT1'}},c));
      expect(r.operationId).toBe('GetEntitlementsActiveEntitlementsId');
      expect(calls).toHaveLength(1);
    }
  });
  it('refuses GET /v1/entitlements/active_entitlements/{id} wrong-mode in both directions',async()=>{
    for(const [mode,fx] of [['test',actEnt(true)],['live',actEnt(false)]]){
      const {ctx:c}=doorCtx(mode,fx);
      const r=parse(await handlers.api_read(
        {op:'GetEntitlementsActiveEntitlementsId',
          pathParams:{id:'ent_ENT1'}},c));
      expect(r).toBe(MODE_ERR);
    }
  });
});
