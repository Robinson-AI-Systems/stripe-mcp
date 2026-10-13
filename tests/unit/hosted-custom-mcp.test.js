import {describe,it,expect,vi} from 'vitest';
import {verifyHostedStandaloneMcp,verifyHostedMcpRevocation}
  from '../../src/acceptance/hosted-custom-mcp.js';

const origin='https://stripe-owner.example.test';
const sha='a'.repeat(40),token='mcp_'+'A'.repeat(43),account='acct_MCPWEB';
function fixture({ref='live',environment='production',wrongIdentity=false,
  writeVisible=false,ssologin=false,revoked=false}={}){
  const seen=[],mcp=[],calls=[];
  const fetcher=vi.fn(async(url,init)=>{
    seen.push({url,init});
    if(ssologin)return new Response('<html>SSO</html>',{
      status:200,headers:{'content-type':'text/html'}});
    if(new URL(url).pathname==='/api/contract'){
      return new Response(JSON.stringify({rtc:1,deployment:{
        sha,ref,environment}}),{status:200,
        headers:{'content-type':'application/json'}});
    }
    if(new URL(url).pathname==='/api/mcp'){
      return new Response(JSON.stringify(revoked?{error:'invalid_token'}:
        {error:'unauthorized'}),{status:revoked?401:403,
        headers:{'content-type':'application/json'}});
    }
    throw Error('unexpected');
  });
  const connect=vi.fn(async({base,token:secret,fetcher:safe})=>{
    mcp.push(base);
    // The injected transport can only reach the isolated pinned endpoint.
    await expect(safe('https://evil.example.test/api/mcp',{method:'POST'}))
      .rejects.toThrow('Unsafe MCP endpoint');
    await expect(safe(base+'/api/tools/stripe_whoami',{method:'POST'}))
      .rejects.toThrow('Unsafe MCP endpoint');
    expect(secret).toBe(token);
    return {listTools:async()=>({tools:[
      {name:'stripe_whoami'},...(writeVisible?[{name:'stripe_payment_cancel'}]:[])]}),
      callTool:async arg=>{calls.push(arg);return {content:[{type:'text',
        text:JSON.stringify({account:wrongIdentity?'acct_WRONG':account,
          mode:'test',profile:'read_only'})}]};},
      close:vi.fn(async()=>{})};
  });
  return {fetcher,connect,seen,mcp,calls};
}
const opts=f=>({origin,approvedOrigin:origin,
  expectedDeploymentSha:sha,token,account,...f});
describe('owner protected actual standalone custom-MCP SDK acceptance (fixture transport)',()=>{
  it('attests live before credentials, projects identity and labels unverified layers',async()=>{
    const f=fixture();
    const result=await verifyHostedStandaloneMcp(opts(f));
    expect(result).toMatchObject({status:'passed',pkceFlow:'not_checked',
      refresh:'not_checked',stripeProviderRead:'not_checked'});
    expect(f.seen).toHaveLength(1);
    expect(f.seen[0].init.headers.authorization).toBeUndefined();
    expect(f.connect).toHaveBeenCalledOnce();
    expect(f.calls).toEqual([{name:'stripe_whoami',arguments:{}}]);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(account);
  });
  it('rejects stale/main/preview and SSO without creating the bearer transport',async()=>{
    for(const changed of [{ref:'main'},{environment:'preview'},{ssologin:true}]){
      const f=fixture(changed);
      const result=await verifyHostedStandaloneMcp(opts(f));
      expect(result.status).toBe('failed');
      expect(f.connect).not.toHaveBeenCalled();
    }
  });
  it('rejects scope elevation, wrong TEST account, RTC pass and unpinned origins',async()=>{
    for(const changed of [{wrongIdentity:true},{writeVisible:true}]){
      const f=fixture(changed);
      expect(await verifyHostedStandaloneMcp(opts(f))).toMatchObject({
        status:'failed',code:'connector_scope_mismatch'});
    }
    const f=fixture();
    for(const changes of [{token:'rtc_pass_'+'A'.repeat(43)},
      {approvedOrigin:'https://wrong.example.test'},
      {origin:'http://stripe-owner.example.test'},{account:'acct_!'}]){
      expect((await verifyHostedStandaloneMcp({...opts(f),...changes}))
        .status).toBe('failed');
    }
    expect(f.connect).not.toHaveBeenCalled();
  });
  it('accepts only actual custom-MCP revoked invalid_token, not SSO or 403',async()=>{
    const f=fixture({revoked:true});
    const config={origin,approvedOrigin:origin,expectedDeploymentSha:sha,
      revokedToken:token,fetcher:f.fetcher};
    expect(await verifyHostedMcpRevocation(config)).toMatchObject({
      status:'passed',checks:['exact_live_deployment','revoked_connector_401']});
    const posted=f.seen.find(x=>new URL(x.url).pathname==='/api/mcp');
    expect(posted.init.redirect).toBe('manual');
    expect(posted.init.headers.authorization).toBe('Bearer '+token);
    for(const changed of [{revoked:false},{ssologin:true}]){
      const denied=fixture(changed);
      expect((await verifyHostedMcpRevocation({
        ...config,fetcher:denied.fetcher})).status).toBe('failed');
    }
  });
});
