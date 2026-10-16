import {describe,it,expect} from 'vitest';
import {catalog,getOperation,paramNames,checkedRequest,findOperations}
  from '../../src/stripe/openapi-index.js';
import {financialDecision} from '../../src/stripe/money-operations.js';
import {preferredNative} from '../../src/stripe/hand-built-map.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {isGuardedTestWrite,listingForConnection} from '../../src/core/profiles.js';

const A='acct_U1TEST',P='prod_U1TEST',T='txr_U1TEST';
const parse=r=>{try{return JSON.parse(r.content[0].text);}
  catch{return r.content[0].text;}};
const find=(method,path)=>[...catalog().operations.values()]
  .find(x=>x.method===method&&x.path===path);
function fixture(){
  const calls=[],db=createFakeDb({accounts:[{id:A,label:'U1 provider shape'}]});
  const product={id:P,object:'product',livemode:false,active:true,
    name:'Owned fixture',metadata:{}};
  const tax={id:T,object:'tax_rate',livemode:false,active:true,
    metadata:{memo:'old'}};
  const stripe={rawRequest:async(method,path,params,opts)=>{
    calls.push({method,path,params,opts});
    if(path.includes('/tax_rates/')){
      if(method==='POST')Object.assign(tax.metadata,params.metadata);
      return {...tax,metadata:{...tax.metadata}};
    }
    if(path.includes('/products/'))return product;
    throw new Error('Unexpected original provider path '+path);
  }};
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:A},
    connectionId:'u1-provider',db,services:{stripeForConnection:async()=>stripe}};
  return {db,ctx,calls,tax,product,
    call:(name,args)=>registry.handlers[name](args,ctx)};
}
describe('U-1 original immutable Stripe operation coverage',()=>{
  it('loads pinned checksum-verified 398-path Stripe spec and includes Terminal + Issuing searches',()=>{
    expect(catalog().operations.size).toBeGreaterThan(400);
    expect(findOperations('terminal reader',20).some(x=>x.path.includes('/terminal/'))).toBe(true);
    expect(findOperations('issuing card',20).some(x=>x.path.includes('/issuing/'))).toBe(true);
    const matches=findOperations('create refund',20);
    expect(matches.some(x=>x.path==='/v1/refunds'&&x.method==='POST')).toBe(true);
  });
  it('rejects missing operation IDs, foreign parameter names, malformed path and arbitrary body in GET',()=>{
    const read=find('GET','/v1/products/{product}');
    expect(read).toBeDefined();
    const key=paramNames(read,'path')[0].name;
    const good=checkedRequest(read.id,{pathParams:{[key]:P}});
    expect(good.path).toBe('/v1/products/'+P);
    expect(()=>getOperation('unregistered_fake')).toThrow();
    expect(()=>checkedRequest(read.id,{pathParams:{[key]:P,adminKey:'fake'}}))
      .toThrow(/Unknown/);
    expect(()=>checkedRequest(read.id,{pathParams:{[key]:'../../outside'}}))
      .toThrow();
    expect(()=>checkedRequest(read.id,{pathParams:{[key]:P},
      body:{private_override:true}})).toThrow();
  });
  it('executes a real provider-shaped selected TEST GET, strips raw metadata and denies LIVE',async()=>{
    const f=fixture(),record=find('GET','/v1/products/{product}');
    const key=paramNames(record,'path')[0].name;
    const result=parse(await f.call('api_read',{op:record.id,pathParams:{[key]:P}}));
    expect(result).toMatchObject({account:A,mode:'test',complete:true,
      provider:{id:P,object:'product',metadataKeys:[]}});
    expect(result.provider).not.toHaveProperty('metadata');
    expect(f.calls).toHaveLength(1);
    f.ctx.connection.mode='live';
    expect((await f.call('api_read',{op:record.id,pathParams:{[key]:P}})).isError)
      .toBe(true);
    expect(f.calls).toHaveLength(1);
  });
  it('keeps refunds/native financial ops and unreviewed creates behind original native authority',()=>{
    const refund=find('POST','/v1/refunds');
    expect(refund).toBeDefined();
    expect(preferredNative(refund)).toBe('payment_create_refund');
    expect(financialDecision(refund,{amount:100}).financial).toBe(true);
    const unknown={method:'POST',path:'/v1/future_outbound',summary:'Create a payment'};
    expect(financialDecision(unknown,{}).financial).toBe(true);
  });
  it('permits only original full TEST guarded universal operation, never standard or LIVE or unreviewed name',()=>{
    const t=registry.tools.find(x=>x.name==='api_write');
    expect(isGuardedTestWrite(t,{mode:'test',profile:'full'})).toBe(true);
    expect(isGuardedTestWrite(t,{mode:'test',profile:'read_only'})).toBe(false);
    expect(isGuardedTestWrite(t,{mode:'live',profile:'full'})).toBe(false);
    expect(listingForConnection(registry,{mode:'test',profile:'full',
      listing:'catalog'}).some(x=>x.name==='api_write')).toBe(true);
  });
  it('guarded raw nonmoney update previews, confirms with audited retry key and verifies original readback',async()=>{
    const f=fixture(),target=find('POST','/v1/tax_rates/{tax_rate}');
    expect(target).toBeDefined();
    const key=paramNames(target,'path')[0].name;
    const args={op:target.id,pathParams:{[key]:T},body:{metadata:{memo:'new'}}};
    const before=parse(await f.call('api_write',args));
    expect(before).toMatchObject({done:false,needsConfirmation:true});
    expect(f.calls.every(x=>x.method==='GET')).toBe(true);
    const outcome=parse(await f.call('api_write',{...args,confirm:true,
      requestKey:'u1-tax-metadata'}));
    expect(outcome).toMatchObject({done:true,confirmed:true,
      resourceId:T});
    expect(f.tax.metadata.memo).toBe('new');
    expect(f.calls.filter(x=>x.method==='POST')).toHaveLength(1);
    expect((await f.db.listAuditForTest()).length).toBeGreaterThan(0);
  });
  it('refuses app-owned metadata, unknown fields and financial update without issuing a write',async()=>{
    const f=fixture(),target=find('POST','/v1/tax_rates/{tax_rate}');
    const key=paramNames(target,'path')[0].name;
    const input={op:target.id,pathParams:{[key]:T},
      body:{metadata:{memo:'safe'}}};
    const bad=await f.call('api_write',{...input,body:{amount:300}});
    expect(bad.isError===true||String(parse(bad)).includes('Unknown')).toBe(true);
    f.tax.metadata.agreementId='APPLIANCE_OWNED';
    const owned=await f.call('api_write',input);
    expect(owned.isError===true||String(parse(owned)).includes('App-owned')).toBe(true);
    expect(f.calls.filter(x=>x.method==='POST')).toHaveLength(0);
  });
});
