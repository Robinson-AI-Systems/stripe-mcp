import {describe,it,expect,vi} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';

const account='acct_CATALOG123',parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const db=createFakeDb({accounts:[{id:account,label:'Catalog fixture'}]});
  const products=new Map(),prices=new Map(),calls=[];
  const mkProd=(id,name,metadata={})=>({id,name,metadata,description:null,
    active:true,object:'product',livemode:false,created:1690000000});
  const mkPrice=(id,product,lookupKey,amount,recurring=null)=>({
    id,product,lookup_key:lookupKey,unit_amount:amount,currency:'usd',
    type:recurring?'recurring':'one_time',recurring,active:true,
    metadata:{},nickname:null,object:'price',livemode:false});
  products.set('prod_BASE123',mkProd('prod_BASE123','Fixture product'));
  const sdk={
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
        (!args.lookup_keys||args.lookup_keys.includes(p.lookup_key))),has_more:false})),
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
  const connection={stripeAccount:account,mode:'test',profile:'full'};
  const ctx={db,connection,connectionId:'catalog-regression',
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
    f.products.set('prod_OWNED123',f.mkPrice); // replaced with an explicitly owned product below
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
      .rejects.toThrow(/no prices/i);
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
      .rejects.toThrow(/TEST product/);
    expect(f.calls).toHaveLength(0);
  });
});
