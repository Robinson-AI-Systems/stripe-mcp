import {describe,it,expect} from 'vitest';
import {createStripeCoreMcpAuthenticator}
  from '../../src/core/k3-mcp-auth-seams.js';
import {createMcpAuthOverlay} from '../../scripts/k3-mcp-auth-overlay.mjs';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../src/core/mcp-auth.js',import.meta.url),'utf8');
describe('K-3 Stripe-owned portable bearer seam',()=>{
  it('refuses missing portable validation or non-durable DB',()=>{
    for(const core of [null,{}, {authorizationHeaderEvidence(){}}])
      expect(()=>createStripeCoreMcpAuthenticator({core,db:{getAccessToken(){}}})).toThrow();
    expect(()=>createStripeCoreMcpAuthenticator({core:{
      authorizationHeaderEvidence(){},createMcpBearerAuthenticator(){}},db:{}})).toThrow();
  });
  it('keeps real source entry point while stage-generating a reversible adapter',()=>{
    expect(createMcpAuthOverlay(source)).toContain(
      "import * as core from 'robinson-mcp-core/mcp-auth'");
    expect(createMcpAuthOverlay(source)).toContain('createStripeCoreMcpAuthenticator');
    expect(()=>createMcpAuthOverlay('not a Stripe source')).toThrow();
  });
  it('normalizes only verified, single case-insensitive bearer tokens',async()=>{
    const token='x'.repeat(43);
    let actualHeader,projector;
    const core={
      authorizationHeaderEvidence:req=>({
        valid:req.good!==false,value:req.headers?.authorization}),
      createMcpBearerAuthenticator:({projectConnection})=>{
        projector=projectConnection;
        return async req=>{actualHeader=req.headers.authorization;return null;};
      }
    };
    const db={getAccessToken:async()=>null};
    const handler=createStripeCoreMcpAuthenticator({core,db,env:{}});
    await handler({headers:{authorization:'bEaReR '+token}},{});
    expect(actualHeader).toBe('Bearer '+token);
    await handler({good:false,headers:{authorization:'Bearer '+token}},{});
    expect(actualHeader).toBeUndefined();
    expect(projector({kind:'connector',mode:'live',profile:'full',listing:'catalog',
      client_id:'x',stripe_account:'acct_ONE',result_scope:'scope'})).toBeNull();
    expect(projector({kind:'pass',mode:'test',profile:'read_only',listing:'compact',
      client_id:'x',stripe_account:'acct_ONE',result_scope:'scope'})).toBeNull();
    expect(projector({kind:'connector',mode:'test',profile:'read_only',listing:'compact',
      client_id:'x',stripe_account:'acct_ONE',result_scope:'scope'})).toMatchObject({
        clientId:'x',stripeAccount:'acct_ONE',mode:'test',profile:'read_only'});
  });
});
