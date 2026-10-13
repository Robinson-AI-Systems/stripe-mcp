// Opt-in owner external acceptance of the STANDALONE custom MCP door.
// All connected credentials stay local in protected process environment.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {approvedOrigin,verifyDeployment} from './rtc-service-check.js';
const TOKEN=/^[A-Za-z0-9_-]{30,256}$/;
const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
const MAX=65536;
function demand(condition,code){if(!condition)throw new Error(code);}
async function boundedJson(reply){
  demand(/^application\/json\b/i.test(reply.headers?.get?.('content-type')??''),'protected_ingress');
  const len=reply.headers?.get?.('content-length');
  demand(len==null||/^\d+$/.test(len)&&Number(len)<=MAX,'unexpected_reply');
  const text=await reply.text();
  demand(Buffer.byteLength(text,'utf8')<=MAX,'unexpected_reply');
  try{return JSON.parse(text);}catch{throw new Error('unexpected_reply');}
}
async function attest(base,sha,fetcher){
  const reply=await fetcher(base+'/api/contract',{method:'GET',
    redirect:'manual',headers:{accept:'application/json'}});
  demand(reply.status===200,'deployment_unverified');
  verifyDeployment(await boundedJson(reply),sha);
}
function safeError(stage,error){
  const codes=['origin_invalid','origin_not_pinned','token_invalid','account_invalid',
    'deployment_unverified','deployment_mismatch','protected_ingress','unexpected_reply',
    'connector_unverified','connector_scope_mismatch','revocation_unverified'];
  return {status:'failed',stage,code:codes.includes(error?.message)?
    error.message:'remote_unavailable'};
}
function restrictedFetch(base,fetcher){
  // SDK may send session GET/DELETE in addition to POST. No credential-bearing
  // request may leave this exact pinned origin and standalone MCP path.
  return async(url,init={})=>{
    let destination;
    try{destination=new URL(String(url));}catch{throw new Error('Unsafe MCP endpoint');}
    if(destination.origin!==base||destination.pathname!=='/api/mcp'||
      destination.search||destination.hash)throw new Error('Unsafe MCP endpoint');
    return fetcher(destination.toString(),{...init,redirect:'manual'});
  };
}
async function realConnect({base,token,fetcher}){
  const client=new Client({name:'robinson-stripe-acceptance',version:'0.1.0'},
    {capabilities:{}});
  const transport=new StreamableHTTPClientTransport(new URL(base+'/api/mcp'),
    {requestInit:{headers:{authorization:'Bearer '+token}},
      fetch:restrictedFetch(base,fetcher)});
  try{await client.connect(transport);return client;}
  catch(error){await client.close().catch(()=>{});throw error;}
}
function identity(reply){
  if(reply?.isError===true||!Array.isArray(reply?.content)||
    reply.content.length!==1||reply.content[0]?.type!=='text'||
    typeof reply.content[0].text!=='string'||
    Buffer.byteLength(reply.content[0].text,'utf8')>8192)
    throw new Error('connector_unverified');
  try{return JSON.parse(reply.content[0].text);}catch{throw new Error('connector_unverified');}
}
export async function verifyHostedStandaloneMcp({
  origin,approvedOrigin:pin,expectedDeploymentSha,token,account,
  fetcher=fetch,connect=realConnect
}={}){
  let stage='setup',client;
  try{
    const base=approvedOrigin(origin,pin);
    demand(TOKEN.test(token)&&!token.startsWith('rtc_pass_'),'token_invalid');
    demand(ACCOUNT.test(account),'account_invalid');
    stage='deployment';
    await attest(base,expectedDeploymentSha,fetcher);
    stage='connector';
    client=await connect({base,token,fetcher:restrictedFetch(base,fetcher)});
    const listing=await client.listTools();
    demand(Array.isArray(listing?.tools)&&
      listing.tools.some(x=>x?.name==='stripe_whoami')&&
      !listing.tools.some(x=>x?.name==='stripe_payment_cancel'),
      'connector_scope_mismatch');
    const who=identity(await client.callTool({name:'stripe_whoami',arguments:{}}));
    demand(who?.account===account&&who.mode==='test'&&who.profile==='read_only',
      'connector_scope_mismatch');
    return {status:'passed',checks:['exact_live_deployment',
      'connected_mcp_sdk_catalog','selected_test_account_read'],
      pkceFlow:'not_checked',refresh:'not_checked',revocation:'not_checked',
      stripeProviderRead:'not_checked',note:'Standalone custom-MCP bearer and SDK only'};
  }catch(error){return safeError(stage,error);}
  finally{if(client)await client.close().catch(()=>{});}
}
export async function verifyHostedMcpRevocation({
  origin,approvedOrigin:pin,expectedDeploymentSha,revokedToken,fetcher=fetch
}={}){
  let stage='setup';
  try{
    const base=approvedOrigin(origin,pin);
    demand(TOKEN.test(revokedToken)&&!revokedToken.startsWith('rtc_pass_'),
      'token_invalid');
    stage='deployment';
    await attest(base,expectedDeploymentSha,fetcher);
    stage='revocation';
    const reply=await restrictedFetch(base,fetcher)(base+'/api/mcp',{
      method:'POST',headers:{authorization:'Bearer '+revokedToken,
        'content-type':'application/json',accept:'application/json, text/event-stream'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})
    });
    const body=await boundedJson(reply);
    demand(reply.status===401&&body?.error==='invalid_token',
      'revocation_unverified');
    return {status:'passed',checks:['exact_live_deployment',
      'revoked_connector_401'],note:'No live connector or Stripe API read'};
  }catch(error){return safeError(stage,error);}
}
