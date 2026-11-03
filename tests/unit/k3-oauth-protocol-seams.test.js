import {describe,it,expect} from 'vitest';
import {createStripeOAuthProtocolAdapter} from '../../src/core/k3-oauth-protocol-seams.js';
import {paramsOf} from '../../src/core/http.js';
import {createOAuthProtocolOverlay} from '../../scripts/k3-oauth-overlay.mjs';
import {readFileSync,existsSync} from 'node:fs';
describe('K-3 portable OAuth protocol / original Stripe identity',()=>{
  const pristine=new URL('../../src/core/k3-oauth-original-private.js',import.meta.url);
  const source=readFileSync(existsSync(pristine)?pristine:
    new URL('../../src/core/oauth-handlers.js',import.meta.url),'utf8');
  it('generates a reversible source handler overlay, not a runtime dependency',()=>{
    expect(createOAuthProtocolOverlay(source)).toContain("robinson-mcp-core/oauth-protocol");
    expect(createOAuthProtocolOverlay(source)).toContain('k3-oauth-original-private.js');
    expect(()=>createOAuthProtocolOverlay('fake source')).toThrow();
  });
  it('requires an authentic durable token service, never inferred credentials',()=>{
    expect(()=>createStripeOAuthProtocolAdapter({core:{},source:{},db:{}})).toThrow();
    const bare={createOAuthProtocolHandlers(){},};
    expect(()=>createStripeOAuthProtocolAdapter({core:bare,
      source:{createOAuthHandlers(){}},db:{}})).toThrow();
  });
  it('forwards only TEST durable original authorization claims',async()=>{
    let builder;
    let sourceCalled=0;
    const core={createOAuthProtocolHandlers(opts){
      builder=opts;
      return {token(){return 'portable'}};
    }};
    const source={createOAuthHandlers(){
      sourceCalled++;return {register(){return 'register'},
        authorize(){return 'authorize'},metadata(){},resourceMetadata(){},revoke(){return 'source-revoke'}};
    }};
    const db=Object.fromEntries(['getOAuthClient','rotateRefreshToken',
      'createAccessToken','consumeAuthCode','createOAuthClient'].map(k=>[k,async()=>null]));
    const adapter=createStripeOAuthProtocolAdapter({core,source,db,env:{}});
    expect(sourceCalled).toBe(1);
    const res={setHeader(){}};
    expect(await adapter.token({},res)).toBe('portable');
    expect(typeof res.setHeader).toBe('function');
    expect(adapter.register()).toBe('register');
    expect(adapter.authorize()).toBe('authorize');
    expect(adapter.revoke()).toBe('source-revoke');
    const safe={client_id:'client',mode:'test',stripe_account:'acct_One_2',
      profile:'read_only',listing:'compact'};
    expect(builder.buildAccessRow({accessToken:'access',refreshToken:'refresh',
      clientId:'client',grant:safe})).toEqual({accessToken:'access',
        refreshToken:'refresh',clientId:'client',stripeAccount:'acct_One_2',
        mode:'test',profile:'read_only',listing:'compact'});
    for(const row of [{...safe,mode:'live'},{...safe,profile:'admin'},
      {...safe,client_id:'other'},{...safe,stripe_account:''}])
      expect(builder.buildAccessRow({accessToken:'access',refreshToken:'refresh',
        clientId:'client',grant:row})).toBeNull();
  });
  it('accepts an original owner-issued LIVE code only on its current production account',async()=>{
    let adapter;
    const core={createOAuthProtocolHandlers(x){adapter=x;return {token(){}}}};
    const source={createOAuthHandlers(){return {}}};
    const db={
      getOAuthClient:async()=>null,createOAuthClient:async()=>null,
      createAccessToken:async()=>null,rotateRefreshToken:async()=>null,
      consumeAuthCode:async()=>({client_id:'owner',stripe_account:'acct_LiveOwner',
        mode:'live',profile:'full',listing:'catalog',live_write_approved:true}),
      getStripeAccount:async()=>({id:'acct_LiveOwner',
        live_enabled:true,live_connected:true})
    };
    createStripeOAuthProtocolAdapter({core,source,db,env:{VERCEL_ENV:'production'}});
    const grant=await adapter.db.consumeAuthCode('test-code');
    expect(adapter.buildAccessRow({accessToken:'access',refreshToken:'refresh',
      clientId:'owner',grant})).toMatchObject({
        stripeAccount:'acct_LiveOwner',mode:'live',liveWriteApproved:true});
    db.getStripeAccount=async()=>({id:'acct_LiveOwner',
      live_enabled:false,live_connected:true});
    expect(await adapter.db.consumeAuthCode('disabled-code')).toBeNull();
    createStripeOAuthProtocolAdapter({core,source,db,env:{}});
    expect(adapter.buildAccessRow({accessToken:'access',refreshToken:'refresh',
      clientId:'owner',grant})).toBeNull();
  });
  it('retains true durable row account across refresh instead of caller scope',async()=>{
    let handlers;
    const core={createOAuthProtocolHandlers(x){handlers=x;return {token(){}}}};
    const source={createOAuthHandlers(){return {}}};
    let sqlCount=0;
    const db=Object.fromEntries(['getOAuthClient','createAccessToken',
      'consumeAuthCode','createOAuthClient'].map(k=>[k,async()=>null]));
    db.rotateRefreshToken=async()=>{sqlCount++;return {
      client_id:'client',stripe_account:'acct_with_underscores',
      mode:'test',profile:'everyday',listing:'catalog'};
    };
    createStripeOAuthProtocolAdapter({core,source,db,env:{}});
    const rotated=await handlers.db.rotateRefreshToken({
      clientId:'client',refreshToken:'old',accessToken:'next',newRefreshToken:'new'});
    expect(rotated).toMatchObject({clientId:'client',accessToken:'next',
      refreshToken:'new',stripe_account:'acct_with_underscores',mode:'test'});
    expect(sqlCount).toBe(1);
    db.rotateRefreshToken=async()=>({...rotated,client_id:'other'});
    expect(await handlers.db.rotateRefreshToken({clientId:'client'})).toBeNull();
  });
  it('supplies the issuer resource only when the client sent none (owner ruling 2026-11-03, D-001)',async()=>{
    // Fake portable core with the private protocol's CURRENT contract:
    // resource is mandatory and must name this MCP exactly.
    const expected='https://stripe-mcp.example.test/api/mcp';
    const seen=[];
    const core={createOAuthProtocolHandlers(){
      return {token(req){
        const p=paramsOf(req);
        seen.push(p.resource);
        if(p.resource===undefined||p.resource===null||p.resource==='')
          return {status:400,error:'invalid_target'};
        if(p.resource!==expected)return {status:400,error:'invalid_target'};
        return {status:200};
      }};
    }};
    const source={createOAuthHandlers(){
      return {register(){},authorize(){},metadata(){},resourceMetadata(){}};
    }};
    const db=Object.fromEntries(['getOAuthClient','rotateRefreshToken',
      'createAccessToken','consumeAuthCode','createOAuthClient'].map(k=>[k,async()=>null]));
    const res=()=>({setHeader(){}});
    const adapter=createStripeOAuthProtocolAdapter({core,source,db,
      env:{PUBLIC_BASE_URL:'https://stripe-mcp.example.test'}});
    // Absent resource: the seam supplies the issuer's one resource.
    expect(await adapter.token({method:'POST',headers:{},
      body:{grant_type:'authorization_code'}},res())).toEqual({status:200});
    // The consent form's empty re-submission counts as absent too.
    expect(await adapter.token({method:'POST',headers:{},
      body:{grant_type:'authorization_code',resource:''}},res())).toEqual({status:200});
    // A sent resource passes through untouched — wrong one still refused
    // by the core, correct one accepted as sent.
    expect(await adapter.token({method:'POST',headers:{},
      body:{grant_type:'authorization_code',
        resource:'https://elsewhere.example.test/api/mcp'}},res()))
      .toEqual({status:400,error:'invalid_target'});
    expect(await adapter.token({method:'POST',headers:{},
      body:{grant_type:'authorization_code',resource:expected}},res())).toEqual({status:200});
    // Form-encoded bodies get the same treatment.
    expect(await adapter.token({method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:'grant_type=authorization_code'},res())).toEqual({status:200});
    expect(seen).toEqual([expected,expected,
      'https://elsewhere.example.test/api/mcp',expected,expected]);
    // Unconfigured origin: nothing is supplied and nothing throws — the
    // request reaches the core exactly as the client sent it.
    const bare=createStripeOAuthProtocolAdapter({core,source,db,env:{}});
    expect(await bare.token({method:'POST',headers:{},
      body:{grant_type:'authorization_code'}},res()))
      .toEqual({status:400,error:'invalid_target'});
    expect(seen.at(-1)).toBeUndefined();
  });
});
