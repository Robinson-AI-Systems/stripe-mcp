import {describe,it,expect,vi,afterEach} from 'vitest';
import {isGuardedLiveWrite,listingForConnection} from '../../src/core/profiles.js';
afterEach(()=>vi.unstubAllEnvs());
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {APP_METADATA_KEYS} from '../../src/tools/app-guard.js';

const account='acct_PROMOTEST123',json=r=>JSON.parse(r.content[0].text);
function fixture({providerMode=mode,mode='test',profile='full',grant=false}={}){
  if(mode==='live')vi.stubEnv('VERCEL_ENV','production');
  const coupon=(id,opts={})=>({id,object:'coupon',livemode:providerMode==='live',
    amount_off:null,percent_off:15,currency:null,duration:'once',
    name:null,metadata:{},valid:true,...opts});
  const feature=(id,lookupKey='premium-access')=>({id,object:'entitlements.feature',
    livemode:providerMode==='live',lookup_key:lookupKey,name:'Premium',active:true});
  const tax=(id)=>({id,object:'tax_rate',livemode:providerMode==='live',
    display_name:'Sales',percentage:7.5,inclusive:false,active:true,
    description:null,jurisdiction:null,country:null,state:null,metadata:{}});
  const coupons=new Map([['welcome22',coupon('welcome22')]]),
    promos=new Map(),features=new Map([['feat_ABC123',feature('feat_ABC123')]]),
    taxes=new Map([['txr_ABC123',tax('txr_ABC123')]]),links=new Map();
  const calls=[];
  const list=(map,filters=()=>true)=>async()=>({data:[...map.values()].filter(filters),has_more:false});
  const sdk={
    accounts:{retrieve:vi.fn(async()=>({object:'account',id:account}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:providerMode==='live'}))},
    coupons:{
      list:vi.fn(list(coupons)),retrieve:vi.fn(async id=>{
        if(coupons.has(id))return coupons.get(id);
        throw Object.assign(new Error('Stripe coupon missing'),{
          statusCode:404,code:'resource_missing',type:'StripeInvalidRequestError'});
      }),
      create:vi.fn(async(p,opts)=>{calls.push({name:'coupons.create',p,opts});
        const v=coupon(p.id??'coupon_NEW123',{percent_off:p.percent_off??null,
          amount_off:p.amount_off??null,currency:p.currency??null,duration:p.duration,
          name:p.name??null,metadata:p.metadata??{}});coupons.set(v.id,v);return v;}),
      update:vi.fn(async(id,p,opts)=>{calls.push({name:'coupons.update',p,opts});
        Object.assign(coupons.get(id),p);return coupons.get(id);}),
      del:vi.fn(async(id)=>{calls.push({name:'coupons.del'});
        coupons.delete(id);return {id,deleted:true};})
    },
    promotionCodes:{
      list:vi.fn(async(a)=>({data:[...promos.values()].filter(p=>!a.code||
        p.code.toLowerCase()===a.code.toLowerCase()),has_more:false})),
      retrieve:vi.fn(async id=>promos.get(id)),
      create:vi.fn(async(p,opts)=>{calls.push({name:'promotionCodes.create',p,opts});
        const v={id:'promo_NEW123',object:'promotion_code',
          livemode:providerMode==='live',code:p.code,coupon:p.coupon,
          active:true,metadata:p.metadata??{},customer:p.customer??null,
          max_redemptions:p.max_redemptions??null,expires_at:p.expires_at??null};
        promos.set(v.id,v);return v;}),
      update:vi.fn(async(id,p)=>{calls.push({name:'promotionCodes.update'});
        const v=promos.get(id);Object.assign(v,p);return v;})
    },
    entitlements:{
      features:{
        list:vi.fn(list(features)),retrieve:vi.fn(async id=>features.get(id)),
        create:vi.fn(async(p,opts)=>{calls.push({name:'features.create',p,opts});
          const v=feature('feat_NEW123',p.lookup_key);v.name=p.name;
          features.set(v.id,v);return v;})
      },
      activeEntitlements:{
        list:vi.fn(async()=>({data:[{id:'ent_ABC123',
          object:'entitlements.active_entitlement',
          livemode:providerMode==='live',feature:'feat_ABC123',
          lookup_key:'premium-access'}],has_more:false}))
      }
    },
    products:{
      retrieve:vi.fn(async id=>({id,object:'product',livemode:providerMode==='live',
        metadata:{},name:'Fixture'})),
      listFeatures:vi.fn(async()=>({data:[...links.values()],has_more:false})),
      createFeature:vi.fn(async(id,p)=>{calls.push({name:'products.createFeature'});
        const v={id:'feat_LINK123',object:'product_feature',
          entitlement_feature:p.entitlement_feature};
        links.set(v.id,v);return v;}),
      deleteFeature:vi.fn(async(id,featureId)=>{calls.push({name:'products.deleteFeature'});
        links.delete(featureId);return {id:featureId,deleted:true};})
    },
    taxRates:{
      list:vi.fn(list(taxes)),retrieve:vi.fn(async id=>taxes.get(id)),
      create:vi.fn(async(p,opts)=>{calls.push({name:'taxRates.create',p,opts});
        const v={...tax('txr_NEW123'),display_name:p.display_name,
          inclusive:p.inclusive,percentage:p.percentage,
          metadata:p.metadata??{}};taxes.set(v.id,v);return v;}),
      update:vi.fn(async(id,p)=>{calls.push({name:'taxRates.update'});
        Object.assign(taxes.get(id),p);return taxes.get(id);})
    }
  };
  const db=createFakeDb({accounts:[{id:account,label:'E-2',live_enabled:true,
    live_connected:true}]});
  const connection={stripeAccount:account,mode,profile,moneyLimitCents:0,
    rtcLiveOwnerApproved:grant};
  const ctx={db,connection,connectionId:'E2-owner-TEST',
    liveAccessGranted:grant,services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk,calls,coupons,promos,features,taxes,links,db,
    call:(n,a={})=>registry.handlers[n](a,ctx),
    confirm:(n,a)=>registry.handlers[n](
      {...a,confirm:true,requestKey:'e2-'+n},ctx)};
}
describe('E-2 native discount, entitlement and manual tax capabilities',()=>{
  const all=['coupon_list','coupon_get','coupon_create','coupon_update','coupon_delete',
    'promo_list','promo_get','promo_find_by_code','promo_create','promo_update',
    'feature_list','feature_create','feature_attach_to_product',
    'feature_detach_from_product','feature_list_for_product',
    'entitlement_list_active','taxrate_list','taxrate_get','taxrate_create',
    'taxrate_update'];
  it('registers every E-2 original tool, with read and guarded write families',()=>{
    expect(registry.tools.filter(t=>all.includes(t.name)).map(t=>t.name).sort())
      .toEqual([...all].sort());
    for(const t of registry.tools.filter(t=>all.includes(t.name))){
      expect(t.area).toBe('catalog');
      if(t.writes)expect(t.writeContract).toBe('defineWrite-v1');
      expect(t.inputSchema.additionalProperties).toBe(false);
    }
  });
  it('provides bounded coupon/promo/feature/entitlement/tax reads without writes',async()=>{
    const f=fixture();
    expect(json(await f.call('coupon_list')).data[0].id).toBe('welcome22');
    expect(json(await f.call('coupon_get',{couponId:'welcome22'})).valid).toBe(true);
    expect(json(await f.call('promo_list')).data).toEqual([]);
    expect(json(await f.call('promo_find_by_code',{code:'HELLO12'})).data).toEqual([]);
    expect(json(await f.call('feature_list')).data[0].id).toBe('feat_ABC123');
    expect(json(await f.call('feature_list_for_product',{productId:'prod_ABC123'})).data)
      .toEqual([]);
    expect(json(await f.call('entitlement_list_active',{customerId:'cus_ABC123'})).data[0])
      .toMatchObject({feature:'feat_ABC123',lookupKey:'premium-access'});
    expect(json(await f.call('taxrate_get',{taxrateId:'txr_ABC123'})).percentage).toBe(7.5);
    expect(json(await f.call('taxrate_list')).data).toHaveLength(1);
    expect(f.calls).toHaveLength(0);
  });
  it('conflicting and missing coupon amount forms are denied before any Stripe mutation',async()=>{
    const f=fixture();
    await expect(f.call('coupon_create',{duration:'once',percentOff:25,
      amountOff:500,currency:'usd',confirm:true})).rejects.toThrow(/exactly one/);
    await expect(f.call('coupon_create',{duration:'once',amountOff:100,
      confirm:true})).rejects.toThrow(/currency/);
    expect(f.calls).toHaveLength(0);
  });
  it('zero Stripe writes in preview, exact confirmation and coupon replay',async()=>{
    const f=fixture(),a={couponId:'DISCOUNT25',duration:'once',percentOff:25};
    expect(json(await f.call('coupon_create',{...a,dryRun:true})).done).toBe(false);
    expect(f.calls).toHaveLength(0);
    const first=json(await f.confirm('coupon_create',a));
    expect(first.confirmed).toBe(true);
    expect(f.calls).toHaveLength(1);
    const again=json(await f.confirm('coupon_create',a));
    expect(again.confirmed).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(json(await f.call('coupon_get',{couponId:'DISCOUNT25'})).percentOff).toBe(25);
  });
  it('creates customer code and forbids conflicting active reuse',async()=>{
    const f=fixture();
    expect(json(await f.confirm('promo_create',{couponId:'welcome22',code:'SAVE15'}))
      .confirmed).toBe(true);
    expect(json(await f.call('promo_find_by_code',{code:'SAVE15'})).data)
      .toHaveLength(1);
    expect(f.calls.filter(x=>x.name==='promotionCodes.create')).toHaveLength(1);
    const result=json(await f.confirm('promo_create',{couponId:'welcome22',code:'SAVE15'}));
    expect(result.confirmed).toBe(true);
    expect(f.calls.filter(x=>x.name==='promotionCodes.create')).toHaveLength(1);
  });
  it('attaches, lists and detaches only verified owner-independent product features',async()=>{
    const f=fixture(),a={productId:'prod_ABC123',featureId:'feat_ABC123'};
    expect(json(await f.confirm('feature_attach_to_product',a)).confirmed).toBe(true);
    expect(json(await f.call('feature_list_for_product',{productId:a.productId})).data)
      .toHaveLength(1);
    expect(json(await f.confirm('feature_detach_from_product',a)).confirmed).toBe(true);
    expect(f.links.size).toBe(0);
    expect(f.calls.filter(x=>x.name==='products.createFeature')).toHaveLength(1);
  });
  it('manual tax write verifies actual percentage, rejects silent immutable edits',async()=>{
    const f=fixture();
    const a={displayName:'Sales',percentage:7.5,inclusive:false};
    expect(json(await f.confirm('taxrate_create',a)).confirmed).toBe(true);
    expect(f.calls.filter(x=>x.name==='taxRates.create')).toHaveLength(1);
    expect(json(await f.confirm('taxrate_update',{taxrateId:'txr_ABC123',
      active:false})).confirmed).toBe(true);
    expect(json(await f.call('taxrate_get',{taxrateId:'txr_ABC123'})).active).toBe(false);
  });
  it('read-only profile cannot mutate, independent of requested name',async()=>{
    const f=fixture({profile:'read_only'});
    const a={couponId:'welcome22',name:'Unapproved',confirm:true};
    const out=await dispatchReadOnlyTool({registry,name:'coupon_update',args:a,
      connection:f.ctx.connection,db:f.db,services:f.ctx.services});
    expect(out.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('rejects wrong provider environment for reads and all previews',async()=>{
    const f=fixture({providerMode:'live'});
    expect((await f.call('coupon_get',{couponId:'welcome22'})).isError).toBe(true);
    await expect(f.call('coupon_update',{couponId:'welcome22',
      name:'Denied',dryRun:true})).rejects.toThrow(/selected-mode/);
    expect(f.calls).toHaveLength(0);
  });

  it('preserves provider continuation on two-page active entitlement results',async()=>{
    const f=fixture();
    f.sdk.entitlements.activeEntitlements.list.mockResolvedValue({
      data:[{id:'ent_ABC123',object:'entitlements.active_entitlement',
        livemode:false,feature:'feat_ABC123',lookup_key:'premium-access'}],
      has_more:true});
    const page=json(await f.call('entitlement_list_active',{customerId:'cus_ABC123',limit:1}));
    expect(page.has_more).toBe(true);
    expect(page.next).toBe('ent_ABC123');
    expect(f.calls).toHaveLength(0);
  });
  it('denies mutations on app-marked products and metadata',async()=>{
    const f=fixture();
    f.sdk.products.retrieve.mockResolvedValue({
      id:'prod_ABC123',object:'product',livemode:false,
      metadata:{[APP_METADATA_KEYS[0]]:'app-owned'}});
    await expect(f.confirm('feature_attach_to_product',
      {productId:'prod_ABC123',featureId:'feat_ABC123'}))
      .rejects.toThrow(/App|app/);
    await expect(f.confirm('taxrate_create',{displayName:'Sales',percentage:7.5,
      inclusive:false,metadata:{[APP_METADATA_KEYS[0]]:'bad'}}))
      .rejects.toThrow(/app|App/);
    expect(f.calls).toHaveLength(0);
  });
  it('rejects ambiguous promotion reuse and invalid feature keys without mutation',async()=>{
    const f=fixture();
    f.promos.set('promo_ABC123',{id:'promo_ABC123',
      object:'promotion_code',livemode:false,active:true,
      code:'SAVE15',coupon:'welcome22',customer:'cus_OTHER22',
      max_redemptions:null,expires_at:null,metadata:{}});
    await expect(f.confirm('promo_create',{couponId:'welcome22',code:'SAVE15'}))
      .rejects.toThrow(/different immutable/);
    await expect(f.confirm('feature_create',{name:'Premium',lookupKey:'NOT LOWERCASE'}))
      .rejects.toThrow(/lookup key/);
    expect(f.calls).toHaveLength(0);
  });
  it('does not silently confirm a write whose provider readback changed modes',async()=>{
    const f=fixture();
    f.sdk.taxRates.retrieve.mockImplementation(async()=>({
      ...f.taxes.get('txr_ABC123'),livemode:true
    }));
    const result=json(await f.confirm('taxrate_update',{taxrateId:'txr_ABC123',
      active:false}).catch(e=>({content:[{text:JSON.stringify({error:e.message})}]})));
    expect(result.done).not.toBe(true);
    expect(f.calls).toHaveLength(0);
  });

  it('allows independently owner-consented LIVE catalog reads and guarded tax writes',async()=>{
    const f=fixture({mode:'live',grant:true});
    const read=await f.call('taxrate_get',{taxrateId:'txr_ABC123'});
    expect(read.isError).not.toBe(true);
    expect(json(read).percentage).toBe(7.5);
    const written=json(await f.confirm('taxrate_update',{taxrateId:'txr_ABC123',active:false}));
    expect(written).toMatchObject({done:true,confirmed:true,mode:'LIVE'});
    expect(f.sdk.accounts.retrieve).toHaveBeenCalled();
    expect(f.sdk.balance.retrieve).toHaveBeenCalled();
    const native=registry.tools.find(x=>x.name==='coupon_create');
    expect(isGuardedLiveWrite(native,f.ctx.connection)).toBe(true);
    expect(listingForConnection(registry,{...f.ctx.connection,listing:'catalog'})
      .map(t=>t.name)).toContain('coupon_create');
    expect(isGuardedLiveWrite(native,{...f.ctx.connection,
      rtcLiveOwnerApproved:false})).toBe(false);
  });
  it('rejects disabled or unconsented LIVE mutation before dispatch to Stripe',async()=>{
    for(const grant of [false,true]){
      const f=fixture({mode:'live',grant});
      if(grant)f.db.getStripeAccount=async()=>({
        id:account,live_enabled:false,live_connected:true});
      const out=await f.call('coupon_create',{duration:'once',percentOff:12,
        confirm:true,requestKey:'refused-e2'});
      expect(out.isError).toBe(true);
      expect(f.calls).toHaveLength(0);
    }
  });
  it('does not advertise phantom projection fields for strict E-2 readers',()=>{
    const r=registry.tools.find(t=>t.name==='coupon_list');
    expect(r.detailFieldsSupported).toBe(false);
    const publicReader=listingForConnection(registry,{
      mode:'test',profile:'read_only',listing:'catalog'}).find(x=>x.name==='coupon_list');
    expect(publicReader.name).toBe('coupon_list');
  });
});
