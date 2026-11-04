import {describe,it,expect} from 'vitest';
import {catalog,getOperation} from '../../src/stripe/openapi-index.js';
import {classifyUniversalWrite,companionGet}
  from '../../src/stripe/universal-policy.js';
import {UNIVERSAL_WRITE_TABLE,classificationFor}
  from '../../src/stripe/universal-classification.js';
import {financialDecision} from '../../src/stripe/money-operations.js';
import {preferredNative} from '../../src/stripe/hand-built-map.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

// CAP-4 D-9: the universal door, classified. The table is the unit.
const GENERIC='Operation needs provider-specific ownership/cost classification and original readback; currently a tracked capability gap, not a permanent end-user restriction';
const FINANCIAL='Financial or unclassified money-moving operation requires an original provider-derived amount and separate owner approval; this is an unimplemented capability, not permanent user policy';
const transfer=/(?:^|\/)(?:refunds|payouts|transfers|topups|treasury|issuing|credit_notes|credit_grants|payment_intents|charges|outbound_payments)(?:\/|$)/;
const allOps=[...catalog().operations.values()];
const writeOps=allOps.filter(o=>['POST','DELETE'].includes(o.method));
const moneyOps=writeOps.filter(o=>transfer.test(o.path));
const tableOps=writeOps.filter(o=>!transfer.test(o.path));
const byId=id=>getOperation(id);
const classify=(op,opts={})=>classifyUniversalWrite(op,{},{
  metadataOnly:false,moneyLike:financialDecision(op,{}).financial,...opts});

describe('CAP-4 D-9 classification table — completeness and drift',()=>{
  it('partitions the pinned POST/DELETE catalog exactly: 307 = 92 money + 215 rows',()=>{
    expect(writeOps).toHaveLength(307);
    expect(moneyOps).toHaveLength(92);
    expect(UNIVERSAL_WRITE_TABLE).toHaveLength(215);
    expect(tableOps).toHaveLength(215);
  });
  it('every non-money pinned POST/DELETE operation has exactly one row; every row is a real pinned operation',()=>{
    const seen=new Map();
    for(const row of UNIVERSAL_WRITE_TABLE){
      const key=row.method+' '+row.path;
      expect(seen.has(key),key).toBe(false);
      seen.set(key,row);
      const op=allOps.find(o=>o.method===row.method&&o.path===row.path);
      expect(op,key).toBeDefined();
      expect(op.id).toBe(row.operationId);
    }
    for(const op of tableOps)
      expect(seen.has(op.method+' '+op.path),
        op.method+' '+op.path).toBe(true);
    for(const op of moneyOps)
      expect(seen.has(op.method+' '+op.path),
        op.method+' '+op.path).toBe(false);
  });
  it('every row names ownership, cost, secret, read-back and a disposition; refusal rows carry their class reason',()=>{
    for(const row of UNIVERSAL_WRITE_TABLE){
      expect(row.ownership,row.operationId).toBeTruthy();
      expect(row.cost,row.operationId).toBeTruthy();
      expect(row.secret,row.operationId).toBeTruthy();
      expect(row).toHaveProperty('readback');
      expect(row.disposition,row.operationId).toBeTruthy();
      if(row.disposition==='allow'){
        expect(['create','update','delete','action','settings'],
          row.operationId).toContain(row.kind);
      }else{
        expect(typeof row.reason,row.operationId).toBe('string');
        expect(row.reason.length,row.operationId).toBeGreaterThan(20);
        expect(row.reason).not.toBe(GENERIC);
      }
    }
  });
  it('every generic-allow row names a read-back route that exists as a pinned GET',()=>{
    const getPaths=new Set(allOps.filter(o=>o.method==='GET').map(o=>o.path));
    for(const row of UNIVERSAL_WRITE_TABLE.filter(r=>r.disposition==='allow')){
      expect(row.readback,row.operationId).toBeTruthy();
      expect(getPaths.has(row.readback),row.operationId).toBe(true);
    }
  });
  it('redirect rows name exactly the native tool preferredNative names (14)',()=>{
    const redirects=UNIVERSAL_WRITE_TABLE.filter(r=>r.redirect);
    expect(redirects).toHaveLength(14);
    for(const row of redirects){
      const op=allOps.find(o=>o.id===row.operationId);
      expect(preferredNative(op),row.operationId).toBe(row.nativeTool);
    }
  });
  it('the old generic reason is absent from every in-scope refusal, under both moneyLike settings',()=>{
    for(const op of writeOps){
      for(const moneyLike of [false,true]){
        const policy=classifyUniversalWrite(op,{},{
          metadataOnly:false,moneyLike});
        if(!policy.allowed)expect(policy.reason,op.id).not.toBe(GENERIC);
      }
    }
  });
  it('the 92 financial rows keep their baseline refusal byte-identically',()=>{
    for(const op of moneyOps){
      expect(classify(op).reason,op.id).toBe(FINANCIAL);
      expect(classifyUniversalWrite(op,{},{
        metadataOnly:false,moneyLike:false}).reason,op.id).toBe(FINANCIAL);
    }
  });
});

describe('CAP-4 D-9 classifier behavior per disposition class',()=>{
  it('generic-allow rows pass under the contract, one per kind, and the money heuristic does not veto a classified row',()=>{
    const cases={
      PostTerminalReaders:'create',PostTerminalConfigurations:'create',
      PostTerminalConfigurationsConfiguration:'update',
      DeleteTerminalConfigurationsConfiguration:'delete',
      PostBillingMeters:'create',PostBillingMetersId:'update',
      PostBillingMetersIdDeactivate:'action',
      PostBillingAlertsIdActivate:'action',
      PostTaxRegistrations:'create',PostTaxSettings:'settings',
      PostRadarValueListItems:'create',PostReviewsReviewApprove:'action'};
    for(const [id,kind] of Object.entries(cases)){
      const op=byId(id);
      for(const moneyLike of [false,true]){
        const policy=classifyUniversalWrite(op,{},{
          metadataOnly:false,moneyLike});
        expect(policy.allowed,id).toBe(true);
        expect(policy.kind,id).toBe(kind);
      }
    }
  });
  it('baseline whitelist rows return byte-identical classifier outputs',()=>{
    const expected={
      PostCoupons:['create','Creates a provider resource; future metered costs may be unknown'],
      PostCouponsCoupon:['update','Updates a Stripe setting and may affect later financial behavior'],
      DeleteCouponsCoupon:['delete','Permanently deletes a resource; this may be irreversible'],
      PostShippingRates:['create','Creates a provider resource; future metered costs may be unknown'],
      PostShippingRatesShippingRateToken:['update','Updates a Stripe setting and may affect later financial behavior'],
      PostTaxRates:['create','Creates a provider resource; future metered costs may be unknown'],
      PostTaxRatesTaxRate:['update','Updates a Stripe setting and may affect later financial behavior'],
      PostTerminalLocations:['create','Creates a provider resource; future metered costs may be unknown'],
      PostTerminalLocationsLocation:['update','Updates a Stripe setting and may affect later financial behavior'],
      DeleteTerminalLocationsLocation:['delete','Permanently deletes a resource; this may be irreversible']};
    for(const [id,[kind,notice]] of Object.entries(expected)){
      const policy=classify(byId(id));
      expect(policy.allowed,id).toBe(true);
      expect(policy.kind,id).toBe(kind);
      expect(policy.notice,id).toBe(notice);
      expect(classificationFor(byId(id))?.baseline,id).toBe(true);
    }
  });
  it('metadata-only updates keep their baseline route, including on a native-owned surface',()=>{
    const op=byId('PostInvoicesInvoice');
    const policy=classifyUniversalWrite(op,{metadata:{memo:'x'}},{
      metadataOnly:true,moneyLike:false});
    expect(policy).toEqual({allowed:true,kind:'update',
      notice:'A verified metadata-only update'});
  });
  it('native-owns rows refuse with a redirect reason naming the owning family or tool',()=>{
    const cases={
      DeleteCustomersCustomer:'customer',
      PostSubscriptionsSubscriptionMigrate:'billing lifecycle',
      PostTaxTransactionsCreateFromCalculation:'tax',
      PostInvoicesCreatePreview:'billing lifecycle',
      PostTestHelpersTestClocks:'TEST-substrate',
      PostPaymentMethodConfigurationsConfiguration:
        'account_update_payment_method_settings',
      PostApplePayDomains:'account_add_apple_pay_domain'};
    for(const [id,fragment] of Object.entries(cases)){
      const policy=classify(byId(id));
      expect(policy.allowed,id).toBe(false);
      expect(policy.reason,id).toContain(fragment);
    }
  });
  it('money-adjacent rows name the row-35 money route',()=>{
    for(const id of ['PostCustomersCustomerBalanceTransactions',
      'PostCustomersCustomerBalanceTransactionsTransaction']){
      const policy=classify(byId(id));
      expect(policy.allowed,id).toBe(false);
      expect(policy.reason).toContain('rows 20/23/35');
      expect(policy.reason).toContain('row-35 customer-balance card');
    }
  });
  it('session/secret-minting rows name the class (tokens also name the card-data rule)',()=>{
    for(const id of ['PostAccountSessions','PostCustomerSessions',
      'PostBillingPortalSessions','PostFinancialConnectionsSessions',
      'PostEphemeralKeys','DeleteEphemeralKeysKey',
      'PostTerminalConnectionTokens','PostTerminalOnboardingLinks']){
      const policy=classify(byId(id));
      expect(policy.allowed,id).toBe(false);
      expect(policy.reason,id).toContain('session/secret-minting class');
    }
    expect(classify(byId('PostTokens')).reason)
      .toContain('Stripe-hosted surfaces');
  });
  it('secret-class rows name census row 36',()=>{
    for(const id of ['PostAppsSecrets','PostAppsSecretsDelete']){
      const policy=classify(byId(id));
      expect(policy.allowed,id).toBe(false);
      expect(policy.reason).toContain('row 36');
    }
  });
  it('third-party rows name the class; payment_records also names its 0/7 read-back',()=>{
    for(const id of ['PostIdentityVerificationSessions',
      'PostFinancialConnectionsAccountsAccountDisconnect',
      'PostThreeDSecureAuthentications','PostClimateOrders',
      'PostForwardingRequests']){
      const policy=classify(byId(id));
      expect(policy.allowed,id).toBe(false);
      expect(policy.reason,id).toContain('third-party subject class');
      expect(policy.reason,id).toContain('until a consumer exists');
    }
    expect(classify(byId('PostPaymentRecordsReportPayment')).reason)
      .toContain('0/7');
  });
  it('payload-shape, no-read-back, device-action, ingestion and other-unit rows serve their class reasons',()=>{
    expect(classify(byId('PostFiles')).reason).toContain('payload-shape');
    for(const id of ['PostInvoiceRenderingTemplatesTemplateArchive',
      'PostInvoiceRenderingTemplatesTemplateUnarchive'])
      expect(classify(byId(id)).reason).toContain('no verifiable read-back');
    expect(classify(byId('PostBalanceSettings')).reason)
      .toContain('livemode marker');
    expect(classify(byId('PostPaymentMethodDomainsPaymentMethodDomainValidate'))
      .reason).toContain('asynchronously');
    expect(classify(byId('PostRadarPaymentEvaluations')).reason)
      .toContain('stateless scoring call');
    expect(classify(byId('PostTerminalReadersReaderProcessPaymentIntent'))
      .reason).toContain('device-action class');
    for(const id of ['PostBillingMeterEvents',
      'PostBillingMeterEventAdjustments']){
      const policy=classify(byId(id));
      expect(policy.allowed,id).toBe(false);
      expect(policy.reason,id).toContain('ingestion class');
      expect(policy.reason,id).toContain('meter_record_usage');
    }
    for(const id of ['PostAppsInstalls','PostAppsInstallsId',
      'PostAppsInstallsIdUninstall'])
      expect(classify(byId(id)).reason).toContain('CAP-3');
  });
  it('companionGet still resolves the terminal create read-back routes',()=>{
    expect(companionGet(byId('PostTerminalReaders')))
      .toBe('/v1/terminal/readers/{reader}');
    expect(companionGet(byId('PostTerminalConfigurations')))
      .toBe('/v1/terminal/configurations/{configuration}');
  });
});

// --- Terminal family end-to-end (the proof family) --------------------------
const A='acct_D9TEST';
const parse=r=>JSON.parse(r.content[0].text);
function terminalFixture(){
  const calls=[],db=createFakeDb({accounts:[{id:A,label:'D9 fixture'}]});
  const store={locations:new Map(),readers:new Map(),configurations:new Map()};
  let seq=0;
  const stripe={rawRequest:async(method,path,params={})=>{
    calls.push({method,path,params});
    const seg=path.split('/').filter(Boolean); // ['v1','terminal',...]
    const kind=seg[2],id=seg[3];
    const coll=store[kind];
    if(!coll)throw new Error('Unexpected provider path '+path);
    if(method==='POST'&&!id){
      const nid=(kind==='locations'?'tml_':kind==='readers'?'tmr_':'tmc_')+
        'D9'+(++seq);
      const obj=kind==='locations'?
        {id:nid,object:'terminal.location',livemode:false,metadata:{},
          display_name:params.display_name,address:params.address}:
        kind==='readers'?
          {id:nid,object:'terminal.reader',livemode:false,metadata:{},
            label:params.label??null,location:params.location??null,
            device_type:'simulated_wisepos_e',serial_number:'SN'+seq,
            status:'offline'}:
          {id:nid,object:'terminal.configuration',livemode:false,
            name:params.name??null};
      coll.set(nid,obj);
      return {...obj};
    }
    const obj=coll.get(id);
    if(!obj)throw Object.assign(new Error('missing'),{statusCode:404});
    if(method==='GET')return {...obj};
    if(method==='POST'){Object.assign(obj,params);return {...obj};}
    if(method==='DELETE'){
      coll.delete(id);
      return {id,object:obj.object,deleted:true,livemode:false};
    }
    throw new Error('Unexpected provider call '+method+' '+path);
  }};
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:A},
    connectionId:'d9-fixture',db,
    services:{stripeForConnection:async()=>stripe}};
  return {db,ctx,calls,store,
    call:args=>registry.handlers.api_write(args,ctx)};
}
const op=id=>byId(id).id;
async function confirmed(f,args,key){
  const preview=parse(await f.call({...args}));
  expect(preview.done).toBe(false);
  expect(preview.needsConfirmation).toBe(true);
  const done=parse(await f.call({...args,confirm:true,requestKey:key}));
  return {preview,done};
}

describe('CAP-4 D-9 terminal family end-to-end through api_write (TEST)',()=>{
  it('location create, update and delete: preview, confirm, read-back',async()=>{
    const f=terminalFixture();
    const created=await confirmed(f,{
      op:op('PostTerminalLocations'),
      body:{display_name:'Greeley depot',address:{line1:'1 Main St',
        city:'Greeley',state:'CO',postal_code:'80631',country:'US'}}},
      'd9-location-create');
    expect(created.done).toMatchObject({done:true,confirmed:true});
    const locId=created.done.resourceId;
    expect(locId).toMatch(/^tml_/);
    expect(f.calls.some(c=>c.method==='GET'&&
      c.path==='/v1/terminal/locations/'+locId)).toBe(true);
    // NB: at this pinned version every scalar field on location
    // update sits behind an anyOf of two string branches, which the
    // pinned validator's union rule rejects as ambiguous at baseline
    // too; the metadata shape is the completable update body.
    const updated=await confirmed(f,{
      op:op('PostTerminalLocationsLocation'),pathParams:{location:locId},
      body:{metadata:{register:'north'}}},'d9-location-update');
    expect(updated.done).toMatchObject({done:true,resourceId:locId});
    expect(f.store.locations.get(locId).metadata)
      .toEqual({register:'north'});
    const deleted=await confirmed(f,{
      op:op('DeleteTerminalLocationsLocation'),
      pathParams:{location:locId}},'d9-location-delete');
    expect(deleted.done).toMatchObject({done:true,resourceId:locId});
    expect(f.store.locations.has(locId)).toBe(false);
  });
  it('reader create: the registration code is shown once (the caller\'s own call) and never journaled',async()=>{
    const f=terminalFixture(),code='reg_D9SECRETCODE';
    const {preview,done}=await confirmed(f,{
      op:op('PostTerminalReaders'),
      body:{registration_code:code,label:'Front desk'}},
      'd9-reader-create');
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(done.resourceId).toMatch(/^tmr_/);
    // The provider was called exactly once with the code...
    const posts=f.calls.filter(c=>c.method==='POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].params.registration_code).toBe(code);
    // ...the read-back happened...
    expect(f.calls.some(c=>c.method==='GET'&&
      c.path==='/v1/terminal/readers/'+done.resourceId)).toBe(true);
    // ...and the code appears in NO audit record and NO tool result.
    const audit=JSON.stringify(await f.db.listAuditForTest());
    expect(audit).not.toContain(code);
    expect(JSON.stringify(preview)).not.toContain(code);
    expect(JSON.stringify(done)).not.toContain(code);
    // The stored reader matches the pinned response shape: no secret
    // field exists on a reader (the code is consumed at registration).
    expect(f.store.readers.get(done.resourceId))
      .not.toHaveProperty('registration_code');
  });
  it('reader update and delete verify by read-back',async()=>{
    const f=terminalFixture();
    const created=await confirmed(f,{
      op:op('PostTerminalReaders'),
      body:{registration_code:'reg_D9SECOND',label:'Desk 1'}},
      'd9-reader-create-2');
    const readerId=created.done.resourceId;
    // A label update body hits the same baseline anyOf union quirk
    // as location display_name; a metadata update validates and
    // completes under the preserved metadata route.
    const updated=await confirmed(f,{
      op:op('PostTerminalReadersReader'),pathParams:{reader:readerId},
      body:{metadata:{desk:'2'}}},'d9-reader-update');
    expect(updated.done).toMatchObject({done:true,resourceId:readerId});
    expect(f.store.readers.get(readerId).metadata).toEqual({desk:'2'});
    const deleted=await confirmed(f,{
      op:op('DeleteTerminalReadersReader'),pathParams:{reader:readerId}},
      'd9-reader-delete');
    expect(deleted.done).toMatchObject({done:true,resourceId:readerId});
    expect(f.store.readers.has(readerId)).toBe(false);
  });
  it('configuration create, update and delete verify by read-back (no metadata surface)',async()=>{
    const f=terminalFixture();
    const created=await confirmed(f,{
      op:op('PostTerminalConfigurations'),body:{name:'Depot default'}},
      'd9-config-create');
    expect(created.done).toMatchObject({done:true});
    const cfgId=created.done.resourceId;
    expect(cfgId).toMatch(/^tmc_/);
    const updated=await confirmed(f,{
      op:op('PostTerminalConfigurationsConfiguration'),
      pathParams:{configuration:cfgId},body:{name:'Depot renamed'}},
      'd9-config-update');
    expect(updated.done).toMatchObject({done:true,resourceId:cfgId});
    expect(f.store.configurations.get(cfgId).name).toBe('Depot renamed');
    const deleted=await confirmed(f,{
      op:op('DeleteTerminalConfigurationsConfiguration'),
      pathParams:{configuration:cfgId}},'d9-config-delete');
    expect(deleted.done).toMatchObject({done:true});
    expect(f.store.configurations.has(cfgId)).toBe(false);
  });
  it('a classified refusal through api_write serves the class reason and never reaches the provider',async()=>{
    const f=terminalFixture();
    const r=await f.call({op:op('PostTerminalReadersReaderProcessPaymentIntent'),
      pathParams:{reader:'tmr_D9X'},body:{payment_intent:'pi_D9X'},
      confirm:true,requestKey:'d9-device-refusal'});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('device-action class');
    expect(f.calls).toHaveLength(0);
    const m=await f.call({op:op('PostBillingMeterEvents'),
      body:{event_name:'api_call',identifier:'evt_d9_1',
        payload:{stripe_customer_id:'cus_D9',value:'1'}},
      confirm:true,requestKey:'d9-ingestion-refusal'});
    expect(m.isError).toBe(true);
    expect(m.content[0].text).toContain('meter_record_usage');
    expect(f.calls).toHaveLength(0);
  });
});

describe('CAP-4 D-9 action and settings kinds end-to-end (TEST)',()=>{
  function billingFixture(){
    const calls=[],db=createFakeDb({accounts:[{id:A,label:'D9 billing'}]});
    const alert={id:'balert_D9',object:'billing.alert',livemode:false,
      status:'inactive',alert_type:'usage_threshold',title:'Usage spike'};
    let settings={object:'tax.settings',livemode:false,
      defaults:{tax_behavior:'inclusive'},status:'active'};
    const stripe={rawRequest:async(method,path,params={})=>{
      calls.push({method,path,params});
      if(path==='/v1/billing/alerts/'+alert.id&&method==='GET')
        return {...alert};
      if(path==='/v1/billing/alerts/'+alert.id+'/activate'&&
        method==='POST'){alert.status='active';return {...alert};}
      if(path==='/v1/tax/settings'&&method==='GET')return {...settings};
      if(path==='/v1/tax/settings'&&method==='POST'){
        settings={...settings,...params,
          defaults:{...settings.defaults,...(params.defaults??{})}};
        return {...settings};
      }
      throw new Error('Unexpected provider path '+path);
    }};
    const ctx={connection:{mode:'test',profile:'full',stripeAccount:A},
      connectionId:'d9-billing',db,
      services:{stripeForConnection:async()=>stripe}};
    return {ctx,calls,alert,
      call:args=>registry.handlers.api_write(args,ctx)};
  }
  it('alert activate verifies the expected state by reading the alert back',async()=>{
    const f=billingFixture();
    const args={op:op('PostBillingAlertsIdActivate'),
      pathParams:{id:f.alert.id}};
    const preview=parse(await f.call(args));
    expect(preview).toMatchObject({done:false,needsConfirmation:true});
    expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(0);
    const done=parse(await f.call({...args,confirm:true,
      requestKey:'d9-alert-activate'}));
    expect(done).toMatchObject({done:true,confirmed:true,
      resourceId:f.alert.id});
    expect(f.alert.status).toBe('active');
  });
  it('tax settings update verifies the singleton settings object by read-back',async()=>{
    const f=billingFixture();
    const args={op:op('PostTaxSettings'),
      body:{defaults:{tax_behavior:'exclusive'}}};
    const preview=parse(await f.call(args));
    expect(preview).toMatchObject({done:false,needsConfirmation:true});
    const done=parse(await f.call({...args,confirm:true,
      requestKey:'d9-tax-settings'}));
    expect(done).toMatchObject({done:true,confirmed:true});
    // A singleton settings object has no resource id of its own: the
    // verified identity is the account whose settings changed.
    expect(done.resourceId).toBe(A);
  });
});
