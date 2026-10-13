import {describe,it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createOwnerOAuthCallback,verifyOwnerBrowserPkce}
  from '../../src/acceptance/hosted-owner-pkce.js';
const sha='a'.repeat(40),origin='https://stripe-owner.example.test';
const account='acct_BROWSERTEST',clientId='C'.repeat(32);
const code='Q'.repeat(43),access='A'.repeat(43),refresh='R'.repeat(43);
const state='S'.repeat(43);
function fake({ref='live',ssologin=false,wrongClient=false,
  wrongToken=false,wrongAccount=false}={}){
  const seen=[],navigations=[],callbacks=[];
  const fetcher=vi.fn(async(url,init)=>{
    seen.push({url,init});
    if(ssologin)return new Response('<html>SSO</html>',{
      status:200,headers:{'content-type':'text/html'}});
    const path=new URL(url).pathname;
    if(path==='/api/contract')return new Response(JSON.stringify({
      deployment:{sha,ref,environment:'production'}}),{
      status:200,headers:{'content-type':'application/json'}});
    if(path==='/api/oauth/register')return new Response(JSON.stringify({
      client_id:wrongClient?'bad':clientId,
      token_endpoint_auth_method:'none',
      redirect_uris:['http://127.0.0.1:31415/callback']}),{
      status:201,headers:{'content-type':'application/json'}});
    if(path==='/api/oauth/token')return new Response(JSON.stringify({
      token_type:'Bearer',expires_in:3600,
      access_token:wrongToken?'bad':access,refresh_token:refresh}),{
      status:200,headers:{'content-type':'application/json'}});
    throw Error('Unexpected URI');
  });
  const callbackFactory=vi.fn(async({state:s})=>{
    callbacks.push(s);
    return {redirectUri:'http://127.0.0.1:31415/callback',
      receive:async()=>code,close:vi.fn(async()=>{})};
  });
  const verifyConnector=vi.fn(async()=>({status:wrongAccount?'failed':'passed'}));
  const onAuthorizeUrl=vi.fn(async(url)=>{navigations.push(new URL(url));});
  return {seen,fetcher,callbackFactory,verifyConnector,onAuthorizeUrl,
    navigations,callbacks};
}
const options=f=>({origin,approvedOrigin:origin,expectedDeploymentSha:sha,
  account,...f});
describe('owner-authorized browser PKCE external test (fixture, NOT hosted)',()=>{
  it('attests live, registers public client, uses exact S256 owner browser code and MCP SDK',async()=>{
    const f=fake();const result=await verifyOwnerBrowserPkce(options(f));
    expect(result).toMatchObject({status:'passed',
      requiresOwnerRevocation:true,refresh:'not_checked'});
    expect(f.seen.map(x=>new URL(x.url).pathname)).toEqual([
      '/api/contract','/api/oauth/register','/api/oauth/token']);
    expect(f.seen.every(x=>x.init.redirect==='manual')).toBe(true);
    expect(f.seen[0].init.headers.authorization).toBeUndefined();
    const request=JSON.parse(f.seen[1].init.body);
    expect(request.token_endpoint_auth_method).toBe('none');
    expect(request.redirect_uris).toEqual(['http://127.0.0.1:31415/callback']);
    const u=f.navigations[0];
    expect(u.origin).toBe(origin);
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('profile')).toBe('read_only');
    expect(u.searchParams.get('resource')).toBe(origin+'/api/mcp');
    expect(u.searchParams.get('state')).toBe(f.callbacks[0]);
    expect(u.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.has('passphrase')).toBe(false);
    const token=new URLSearchParams(f.seen[2].init.body);
    expect(token.get('code')).toBe(code);
    expect(token.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(f.verifyConnector.mock.calls[0][0]).toMatchObject({
      token:access,account,origin});
    expect(JSON.stringify(result)).not.toContain(access);
    expect(JSON.stringify(result)).not.toContain(refresh);
    expect(JSON.stringify(result)).not.toContain(clientId);
  });
  it('refuses unverified revision and SSO before DCR/callback/browser',async()=>{
    for(const changed of [{ref:'main'},{ssologin:true}]){
      const f=fake(changed);
      const result=await verifyOwnerBrowserPkce(options(f));
      expect(result.status).toBe('failed');
      expect(f.seen).toHaveLength(1);
      expect(f.callbackFactory).not.toHaveBeenCalled();
      expect(f.onAuthorizeUrl).not.toHaveBeenCalled();
    }
  });
  it('does not claim acceptance from malformed DCR, exchange or MCP scope',async()=>{
    for(const changed of [
      {wrongClient:true},{wrongToken:true},{wrongAccount:true}
    ]){
      const f=fake(changed);
      const report=await verifyOwnerBrowserPkce(options(f));
      expect(report.status).toBe('failed');
      expect(report.requiresOwnerRevocation).toBe(true);
    }
  });
  it('checks owner origin and selected account before network access',async()=>{
    const f=fake();
    for(const changes of [
      {origin:'http://stripe-owner.example.test'},
      {approvedOrigin:'https://different.example.test'},
      {account:'acct_!'},{onAuthorizeUrl:null}
    ]){
      expect((await verifyOwnerBrowserPkce({...options(f),...changes}))
        .status).toBe('failed');
    }
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});
describe('real ephemeral owner loopback PKCE callback',()=>{
  it('blocks wrong state, duplicate code, wrong path and accepts exactly one bound redirect',async()=>{
    const cb=await createOwnerOAuthCallback({state,timeoutMs:2000});
    try{
      const url=cb.redirectUri;
      const valid='?code='+code+'&state='+state;
      expect((await fetch(url.replace('/callback','/wrong')+valid)).status)
        .toBe(400);
      expect((await fetch(url+'?code='+code+'&state=not-the-state')).status)
        .toBe(400);
      expect((await fetch(url+valid+'&code='+code)).status).toBe(400);
      expect((await fetch(url+valid)).status).toBe(200);
      expect(await cb.receive()).toBe(code);
      expect((await fetch(url+valid)).status).toBe(400);
    }finally{await cb.close();}
  });
  it('times out without ever treating a missing code as an authorization',async()=>{
    const cb=await createOwnerOAuthCallback({state,timeoutMs:20});
    try{expect(await cb.receive()).toBeNull();}
    finally{await cb.close();}
  });
});
