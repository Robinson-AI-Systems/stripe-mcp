import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {isGuardedLiveWrite,listingForConnection} from '../../src/core/profiles.js';

const account='acct_CATALOG123',parse=r=>JSON.parse(r.content[0].text);
afterEach(()=>vi.unstubAllEnvs());
function fixture({mode='test',providerMode=mode,grant=true,enabled=true,profile='full'}={}){
  if(mode==='live')vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:account,label:'Catalog fixture',
    live_enabled:enabled,live_connected:true}]});
  const products=new Map(),prices=new Map(),calls=[];
  const mkProd=(id,name,metadata={})=>({id,name,metadata,description:null,
    active:true,object:'product',livemode:providerMode==='live',created:1690000000});
  const mkPrice=(id,product,lookupKey,amount,recurring=null)=>({
    id,product,lookup_key:lookupKey,unit_amount:amount,currency:'usd',
    type:recurring?'recurring':'one_time',recurring,active:true,
    metadata:{},nickname:null,object:'price',livemode:providerMode==='live'});
  products.set('prod_BASE123',mkProd('prod_BASE123','Fixture product'));
  const sdk={
    accounts:{retrieve:vi.fn(async()=>({id:account,object:'account'}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',
      livemode:providerMode==='live'}))},
    products:{
      list:vi.fn(async()=>({data:[...products.values()].filter(x=>!x.deleted),has_more:false})),
      search:vi.fn(async()=>({data:[...products.values()],has_more:false,next_page:null})),
      retrieve:vi.fn(async id=>products.get(id)),
      create:vi.fn(async(args,opts)=>{
        calls.push({op:'product.create',args,opts});
        const p={...mkProd('prod_NEW123',args.name,args.metadata??{}),
          description:args.description??null};
        products.set(p.id,p);return p;
      }),
      update:vi.fn(async(id,args,opts)=>{
        calls.push({op:'product.update',args,opts});
        const p=products.get(id);Object.assign(p,args);return p;
      }),
      del:vi.fn(async(id,_args,opts)=>{
        calls.push({op:'product.del',args:{id},opts});
        products.set(id,{id,deleted:true});
        return {id,deleted:true};
      })
    },
    prices:{
      list:vi.fn(async args=>({data:[...prices.values()].filter(p=>
        (!args.product||p.product===args.product)&&
        (!args.lookup_keys||args.lookup_keys.includes(p.lookup_key))&&
        (args.active===undefined||p.active===args.active)),has_more:false})),
      search:vi.fn(async()=>({data:[...prices.values()],has_more:false,next_page:null})),
      retrieve:vi.fn(async id=>prices.get(id)),
      create:vi.fn(async(args,opts)=>{
        calls.push({op:'price.create',args,opts});
        const p=mkPrice('price_NEW123',args.product,args.lookup_key,args.unit_amount,
          args.recurring??null);
        p.nickname=args.nickname??null;p.metadata=args.metadata??{};
        prices.set(p.id,p);return p;
      }),
      update:vi.fn(async(id,args,opts)=>{
        calls.push({op:'price.update',args,opts});
        const p=prices.get(id);
        if(args.lookup_key!==undefined)p.lookup_key=args.lookup_key;
        if(args.nickname!==undefined)p.nickname=args.nickname;
        if(args.metadata!==undefined)p.metadata=args.metadata;
        if(args.active!==undefined)p.active=args.active;
        return p;
      })
    }
  };
  const connection={stripeAccount:account,mode,profile,
    rtcLiveOwnerApproved:grant,moneyLimitCents:0,listing:'catalog'};
  const ctx={db,connection,connectionId:'catalog-regression',
    liveAccessGranted:mode==='live'&&grant,
    services:{stripeForConnection:async()=>sdk}};
  const call=(name,args={})=>registry.handlers[name](args,ctx);
  const confirm=(name,args)=>call(name,{...args,confirm:true,
    requestKey:'catalog-'+name});
  return {ctx,db,sdk,products,prices,calls,call,confirm,mkPrice};
}
describe('E-1 native TEST catalog profile and contract',()=>{
  it('exports all six reads and seven guarded writes under separate profiles',async()=>{
    const names=['product_list','product_get','product_search','price_list',
      'price_get','price_search','product_create','product_update','product_archive',
      'product_unarchive','product_delete','price_create','price_update'];
    expect(registry.tools.filter(t=>names.includes(t.name)).map(t=>t.name)).toEqual(names);
    for(const tool of registry.tools.filter(t=>names.includes(t.name))){
      expect(tool.area).toBe('catalog');
      if(tool.writes)expect(tool.writeContract).toBe('defineWrite-v1');
    }
    const f=fixture();
    const denial=await dispatchReadOnlyTool({registry,name:'price_create',
      args:{productId:'prod_BASE123',lookupKey:'rental_monthly',unitAmountCents:3600,
        currency:'usd',confirm:true},connection:{...f.ctx.connection,profile:'read_only'},
      db:f.db,services:f.ctx.services});
    expect(denial.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it('safe reads paginate, report immutable price terms, and expose no provider secrets',async()=>{
    const f=fixture();
    f.prices.set('price_BASE123',f.mkPrice('price_BASE123','prod_BASE123',
      'existing_month',3600,{interval:'month',interval_count:1,usage_type:'licensed'}));
    expect(parse(await f.call('product_list',{limit:10})).data[0]).toMatchObject({
      id:'prod_BASE123',name:'Fixture product'});
    expect(parse(await f.call('product_get',{productId:'prod_BASE123'})).id)
      .toBe('prod_BASE123');
    expect(parse(await f.call('price_list',{lookupKey:'existing_month'})).data[0])
      .toMatchObject({unitAmountCents:3600,lookupKey:'existing_month'});
    expect(parse(await f.call('price_get',{priceId:'price_BASE123'})).recurring.interval)
      .toBe('month');
    expect(parse(await f.call('product_search',{query:"name:'Fixture'"})).data).toHaveLength(1);
    expect(parse(await f.call('price_search',{query:"lookup_key:'existing_month'"})).data)
      .toHaveLength(1);
    expect(f.calls).toHaveLength(0);
  });
  it('creates a product only on confirmed TEST request, then reads exact state',async()=>{
    const f=fixture(),a={name:'MCP standalone kit'};
    const preview=parse(await f.call('product_create',{...a,dryRun:true}));
    expect(preview.done).toBe(false);expect(preview.preview).toMatch(/TEST MODE/);
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.confirm('product_create',a));
    expect(done).toMatchObject({done:true,confirmed:true,resourceId:'prod_NEW123'});
    expect(f.calls[0]).toMatchObject({op:'product.create',args:{name:a.name}});
    expect(f.calls[0].opts.idempotencyKey).toMatch(/^rmcp_product_create_/);
    expect(parse(await f.call('product_get',{productId:'prod_NEW123'})).name).toBe(a.name);
  });
  it('reuses exact lookup-key price on second confirmed setup without another POST',async()=>{
    const f=fixture(),a={productId:'prod_BASE123',lookupKey:'standing_month',
      unitAmountCents:3600,currency:'usd',interval:'month'};
    const p=parse(await f.call('price_create',{...a,dryRun:true}));
    expect(p.done).toBe(false);expect(f.calls).toHaveLength(0);
    const first=parse(await f.confirm('price_create',a));
    const second=parse(await f.confirm('price_create',a));
    expect(first).toMatchObject({done:true,resourceId:'price_NEW123'});
    expect(second).toMatchObject({done:true,resourceId:'price_NEW123'});
    expect(f.sdk.prices.create).toHaveBeenCalledTimes(1);
    expect(f.sdk.prices.create.mock.calls[0][0]).toMatchObject({
      product:'prod_BASE123',lookup_key:'standing_month',
      recurring:{interval:'month',interval_count:1,usage_type:'licensed'},
      unit_amount:3600,currency:'usd'});
    await expect(f.confirm('price_create',{...a,unitAmountCents:4500}))
      .rejects.toThrow(/different immutable/);
    expect(f.sdk.prices.create).toHaveBeenCalledTimes(1);
  });
  it('never edits immutable amount or cadence and never rewrites an app-owned price',async()=>{
    const f=fixture();
    f.prices.set('price_BASE123',f.mkPrice('price_BASE123','prod_BASE123',
      'current_fee',3600));
    await expect(f.confirm('price_update',{priceId:'price_BASE123',
      unitAmountCents:5000})).rejects.toThrow(/Unsupported/);
    const done=parse(await f.confirm('price_update',{
      priceId:'price_BASE123',nickname:'Annual plan'}));
    expect(done.done).toBe(true);
    expect(f.sdk.prices.update.mock.calls[0][1]).toEqual({nickname:'Annual plan'});
    f.products.set('prod_OWNED123',{
      id:'prod_OWNED123',name:'Owner app product',object:'product',
      livemode:false,active:true,description:null,
      metadata:{agreementId:'agr_123'}});
    await expect(f.confirm('price_create',{productId:'prod_OWNED123',
      lookupKey:'owned_month',unitAmountCents:3600,currency:'usd'}))
      .rejects.toThrow(/app-owned/i);
    expect(f.sdk.prices.create).not.toHaveBeenCalled();
  });
  it('prevents destructive operations on priced products and refuses app metadata',async()=>{
    const f=fixture();
    f.prices.set('price_BASE123',f.mkPrice('price_BASE123','prod_BASE123',
      'existing_month',3600));
    await expect(f.confirm('product_delete',{productId:'prod_BASE123'}))
      .rejects.toThrow(/no active or inactive prices/i);
    await expect(f.confirm('product_create',{name:'No owned key',
      metadata:{agreementId:'secret_marker'}})).rejects.toThrow(/application-owned/i);
    expect(f.sdk.products.del).not.toHaveBeenCalled();
    f.prices.clear();
    const response=parse(await f.confirm('product_delete',{productId:'prod_BASE123'}));
    expect(response.done).toBe(true);
    expect(f.sdk.products.del).toHaveBeenCalledTimes(1);
  });
  it('fails closed for LIVE, missing profile registry and ambiguous provider reads',async()=>{
    const f=fixture();
    const live=await registry.handlers.product_create({name:'Never live',confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);expect(f.calls).toHaveLength(0);
    f.ctx.db.listKnownAppsForAccount=async()=>{throw Error('db offline');};
    await expect(f.confirm('product_create',{name:'Fails closed'}))
      .rejects.toThrow(/registry unavailable/);
    f.ctx.db.listKnownAppsForAccount=async()=>[];
    f.sdk.products.retrieve.mockResolvedValueOnce({id:'prod_BASE123',object:'product',
      livemode:true,name:'Wrong mode',metadata:{}});
    await expect(f.confirm('product_archive',{productId:'prod_BASE123'}))
      .rejects.toThrow(/selected-mode product/);
    expect(f.calls).toHaveLength(0);
  });
  it('refuses an unmarked price when its parent product is app owned',async()=>{
    const f=fixture();
    f.products.set('prod_OWNED123',{id:'prod_OWNED123',object:'product',
      livemode:false,active:true,name:'Owned product',
      description:null,metadata:{agreementId:'agr_123'}});
    f.prices.set('price_OWNED123',f.mkPrice('price_OWNED123','prod_OWNED123',
      'app_month',3600));
    await expect(f.confirm('price_update',{priceId:'price_OWNED123',active:false}))
      .rejects.toThrow(/parent product/i);
    expect(f.sdk.prices.update).not.toHaveBeenCalled();
  });
  it('requires no inactive prices before product deletion',async()=>{
    const f=fixture();
    const inactive=f.mkPrice('price_INACTIVE123','prod_BASE123','retired_month',3600);
    inactive.active=false;f.prices.set(inactive.id,inactive);
    await expect(f.confirm('product_delete',{productId:'prod_BASE123'}))
      .rejects.toThrow(/active or inactive prices/);
    expect(f.sdk.products.del).not.toHaveBeenCalled();
    expect(f.sdk.prices.list.mock.calls.map(x=>x[0].active)).toEqual([true,false]);
  });
  it('accepts a verified provider 404 after a matching DELETE receipt, never 404 alone',async()=>{
    const missing=()=>Object.assign(new Error('provider missing'),{
      statusCode:404,code:'resource_missing',type:'StripeInvalidRequestError'});
    const f=fixture();
    f.sdk.products.retrieve.mockImplementationOnce(async id=>f.products.get(id))
      .mockRejectedValueOnce(missing());
    const done=parse(await f.confirm('product_delete',{productId:'prod_BASE123'}));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.sdk.products.del).toHaveBeenCalledTimes(1);
    expect(f.sdk.products.retrieve).toHaveBeenCalledTimes(2);

    const g=fixture();
    g.sdk.products.del.mockResolvedValueOnce({id:'prod_BASE123',deleted:false});
    g.sdk.products.retrieve.mockImplementationOnce(async id=>g.products.get(id))
      .mockRejectedValueOnce(missing());
    const unknown=parse(await g.confirm('product_delete',{productId:'prod_BASE123'}));
    expect(unknown).toMatchObject({done:false,confirmed:false});
    expect(unknown.warning).toMatch(/uncertain/i);
    expect(g.sdk.products.del).toHaveBeenCalledTimes(1);
  });

  it('lists and searches actual selected LIVE products and prices without acquiring TEST records',async()=>{
    const f=fixture({mode:'live'});
    f.prices.set('price_LIVEBASE',f.mkPrice('price_LIVEBASE','prod_BASE123',
      'live_month',4500,{interval:'month',interval_count:1,usage_type:'licensed'}));
    for(const [name,args] of [
      ['product_list',{limit:3}],
      ['product_get',{productId:'prod_BASE123'}],
      ['product_search',{query:"name:'Fixture'"}],
      ['price_list',{lookupKey:'live_month'}],
      ['price_get',{priceId:'price_LIVEBASE'}],
      ['price_search',{query:"lookup_key:'live_month'"}]
    ]){
      const result=await f.call(name,args);
      expect(result.isError,name).not.toBe(true);
    }
    expect(f.sdk.balance.retrieve).toHaveBeenCalledTimes(6);
    expect(f.calls).toHaveLength(0);
    expect(parse(await f.call('price_get',{priceId:'price_LIVEBASE'})))
      .toMatchObject({unitAmountCents:4500,currency:'usd'});
  });
  it('advertises seven original guarded catalog writers only for separately granted LIVE scope',()=>{
    const f=fixture({mode:'live'});
    const names=['product_create','product_update','product_archive',
      'product_unarchive','product_delete','price_create','price_update'];
    for(const name of names){
      const t=registry.tools.find(x=>x.name===name);
      expect(isGuardedLiveWrite(t,f.ctx.connection)).toBe(true);
      expect(isGuardedLiveWrite(t,{...f.ctx.connection,
        rtcLiveOwnerApproved:false})).toBe(false);
      expect(isGuardedLiveWrite(t,{...f.ctx.connection,profile:'read_only'})).toBe(false);
    }
    expect(listingForConnection(registry,f.ctx.connection).filter(t=>
      t.area==='catalog'&&t.writes===true).map(t=>t.name).sort()).toEqual([...names].sort());
  });
  it('previews then performs owner-confirmed LIVE product create/update and reversible archive',async()=>{
    const f=fixture({mode:'live'});
    const draft=parse(await f.call('product_create',{name:'Real-visible test product'}));
    expect(draft).toMatchObject({mode:'LIVE',done:false,needsConfirmation:true});
    expect(draft.preview).toMatch(/LIVE MODE|LIVE prices/);
    expect(f.calls).toHaveLength(0);
    const added=parse(await f.confirm('product_create',{name:'Real-visible test product'}));
    expect(added).toMatchObject({done:true,confirmed:true,mode:'LIVE',
      resourceId:'prod_NEW123'});
    const updated=parse(await f.confirm('product_update',{
      productId:'prod_NEW123',name:'Renamed LIVE-visible product'}));
    expect(updated).toMatchObject({done:true,confirmed:true,mode:'LIVE'});
    const archive=parse(await f.confirm('product_archive',{productId:'prod_NEW123'}));
    expect(archive).toMatchObject({done:true,confirmed:true,mode:'LIVE'});
    expect(f.products.get('prod_NEW123').active).toBe(false);
    const unarchive=parse(await f.confirm('product_unarchive',{productId:'prod_NEW123'}));
    expect(unarchive).toMatchObject({done:true,confirmed:true,mode:'LIVE'});
    expect(f.products.get('prod_NEW123').active).toBe(true);
    expect(f.calls.every(x=>x.opts?.idempotencyKey?.startsWith('rmcp_'))).toBe(true);
  });
  it('creates exact LIVE immutable recurring price only once, then updates only supported fields',async()=>{
    const f=fixture({mode:'live'});
    const args={productId:'prod_BASE123',lookupKey:'live_rental_month',
      unitAmountCents:6000,currency:'usd',interval:'month'};
    const preview=parse(await f.call('price_create',args));
    expect(preview).toMatchObject({mode:'LIVE',needsConfirmation:true});
    expect(preview.preview).toContain('future charges');
    expect(f.sdk.prices.create).not.toHaveBeenCalled();
    const first=parse(await f.confirm('price_create',args));
    const repeat=parse(await f.confirm('price_create',args));
    expect(first).toMatchObject({mode:'LIVE',done:true,confirmed:true,
      resourceId:'price_NEW123'});
    expect(repeat).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(f.sdk.prices.create).toHaveBeenCalledTimes(1);
    const updated=parse(await f.confirm('price_update',{
      priceId:'price_NEW123',nickname:'New live rental label'}));
    expect(updated).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(f.prices.get('price_NEW123').unit_amount).toBe(6000);
    await expect(f.confirm('price_update',{
      priceId:'price_NEW123',unitAmountCents:9999})).rejects.toThrow();
    await expect(f.confirm('price_create',{
      ...args,unitAmountCents:7000})).rejects.toThrow(/different immutable/);
    expect(f.sdk.prices.create).toHaveBeenCalledTimes(1);
  });
  it('deletes LIVE product only if no prices and separately verifies provider result',async()=>{
    const f=fixture({mode:'live'});
    const args={productId:'prod_BASE123'};
    expect(parse(await f.call('product_delete',args))).toMatchObject({
      mode:'LIVE',done:false,needsConfirmation:true});
    expect(f.sdk.products.del).not.toHaveBeenCalled();
    const done=parse(await f.confirm('product_delete',args));
    expect(done).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(f.sdk.products.del).toHaveBeenCalledTimes(1);
    const other=fixture({mode:'live'});
    other.prices.set('price_LIVEEXISTING',other.mkPrice('price_LIVEEXISTING',
      'prod_BASE123','existing_live_fee',3500));
    await expect(other.confirm('product_delete',args)).rejects.toThrow(/prices/);
    expect(other.sdk.products.del).not.toHaveBeenCalled();
  });
  it('never grants LIVE catalog rights to read_only, missing owner consent or disabled accounts',async()=>{
    const requested={name:'Do not create',confirm:true,requestKey:'denied-live'};
    for(const config of [{mode:'live',grant:false},{mode:'live',enabled:false},
      {mode:'live',profile:'read_only'},{mode:'live',providerMode:'test'}]){
      const f=fixture(config);
      const response=await f.call('product_create',requested)
        .catch(()=>({isError:true}));
      expect(response.isError).toBe(true);
      expect(f.calls).toHaveLength(0);
      const seen=await dispatchReadOnlyTool({registry,name:'price_create',
        args:{productId:'prod_BASE123',lookupKey:'attempt_live',
          unitAmountCents:5000,currency:'usd',confirm:true},
        connection:{...f.ctx.connection},db:f.db,services:f.ctx.services});
      if(config.grant===false||config.profile==='read_only')
        expect(seen.isError).toBe(true);
      expect(f.sdk.prices.create).not.toHaveBeenCalled();
    }
    const g=fixture({mode:'live'});
    vi.stubEnv('VERCEL_ENV','preview');
    expect((await g.call('product_create',requested)).isError).toBe(true);
    expect(g.calls).toHaveLength(0);
  });
  it('refuses cross-account provider proof, app-owned product and unresolved provider readback',async()=>{
    const foreign=fixture({mode:'live'});
    foreign.sdk.accounts.retrieve.mockResolvedValueOnce({
      object:'account',id:'acct_OTHERLIVE'});
    await expect(foreign.call('product_create',{name:'Foreign live'})).rejects.toThrow();
    expect(foreign.calls).toHaveLength(0);
    const owned=fixture({mode:'live'});
    owned.products.get('prod_BASE123').metadata={agreementId:'agr_APP'};
    await expect(owned.confirm('product_update',{productId:'prod_BASE123',
      name:'Should not change'})).rejects.toThrow(/Application-owned/);
    expect(owned.sdk.products.update).not.toHaveBeenCalled();
    const uncertain=fixture({mode:'live'});
    uncertain.sdk.products.create.mockImplementationOnce(async()=>
      ({id:'prod_NEW123',object:'product',livemode:true}));
    const result=parse(await uncertain.confirm('product_create',{name:'Unobserved LIVE product'}));
    expect(result).toMatchObject({done:false,confirmed:false,mode:'LIVE'});
    expect(uncertain.sdk.products.create).toHaveBeenCalledTimes(1);
  });

});
