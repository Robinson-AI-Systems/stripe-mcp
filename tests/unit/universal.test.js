import {describe,it,expect,vi,afterEach} from 'vitest';
afterEach(()=>vi.unstubAllEnvs());
import {catalog,getOperation,paramNames,checkedRequest,findOperations,requestSchema}
  from '../../src/stripe/openapi-index.js';
import {financialDecision} from '../../src/stripe/money-operations.js';
import {preferredNative} from '../../src/stripe/hand-built-map.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {isGuardedTestWrite,listingForConnection} from '../../src/core/profiles.js';
import {safePreparsedObject} from '../../src/core/http.js';

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
  const location={id:'tml_U1TEST',object:'terminal.location',livemode:false,
    metadata:{},display_name:'Greeley TEST'},state={deleted:false,createdTax:null};
  const stripe={rawRequest:async(method,path,params,opts)=>{
    calls.push({method,path,params,opts});
    if(path==='/v1/tax_rates'&&method==='POST'){
      state.createdTax={id:'txr_CREATEDTEST',object:'tax_rate',livemode:false,
        metadata:{},display_name:params.display_name,percentage:params.percentage,
        inclusive:params.inclusive};
      return {...state.createdTax};
    }
    if(path==='/v1/tax_rates/txr_CREATEDTEST'&&state.createdTax)
      return {...state.createdTax};
    if(path.includes('/terminal/locations/')){
      if(method==='DELETE'){state.deleted=true;return {id:location.id,
        object:'terminal.location',deleted:true,livemode:false};}
      if(state.deleted)throw Object.assign(new Error('Deleted TEST location'),
        {statusCode:404});
      return {...location};
    }
    if(path.includes('/tax_rates/')){
      if(method==='POST')Object.assign(tax.metadata,params.metadata);
      return {...tax,metadata:{...tax.metadata}};
    }
    if(path.includes('/products/'))return product;
    throw new Error('Unexpected original provider path '+path);
  }};
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:A},
    connectionId:'u1-provider',db,services:{stripeForConnection:async()=>stripe}};
  return {db,ctx,calls,tax,product,location,state,
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
    const read=find('GET','/v1/products/{id}');
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
  it('accepts strictly sanitized inert MCP JSON parameters but rejects custom object prototypes',()=>{
    const op=find('POST','/v1/tax_rates');
    const inert=safePreparsedObject({body:{display_name:'Allowed plain tax rate',
      percentage:5,inclusive:false}});
    expect(Object.getPrototypeOf(inert.body)).toBeNull();
    expect(checkedRequest(op.id,{body:inert.body})).toMatchObject({
      record:{id:op.id},body:{display_name:'Allowed plain tax rate',
        percentage:5,inclusive:false}});
    const exotic=Object.create(new Date());
    exotic.display_name='Forbidden';exotic.percentage=5;exotic.inclusive=false;
    expect(()=>checkedRequest(op.id,{body:exotic})).toThrow(/Only plain JSON/);
  });
  it('executes a selected TEST GET, redacts secrets, refuses mismatched LIVE data',async()=>{
    const f=fixture(),record=find('GET','/v1/products/{id}');
    const key=paramNames(record,'path')[0].name;
    const result=parse(await f.call('api_read',{op:record.id,pathParams:{[key]:P}}));
    expect(result).toMatchObject({account:A,mode:'test',complete:true,
      provider:{id:P,object:'product'}});
    expect(result.provider).not.toHaveProperty('metadata');
    expect(f.calls).toHaveLength(1);
    f.ctx.connection.mode='live';
    // Even a LIVE-selected connection may never receive TEST provider rows.
    expect((await f.call('api_read',{op:record.id,pathParams:{[key]:P}})).isError)
      .toBe(true);
    expect(f.calls).toHaveLength(2);
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

  it('reads only mode-consistent LIVE resources from an independently selected account',async()=>{
    const f=fixture(),op=find('GET','/v1/products/{id}');
    f.ctx.connection.mode='live';
    f.ctx.services.stripeForConnection=async connection=>{
      expect(connection).toMatchObject({mode:'live',stripeAccount:A});
      return {rawRequest:async(method,path)=>{
        expect(method).toBe('GET');
        expect(path).toBe('/v1/products/'+P);
        return {id:P,object:'product',livemode:true,metadata:{note:'live'}};
      }};
    };
    const result=parse(await f.call('api_read',{op:op.id,pathParams:{id:P}}));
    expect(result).toMatchObject({mode:'live',account:A,provider:{id:P}});
  });
  it('completes LIVE nonfinancial create only with original confirmation and provider readback',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture(),calls=[],account=A,op=find('POST','/v1/tax_rates');
    f.ctx.connection.mode='live';
    f.ctx.liveAccessGranted=true;
    f.ctx.db.getStripeAccount=async()=>({id:account,live_enabled:true,live_connected:true});
    let created;
    f.ctx.services.stripeForConnection=async connection=>{
      expect(connection.mode).toBe('live');
      return {rawRequest:async(method,path,params,options)=>{
        calls.push({method,path,params,options});
        if(method==='POST'&&path==='/v1/tax_rates'){
          created={id:'txr_LIVE123',object:'tax_rate',livemode:true,
            metadata:{},display_name:params.display_name,
            percentage:params.percentage,inclusive:params.inclusive};
          return {...created};
        }
        if(method==='GET'&&path==='/v1/tax_rates/txr_LIVE123')return {...created};
        throw new Error('Unexpected fake LIVE provider operation');
      }};
    };
    const params={op:op.id,body:{display_name:'Owner-approved LIVE tax',
      percentage:5,inclusive:false}};
    const preview=parse(await f.call('api_write',params));
    expect(preview).toMatchObject({mode:'LIVE',done:false,needsConfirmation:true});
    expect(calls.filter(x=>x.method==='POST')).toHaveLength(0);
    const done=parse(await f.call('api_write',{...params,confirm:true,
      requestKey:'owner-live-rate-create'}));
    expect(done).toMatchObject({mode:'LIVE',done:true,confirmed:true,
      resourceId:'txr_LIVE123'});
    expect(calls.filter(x=>x.method==='POST')).toHaveLength(1);
    expect(calls.some(x=>x.method==='GET'&&x.path==='/v1/tax_rates/txr_LIVE123')).toBe(true);
  });
  it('refuses forged LIVE owner flags before touching the provider',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=fixture(),op=find('POST','/v1/tax_rates');
    f.ctx.connection.mode='live';
    f.ctx.liveAccessGranted=false;
    let calls=0;
    f.ctx.services.stripeForConnection=async()=>({rawRequest:async()=>{
      calls++;throw Error('Unauthenticated attempt reached provider');
    }});
    const result=parse(await f.call('api_write',{op:op.id,
      body:{display_name:'No owner grant',percentage:3,inclusive:false},
      confirm:true,requestKey:'unapproved-live-attempt'}));
    expect(result.done).toBe(false);
    expect(calls).toBe(0);
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
  it('creates an independently read-back pinned nonfinancial TEST resource after preview',async()=>{
    const f=fixture(),op=find('POST','/v1/tax_rates');
    expect(op).toBeDefined();
    const a={op:op.id,body:{display_name:'Rental TEST Sales Tax',
      percentage:7.5,inclusive:false}};
    const preview=parse(await f.call('api_write',a));
    expect(preview).toMatchObject({done:false,needsConfirmation:true});
    expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(0);
    const verified=parse(await f.call('api_write',{...a,confirm:true,
      requestKey:'u1-creates-test-tax'}));
    expect(verified).toMatchObject({done:true,confirmed:true,
      resourceId:'txr_CREATEDTEST'});
    expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);
    expect(f.calls.some(c=>c.path==='/v1/tax_rates/txr_CREATEDTEST'&&
      c.method==='GET')).toBe(true);
    expect((await f.db.listAuditForTest()).length).toBeGreaterThan(0);
  });
  it('confirms pinned TEST deletion only after provider deletion reply AND definitive 404 readback',async()=>{
    const f=fixture(),op=find('DELETE','/v1/terminal/locations/{location}');
    expect(op).toBeDefined();
    const a={op:op.id,pathParams:{location:'tml_U1TEST'}};
    const preview=parse(await f.call('api_write',a));
    expect(preview).toMatchObject({done:false,needsConfirmation:true});
    expect(f.state.deleted).toBe(false);
    const accepted=parse(await f.call('api_write',{...a,confirm:true,
      requestKey:'u1-terminal-delete'}));
    expect(accepted).toMatchObject({done:true,confirmed:true,
      resourceId:'tml_U1TEST'});
    expect(f.state.deleted).toBe(true);
    expect(f.calls.filter(c=>c.method==='DELETE')).toHaveLength(1);
  });
  it('provides authorized full metadata but redacts secrets and rejects unsupported financial raw writes',async()=>{
    const f=fixture(),get=find('GET','/v1/products/{id}');
    f.product.metadata={note:'Owner approved',secret:'sk_test_FAKEDEMO1234567'};
    const full=parse(await f.call('api_read',{op:get.id,pathParams:{id:P},
      detail:'full',fields:'id,metadata'}));
    expect(full.provider).toMatchObject({id:P,
      metadata:{note:'Owner approved',secret:'[hidden]'}});
    const refund=find('POST','/v1/refunds');
    const denied=await f.call('api_write',{op:refund.id,body:{
      charge:'ch_U1TEST',amount:300}});
    expect(denied.isError).toBe(true);
    expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(0);
  });
  it('validates twenty-five different pinned GET operations using the original safe provider boundary',async()=>{
    const f=fixture(),calls=[];
    f.ctx.services.stripeForConnection=async()=>({rawRequest:async(method,path,params,opts)=>{
      calls.push({method,path,params,opts});
      return {object:'list',data:[],has_more:false,livemode:false};
    }});
    const sample=[...catalog().operations.values()].filter(x=>
      x.method==='GET'&&!x.path.includes('{')&&
      paramNames(x,'query').every(p=>p.required!==true)&&
      !paramNames(x,'query').some(p=>p.required)&&
      !/(?:secret|ephemeral_keys|tokens|person|bank_account|files|identity\/verification|issuing\/cardholders)/.test(x.path))
      .sort((a,b)=>a.path.localeCompare(b.path)).slice(0,25);
    expect(sample).toHaveLength(25);
    for(const op of sample){
      const result=parse(await f.call('api_read',{op:op.id}));
      expect(result).toMatchObject({mode:'test',account:A,complete:true,
        provider:{object:'list'}});
    }
    expect(calls).toHaveLength(25);
    expect(calls.every(x=>x.method==='GET')).toBe(true);
  });
  it('verifies ten distinct guarded TEST metadata POST operation contracts and original readbacks',async()=>{
    const f=fixture(),calls=[],state=new Map();
    f.ctx.services.stripeForConnection=async()=>({rawRequest:async(method,path,params,opts)=>{
      calls.push({method,path,params,opts});
      const id=decodeURIComponent(path.split('/').at(-1));
      let row=state.get(id)??{id,object:'generic',livemode:false,metadata:{}};
      if(method==='POST'){row={...row,metadata:{...row.metadata,...params.metadata}};state.set(id,row);}
      return {...row,metadata:{...row.metadata}};
    }});
    const sample=[...catalog().operations.values()].filter(x=>
      x.method==='POST'&&x.path.endsWith('}')&&x.root.paths[x.path]?.get&&
      !/(?:secret|ephemeral_keys|tokens|person|bank_account|files|identity\/verification|issuing\/cardholders)/.test(x.path)&&
      !preferredNative(x)&&requestSchema(x)?.properties?.metadata&&
      !requestSchema(x)?.required?.length)
      .sort((a,b)=>a.path.localeCompare(b.path)).slice(0,10);
    expect(sample).toHaveLength(10);
    for(const [i,op] of sample.entries()){
      const params=Object.fromEntries(paramNames(op,'path').map(z=>[z.name,'obj_U1TEST']));
      const args={op:op.id,pathParams:params,body:{metadata:{note:'reviewed'}}};
      const preview=parse(await f.call('api_write',args));
      expect(preview).toMatchObject({done:false,needsConfirmation:true});
      const result=parse(await f.call('api_write',{...args,confirm:true,
        requestKey:'distinct-u1-post-'+i}));
      expect(result).toMatchObject({done:true,confirmed:true});
    }
    expect(calls.filter(x=>x.method==='POST')).toHaveLength(10);
    expect(calls.filter(x=>x.method==='POST').every(x=>
      x.opts?.idempotencyKey?.startsWith('rmcp_'))).toBe(true);
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
