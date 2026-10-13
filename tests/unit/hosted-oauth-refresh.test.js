import {describe,it,expect,vi} from 'vitest';
import {verifyHostedOAuthRefresh} from '../../src/acceptance/hosted-oauth-refresh.js';
const origin='https://stripe-owner.example.test',sha='a'.repeat(40);
const account='acct_REFRESH',clientId='C'.repeat(32);
const accessToken='A'.repeat(43),refreshToken='R'.repeat(43);
const fresh='N'.repeat(43),newRefresh='S'.repeat(43);
function fixture({ref='live',environment='production',ssologin=false,
  tokenStatus=200,sameAccess=false,scopeWrong=false,oldValid=false}={}){
  const requests=[];
  const fetcher=vi.fn(async(url,init)=>{
    requests.push({url,init});
    if(ssologin)return new Response('<html>SSO</html>',{
      status:200,headers:{'content-type':'text/html'}});
    if(new URL(url).pathname==='/api/contract')
      return new Response(JSON.stringify({deployment:{
        sha,ref,environment}}),{status:200,headers:{'content-type':'application/json'}});
    if(new URL(url).pathname==='/api/oauth/token')
      return new Response(JSON.stringify({token_type:'Bearer',expires_in:3600,
        access_token:sameAccess?accessToken:fresh,refresh_token:newRefresh}),{
        status:tokenStatus,headers:{'content-type':'application/json'}});
    throw Error('Unexpected endpoint');
  });
  const observed=[];
  const verifyConnector=vi.fn(async x=>{
    observed.push({account:x.account,token:x.token});
    return {status:scopeWrong&&x.token===fresh?'failed':'passed'};
  });
  const verifyOldInvalid=vi.fn(async x=>({
    status:oldValid?'failed':'passed',revokedToken:x.revokedToken}));
  return {requests,fetcher,verifyConnector,verifyOldInvalid,observed};
}
const args=f=>({origin,approvedOrigin:origin,expectedDeploymentSha:sha,
  clientId,accessToken,refreshToken,account,fetcher:f.fetcher,
  verifyConnector:f.verifyConnector,verifyOldInvalid:f.verifyOldInvalid});
describe('opt-in genuine TEST OAuth refresh remote acceptance (fake transport, not real host)',()=>{
  it('attests revision, checks both SDK sessions, then refuses original rotated token',async()=>{
    const f=fixture(),report=await verifyHostedOAuthRefresh(args(f));
    expect(report).toMatchObject({status:'passed',
      requiresOwnerRevocation:true,pkceLogin:'not_checked'});
    expect(f.requests.map(x=>new URL(x.url).pathname))
      .toEqual(['/api/contract','/api/oauth/token']);
    const tokenPost=f.requests[1].init;
    expect(tokenPost.redirect).toBe('manual');
    expect(tokenPost.method).toBe('POST');
    expect(tokenPost.headers.authorization).toBeUndefined();
    expect(new URLSearchParams(tokenPost.body).get('resource')).toBe(origin+'/api/mcp');
    expect(new URLSearchParams(tokenPost.body).get('refresh_token')).toBe(refreshToken);
    expect(f.observed).toEqual([{account,token:accessToken},{account,token:fresh}]);
    expect(f.verifyOldInvalid).toHaveBeenCalledOnce();
    expect(f.verifyOldInvalid.mock.calls[0][0].revokedToken).toBe(accessToken);
    expect(JSON.stringify(report)).not.toContain(accessToken);
    expect(JSON.stringify(report)).not.toContain(refreshToken);
    expect(JSON.stringify(report)).not.toContain(fresh);
    expect(JSON.stringify(report)).not.toContain(newRefresh);
  });
  it('does not touch a bearer or refresh token until exact production SHA verified',async()=>{
    for(const change of [{ref:'main'},{environment:'preview'},{ssologin:true}]){
      const f=fixture(change);
      const report=await verifyHostedOAuthRefresh(args(f));
      expect(report).toMatchObject({status:'failed',refreshAttempted:false});
      expect(f.requests).toHaveLength(1);
      expect(f.verifyConnector).not.toHaveBeenCalled();
    }
  });
  it('refuses invalid creds and origin before any external request',async()=>{
    const f=fixture();
    for(const changes of [
      {clientId:'bad!'},{accessToken:'rtc_pass_'+'A'.repeat(43)},
      {refreshToken:accessToken},{approvedOrigin:'https://other.example.test'},
      {origin:'http://stripe-owner.example.test'},{account:'acct_!'}
    ])expect((await verifyHostedOAuthRefresh({...args(f),...changes}))
      .status).toBe('failed');
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('never retries consumed refresh if response is uncertain, malformed or scope changes',async()=>{
    for(const changes of [
      {tokenStatus:503},{sameAccess:true},{scopeWrong:true},{oldValid:true}
    ]){
      const f=fixture(changes);
      const report=await verifyHostedOAuthRefresh(args(f));
      expect(report).toMatchObject({status:'failed',refreshAttempted:true,
        requiresOwnerRevocation:true});
      expect(f.requests.filter(x=>new URL(x.url).pathname==='/api/oauth/token'))
        .toHaveLength(1);
    }
  });
});
