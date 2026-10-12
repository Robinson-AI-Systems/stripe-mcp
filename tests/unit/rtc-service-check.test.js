import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {verifyRtcService,verifyRtcRevocation}
  from '../../src/acceptance/rtc-service-check.js';

const origin='https://stripe-acceptance.example.test';
const account='acct_RTCSECURE';
const token='rtc_pass_'+randomBytes(32).toString('base64url');
const other='rtc_pass_'+randomBytes(32).toString('base64url');
function fixture({wrongAccount=false,invalidWrite=false,provider=false,
  missingArea=false,revoked=false,permissionDenied=false}={}){
  const seen=[];
  const wire=async(url,init)=>{
    seen.push({path:new URL(url).pathname+new URL(url).search,method:init.method,
      redirected:init.redirect,authorization:init.headers.authorization,
      body:init.body});
    let status=200,value;
    switch(new URL(url).pathname){
      case '/api/contract':
        value={rtc:1,prefix:'stripe',access:'test_read_only_only',
          profiles:['read_only'],counts:{tools:2,writes:0,money:0}};
        break;
      case '/api/whoami':
        if(revoked){status=401;value={ok:false,error:{code:'pass_revoked'}};break;}
        value={ok:true,result:{account:wrongAccount?'acct_WRONG':account,
          mode:'test',profile:'read_only',allowWrites:false,moneyLimitCents:0,
          areas:missingArea?['server']:['server','account'],
          expiresAt:new Date(Date.now()+900000).toISOString()}};
        break;
      case '/api/tools':
        value={ok:true,result:{tools:[{name:'stripe_whoami',
          writes:false,money:false,destructive:false,profiles:['read_only']}]}};
        break;
      case '/api/tools/stripe_whoami':
        value={ok:true,result:{account,mode:'test'}};
        break;
      case '/api/tools/_batch':
        value={ok:true,result:{count:1,results:[{name:'stripe_whoami',
          result:{account,mode:'test'}}]}};
        break;
      case '/api/tools/stripe_payment_intent_create':
        status=invalidWrite?200:403;
        value=invalidWrite?{ok:true,result:{created:true}}:
          {ok:false,error:{code:'refused_by_guard'}};
        break;
      case '/api/tools/stripe_account_get':
        value={ok:true,result:permissionDenied?
          {id:account,available:false,verification:'not_readable'}:
          {id:provider?'acct_OTHER':account,
            chargesEnabled:true,payoutsEnabled:false,detailsSubmitted:true}};
        break;
      default: throw Error('Unexpected request');
    }
    return new Response(JSON.stringify(value),
      {status,headers:{'content-type':'application/json'}});
  };
  return {wire,seen};
}
const options=wire=>({origin,approvedOrigin:origin,pass:token,
  expectedAccount:account,fetcher:wire});

describe('RTC genuine hosted TEST acceptance runner (network injected, not external certification)',()=>{
  it('runs only approved safe HTTP doors and returns redacted evidence',async()=>{
    const {wire,seen}=fixture();
    const result=await verifyRtcService(options(wire));
    expect(result).toMatchObject({status:'passed',providerRead:'not_run'});
    expect(result.checks).toEqual(['manifest','identity','catalog',
      'direct_read','batch','write_refusal']);
    expect(seen).toHaveLength(6);
    expect(seen.every(x=>x.redirected==='manual')).toBe(true);
    expect(seen[0].authorization).toBeUndefined();
    expect(seen.slice(1).every(x=>x.authorization==='Bearer '+token)).toBe(true);
    expect(seen.every(x=>x.path.indexOf(token)<0)).toBe(true);
    expect(seen.filter(x=>x.method==='POST').map(x=>x.path)).toEqual([
      '/api/tools/stripe_whoami','/api/tools/_batch',
      '/api/tools/stripe_payment_intent_create']);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(account);
  });
  it('records actual provider read distinctly and projects only identity',async()=>{
    const {wire,seen}=fixture();
    const result=await verifyRtcService({...options(wire),providerRead:true});
    expect(result.providerRead).toBe('passed');
    expect(result.checks).toContain('provider_read');
    const request=seen.find(x=>x.path==='/api/tools/stripe_account_get');
    expect(JSON.parse(request.body)).toEqual({fields:['id','chargesEnabled',
      'payoutsEnabled','detailsSubmitted']});
    expect(JSON.stringify(result)).not.toContain(account);
  });
  it('refuses forged identity, enabled write and provider account mismatch',async()=>{
    for(const [opts,code] of [
      [{wrongAccount:true},'identity_mismatch'],
      [{invalidWrite:true},'unsafe_tool_not_refused'],
      [{provider:true},'provider_read_unverified'],
      [{missingArea:true},'provider_read_unverified'],
      [{permissionDenied:true},'provider_read_unverified']
    ]){
      const {wire,seen}=fixture(opts);
      const report=await verifyRtcService({...options(wire),
        providerRead:opts.provider||opts.missingArea||opts.permissionDenied});
      expect(report).toMatchObject({status:'failed',code});
      if(opts.wrongAccount)expect(seen).toHaveLength(2);
      if(opts.missingArea)expect(seen.some(s=>
        s.path==='/api/tools/stripe_account_get')).toBe(false);
    }
  });
  it('fails closed on untrusted or local origins, missing pass and HTML SSO',async()=>{
    const {wire,seen}=fixture();
    for(const changed of [
      {approvedOrigin:'https://other.example.test'},
      {origin:'https://127.0.0.1'},
      {origin:'https://localhost'},
      {pass:'Bearer fake'},
      {origin:'http://stripe-acceptance.example.test'}
    ]){
      const report=await verifyRtcService({...options(wire),...changed});
      expect(report.status).toBe('failed');
    }
    expect(seen).toHaveLength(0);
    const html=async()=>new Response('<html>SSO login</html>',{
      status:200,headers:{'content-type':'text/html'}});
    expect(await verifyRtcService(options(html))).toMatchObject({
      status:'failed',stage:'manifest',code:'non_json_ingress'});
  });
  it('accepts only actual revoked-pass 401, not a generic auth error',async()=>{
    const good=fixture({revoked:true});
    expect(await verifyRtcRevocation({origin,approvedOrigin:origin,
      revokedPass:other,fetcher:good.wire})).toMatchObject({
      status:'passed',checks:['revocation']});
    const live=fixture();
    expect(await verifyRtcRevocation({origin,approvedOrigin:origin,
      revokedPass:token,fetcher:live.wire})).toMatchObject({
      status:'failed',code:'revocation_not_proved'});
  });
});
