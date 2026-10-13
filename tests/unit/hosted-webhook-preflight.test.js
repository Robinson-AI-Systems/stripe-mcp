import {describe,it,expect,vi} from 'vitest';
import {preflightWebhookIngress} from '../../src/acceptance/hosted-webhook-preflight.js';

const origin='https://stripe-test.example.test';
const sha='a'.repeat(40);
const account='acct_TESTACCOUNT',endpoint='we_TESTENDPOINT';
function fake({branch='live',environment='production',shaValue=sha,
  routeStatus=405,html=false,authError=false}={}){
  const seen=[];
  const fetcher=vi.fn(async(url,options)=>{
    seen.push({url,options});
    const path=new URL(url).pathname;
    if(html)return new Response('<html>SSO</html>',{
      status:200,headers:{'content-type':'text/html'}});
    if(path==='/api/contract')return new Response(JSON.stringify({
      rtc:1,access:'test_read_only_only',deployment:{
        sha:shaValue,ref:branch,environment}}),{
      status:authError?401:200,headers:{'content-type':'application/json'}});
    if(path==='/api/stripe/test-webhooks/'+account+'/'+endpoint)
      return new Response(JSON.stringify({error:routeStatus===405?
        'method_not_allowed':'not_found'}),{
        status:routeStatus,headers:{'content-type':'application/json',
          'cache-control':'no-store'}});
    throw Error('unexpected_request');
  });
  return {fetcher,seen};
}
const opts=fetcher=>({origin,approvedOrigin:origin,
  expectedDeploymentSha:sha,account,endpoint,fetcher});

describe('owner credential-free signed TEST webhook ingress preflight',()=>{
  it('verifies exact live revision and reachable receiver without any bearer, event or credential',async()=>{
    const {fetcher,seen}=fake();
    const result=await preflightWebhookIngress(opts(fetcher));
    expect(result).toMatchObject({status:'passed',
      checks:['exact_live_deployment','test_receiver_route'],
      signedWebhookDelivery:'not_run',receiverSecret:'not_checked'});
    expect(seen).toHaveLength(2);
    expect(seen.map(x=>new URL(x.url).pathname)).toEqual([
      '/api/contract','/api/stripe/test-webhooks/'+account+'/'+endpoint]);
    expect(seen.every(x=>x.options.method==='GET'&&
      x.options.redirect==='manual'&&x.options.body===undefined&&
      !Object.keys(x.options.headers).some(k=>k.toLowerCase()==='authorization')))
      .toBe(true);
    expect(JSON.stringify(result)).not.toContain(account);
    expect(JSON.stringify(result)).not.toContain(endpoint);
  });
  it('requires a real observed live revision before contacting webhook ingress',async()=>{
    for(const modified of [
      {branch:'main'},{environment:'preview'},{shaValue:'b'.repeat(40)},
      {authError:true}
    ]){
      const {fetcher,seen}=fake(modified);
      const result=await preflightWebhookIngress(opts(fetcher));
      expect(result).toMatchObject({status:'failed',stage:'deployment'});
      expect(seen).toHaveLength(1);
    }
    const {fetcher,seen}=fake();
    const result=await preflightWebhookIngress({
      ...opts(fetcher),expectedDeploymentSha:undefined});
    expect(result.code).toBe('deployment_unverified');
    expect(seen).toHaveLength(1);
  });
  it('does not treat 404, 200, protected ingress, or a transport failure as signed delivery',async()=>{
    for(const changed of [{routeStatus:404},{routeStatus:200},{html:true}]){
      const {fetcher}=fake(changed);
      const result=await preflightWebhookIngress(opts(fetcher));
      expect(result.status).toBe('failed');
      expect(result.signedWebhookDelivery).toBe('not_run');
    }
    const bad=await preflightWebhookIngress({...opts(async()=>{throw Error('private_token_exposed');})});
    expect(bad).toMatchObject({status:'failed',code:'ingress_unavailable'});
    expect(JSON.stringify(bad)).not.toContain('private_token_exposed');
  });
  it('refuses foreign origins, untrusted protocols, bad selectors before sending any request',async()=>{
    const {fetcher}=fake();
    for(const changes of [
      {approvedOrigin:'https://wrong.example.test'},{origin:'http://stripe-test.example.test'},
      {origin:'https://127.0.0.1'},{account:'acct_!'},{endpoint:'we_!'},
      {endpoint:['we_TESTENDPOINT']}
    ]){
      const result=await preflightWebhookIngress({...opts(fetcher),...changes});
      expect(result.status).toBe('failed');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
