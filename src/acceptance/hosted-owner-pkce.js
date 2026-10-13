// Owner-initiated *browser* OAuth code+S256 PKCE source-service acceptance.
// Only TEST/read_only may pass. Owner enters their passphrase in the ORIGINAL
// protected web form; this script never receives or sends the passphrase.
import {createServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {approvedOrigin,verifyDeployment} from './rtc-service-check.js';
import {verifyHostedStandaloneMcp} from './hosted-custom-mcp.js';
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const CLIENT=/^[A-Za-z0-9_-]{30,128}$/;
const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
function randomToken(bytes=32){return randomBytes(bytes).toString('base64url');}
const assert=(yes,code)=>{if(!yes)throw new Error(code);};
async function boundedJson(reply,max=4096){
  assert(/^application\/json\b/i.test(reply.headers?.get?.('content-type')??''),
    'protected_ingress');
  const len=reply.headers?.get?.('content-length');
  assert(len==null||/^\d+$/.test(len)&&Number(len)<=max,'invalid_http_reply');
  const body=await reply.text();
  assert(Buffer.byteLength(body,'utf8')<=max,'invalid_http_reply');
  try{return JSON.parse(body);}catch{throw new Error('invalid_http_reply');}
}
function safeError(stage,error,registered){
  const codes=['origin_invalid','origin_not_pinned','account_invalid',
    'deployment_unverified','deployment_mismatch','protected_ingress',
    'invalid_http_reply','dcr_unverified','callback_unavailable',
    'authorization_not_received','token_exchange_unverified',
    'connected_mcp_unverified'];
  return {status:'failed',stage,
    code:codes.includes(error?.message)?error.message:'remote_unavailable',
    registeredClient:registered,requiresOwnerRevocation:registered};
}
function stateMatches(actual,expected){
  if(typeof actual!=='string'||actual.length!==expected.length)return false;
  return timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
/** Bind only loopback; callback never prints its code or state in a response. */
export async function createOwnerOAuthCallback({state,timeoutMs=240000}={}){
  if(!TOKEN.test(state)||!Number.isSafeInteger(timeoutMs)||
    timeoutMs<1||timeoutMs>300000)throw new TypeError('Invalid private callback');
  let resolveCode,completed=false;
  const received=new Promise(resolve=>{resolveCode=resolve;});
  let timer;
  const server=createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    res.setHeader('X-Content-Type-Options','nosniff');
    let u;
    try{u=new URL(req.url,'http://127.0.0.1');}catch{}
    const host='127.0.0.1:'+server.address().port;
    const code=u?.searchParams.getAll('code')??[];
    const states=u?.searchParams.getAll('state')??[];
    const valid=req.method==='GET'&&req.headers.host===host&&
      u?.pathname==='/callback'&&code.length===1&&states.length===1&&
      u.searchParams.size===2&&TOKEN.test(code[0])&&
      stateMatches(states[0],state)&&!completed;
    if(!valid){
      res.statusCode=400;res.end('Invalid or expired authorization callback.');
      return;
    }
    completed=true;clearTimeout(timer);
    resolveCode(code[0]);
    res.statusCode=200;res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.end('TEST authorization received. Return to the local terminal.');
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  timer=setTimeout(()=>{if(!completed){completed=true;resolveCode(null);}},timeoutMs);
  return {redirectUri:'http://127.0.0.1:'+server.address().port+'/callback',
    receive:()=>received,
    close:async()=>{
      clearTimeout(timer);
      if(!completed){completed=true;resolveCode(null);}
      if(server.listening)await new Promise(resolve=>server.close(()=>resolve()));
    }};
}
/**
 * One private owner browser DCR/PKCE cycle. onAuthorizeUrl receives an
 * ephemeral browser navigation URL; never persist it in a PR or chat.
 * The owner MUST revoke the temporary connection through protected setup.
 */
export async function verifyOwnerBrowserPkce({
  origin,approvedOrigin:pin,expectedDeploymentSha,account,
  fetcher=fetch,callbackFactory=createOwnerOAuthCallback,
  onAuthorizeUrl,verifyConnector=verifyHostedStandaloneMcp
}={}){
  let stage='setup',registered=false,callback;
  try{
    const base=approvedOrigin(origin,pin);
    assert(ACCOUNT.test(account),'account_invalid');
    assert(typeof onAuthorizeUrl==='function','authorization_not_received');
    stage='deployment';
    const deployed=await fetcher(base+'/api/contract',{method:'GET',
      redirect:'manual',headers:{accept:'application/json'}});
    assert(deployed.status===200,'deployment_unverified');
    verifyDeployment(await boundedJson(deployed),expectedDeploymentSha);
    const state=randomToken(),verifier=randomToken();
    const challenge=createHash('sha256').update(verifier).digest('base64url');
    callback=await callbackFactory({state});
    assert(typeof callback?.redirectUri==='string'&&
      /^http:\/\/127\.0\.0\.1:[0-9]{1,5}\/callback$/.test(callback.redirectUri)&&
      typeof callback.receive==='function'&&typeof callback.close==='function',
      'callback_unavailable');
    stage='register';
    const dcr=await fetcher(base+'/api/oauth/register',{method:'POST',
      redirect:'manual',headers:{'content-type':'application/json',
        accept:'application/json'},body:JSON.stringify({
        client_name:'Owner TEST-only verification',
        token_endpoint_auth_method:'none',redirect_uris:[callback.redirectUri],
        response_types:['code'],grant_types:['authorization_code','refresh_token']
      })});
    assert(dcr.status===201,'dcr_unverified');
    // A successful DCR may have created a client even if its returned metadata
    // cannot be trusted. Treat all later errors as requiring owner cleanup.
    registered=true;
    const client=await boundedJson(dcr);
    assert(CLIENT.test(client?.client_id)&&
      client.token_endpoint_auth_method==='none'&&
      client.client_secret===undefined&&
      Array.isArray(client.redirect_uris)&&
      client.redirect_uris.length===1&&
      client.redirect_uris[0]===callback.redirectUri,'dcr_unverified');
    stage='owner_browser';
    const authorize=new URL(base+'/api/oauth/authorize');
    for(const [key,value] of Object.entries({
      client_id:client.client_id,redirect_uri:callback.redirectUri,
      response_type:'code',code_challenge:challenge,
      code_challenge_method:'S256',state,resource:base+'/api/mcp',
      profile:'read_only',listing:'catalog',mode:'test'
    }))authorize.searchParams.set(key,value);
    // The browser performs both protected SSO and owner passphrase entry;
    // never auto-submit the private owner form.
    await onAuthorizeUrl(authorize.toString());
    const code=await callback.receive();
    assert(TOKEN.test(code),'authorization_not_received');
    stage='exchange';
    const exchanged=await fetcher(base+'/api/oauth/token',{method:'POST',
      redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',
        accept:'application/json'},body:new URLSearchParams({
        grant_type:'authorization_code',client_id:client.client_id,
        code,redirect_uri:callback.redirectUri,code_verifier:verifier,
        resource:base+'/api/mcp'
      }).toString()});
    assert(exchanged.status===200,'token_exchange_unverified');
    const issued=await boundedJson(exchanged);
    assert(issued.token_type==='Bearer'&&issued.expires_in===3600&&
      TOKEN.test(issued.access_token)&&TOKEN.test(issued.refresh_token)&&
      issued.access_token!==issued.refresh_token,'token_exchange_unverified');
    stage='connected_mcp';
    const accepted=await verifyConnector({
      origin:base,approvedOrigin:base,expectedDeploymentSha,
      token:issued.access_token,account,fetcher});
    assert(accepted?.status==='passed','connected_mcp_unverified');
    return {status:'passed',
      checks:['exact_live_deployment','public_client_registration',
        'owner_browser_pkce_code','source_oauth_code_exchange',
        'sdk_standalone_test_read_only_identity'],
      requiresOwnerRevocation:true,refresh:'not_checked',
      stripeProviderRead:'not_checked',hubRoutes:'not_checked',
      note:'Revoke temporary TEST client in protected owner setup immediately'};
  }catch(error){return safeError(stage,error,registered);}
  finally{if(callback)await callback.close().catch(()=>{});}
}
