import {describe,it,expect} from 'vitest';
import {createStripeOAuthProtocolAdapter} from '../../src/core/k3-oauth-protocol-seams.js';
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
        authorize(){return 'authorize'},metadata(){},resourceMetadata(){}};
    }};
    const db=Object.fromEntries(['getOAuthClient','rotateRefreshToken',
      'createAccessToken','consumeAuthCode','createOAuthClient'].map(k=>[k,async()=>null]));
    const adapter=createStripeOAuthProtocolAdapter({core,source,db,env:{}});
    expect(sourceCalled).toBe(1);
    expect(adapter.token()).toBe('portable');
    expect(adapter.register()).toBe('register');
    expect(adapter.authorize()).toBe('authorize');
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
});
