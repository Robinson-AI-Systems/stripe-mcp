// Direct original/source-vs-private-core bearer contract differential in CI.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import * as core from 'robinson-mcp-core/mcp-auth';
import {requireMcpToken as originalRequireMcpToken} from '../src/core/mcp-auth.js';
import {createStripeCoreMcpAuthenticator}
  from '../src/core/k3-mcp-auth-seams.js';
import {assertDisposableDb} from './k3-private-adoption-rehearsal.mjs';

function response(){
  return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(code){this.statusCode=code;return this;},
    send(payload){this.body=JSON.parse(payload);return this;}};
}
export async function proveBearer(){
  assertDisposableDb();
  const token=randomBytes(32).toString('base64url');
  let queries=0,accessors=0;
  const account='acct_K3BEARER';
  const record={
    kind:'connector',client_id:'client-K3-verified',
    stripe_account:account,mode:'test',profile:'read_only',
    listing:'compact',result_scope:'fixture-scope'
  };
  const db={async getAccessToken(value){queries++;return value===token?record:null;}};
  const env={PUBLIC_BASE_URL:'https://stripe-bearer.example.test'};
  const adapted=createStripeCoreMcpAuthenticator({core,db,env});
  const original=req=>{
    const r=response();
    return originalRequireMcpToken(req,r,db,env).then(claims=>({claims,r}));
  };
  const portable=req=>{
    const r=response();
    return adapted(req,r).then(claims=>({claims,r}));
  };
  for(const scheme of ['Bearer','bearer','BEARER','bEaReR']){
    const req={headers:{authorization:scheme+' '+token}};
    const a=await original(req),b=await portable(req);
    assert.deepEqual(b.claims,a.claims);
    assert.equal(b.claims.stripeAccount,account);
    assert.equal(b.claims.mode,'test');
    assert.equal(Object.isFrozen(b.claims),true);
    assert.equal(JSON.stringify(b).includes(token),false);
  }
  for(const header of ['Basic '+token,'Bearer '+token+' suffix',
    'Bearer '+token.slice(0,10),'Bearer rtc_pass_'+token]){
    const res=await portable({headers:{authorization:header}});
    assert.equal(res.claims,null);
    assert.equal(res.r.statusCode,401);
    assert.equal(JSON.stringify(res).includes(token),false);
  }
  const before=queries;
  const nested={headers:{authorization:'Bearer '+token}};
  Object.defineProperty(nested.headers,'authorization',{enumerable:true,
    get(){accessors++;throw Error('executed getter');}});
  for(const req of [nested,
    {headers:{authorization:'Bearer '+token},rawHeaders:[
      'Authorization','Bearer '+token,'authorization','Bearer '+token]},
    {headers:{authorization:'Bearer '+token},
      headersDistinct:{authorization:['Bearer '+token,'Bearer '+token]}}
  ]){
    const res=await portable(req);
    assert.equal(res.claims,null);
    assert.equal(res.r.statusCode,401);
  }
  assert.equal(accessors,0);
  assert.equal(queries,before);
  const wrong={...record,kind:'pass'};
  const nonTest={...record,mode:'live'};
  const badProfile={...record,profile:'superadmin'};
  for(const row of [wrong,nonTest,badProfile]){
    const bad=createStripeCoreMcpAuthenticator({core,db:{
      getAccessToken:async()=>row},env});
    const r=response(),claim=await bad({headers:{authorization:'Bearer '+token}},r);
    assert.equal(claim,null);
    assert.equal(r.statusCode,401);
  }
  const outage=createStripeCoreMcpAuthenticator({core,db:{
    getAccessToken:async()=>{throw Error('PRIVATE_SQL_DIAGNOSTIC');}},env});
  const r=response();
  assert.equal(await outage({headers:{authorization:'Bearer '+token}},r),null);
  assert.equal(r.statusCode,503);
  assert.equal(JSON.stringify(r).includes('PRIVATE_SQL_DIAGNOSTIC'),false);
  return {originalSchemeParity:4,credentialShapeDenials:4,
    duplicateAndGetterDenials:3,foreignKindAndModeDenials:3,
    storageOutageSanitized503:true,activeGetterExecutions:accessors,
    originalStripeAccountUnchanged:true,sourceOriginalActive:true,
    authenticatedOwnerMoneyApprovalSimulated:false,releaseReady:false};
}
if(process.argv[1]?.endsWith('k3-private-bearer-evidence.mjs')){
  try{console.log(JSON.stringify(await proveBearer()));}
  catch(e){console.error('Stripe K-3 bearer differential: '+e.message);process.exitCode=1;}
}
