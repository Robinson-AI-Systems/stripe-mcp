// Stripe-owned K-3 OAuth protocol boundary, dependency-free in production.
// The private core is injected during disposable CI only. Owner login,
// redirect account selection and policy remain original Stripe handlers.
import {publicOrigin} from './http.js';
const profiles=new Set(['read_only','everyday','full']);
const listings=new Set(['catalog','compact']);
const own=(row,key)=>Object.getOwnPropertyDescriptor(row,key)?.value;

export function createStripeOAuthProtocolAdapter({core,source,db,env}){
  if(typeof core?.createOAuthProtocolHandlers!=='function'||
    typeof source?.createOAuthHandlers!=='function'||
    !db||['getOAuthClient','rotateRefreshToken','createAccessToken',
      'consumeAuthCode','createOAuthClient'].some(k=>typeof db[k]!=='function'))
    throw new TypeError('Real source OAuth UI, durable SQL and private protocol required');
  const original=source.createOAuthHandlers({db,env});
  const liveEligible=async accountId=>{
    if(env?.VERCEL_ENV!=='production'||typeof db.getStripeAccount!=='function')
      return false;
    try{
      const a=await db.getStripeAccount(accountId);
      return a?.id===accountId&&a.live_enabled===true&&a.live_connected===true;
    }catch{return false;}
  };
  const sql={
    createOAuthClient:(...args)=>db.createOAuthClient(...args),
    getOAuthClient:(...args)=>db.getOAuthClient(...args),
    consumeAuthCode:async(...args)=>{
      const row=await db.consumeAuthCode(...args);
      if(row?.mode==='live'&&!await liveEligible(row.stripe_account))return null;
      return row;
    },
    createAccessToken:(...args)=>db.createAccessToken(...args),
    async rotateRefreshToken({refreshToken,clientId,accessToken,newRefreshToken}){
      // Only durable SQL may consume a refresh token and retain the original
      // account/profile/listing. The generated token strings are never used
      // to infer or modify grant scope.
      const old=await db.rotateRefreshToken({refreshToken,clientId,accessToken,newRefreshToken});
      if(!old||typeof old!=='object'||Array.isArray(old)||
        ![Object.prototype,null].includes(Object.getPrototypeOf(old))) return null;
      const row={clientId,accessToken,refreshToken:newRefreshToken,
        ...Object.fromEntries(['stripe_account','mode','profile','listing'].map(k=>[k,own(old,k)]))};
      // DB is authoritative; never let the caller fill missing fields or LIVE.
      if(own(old,'client_id')!==clientId||typeof row.stripe_account!=='string'||
        !row.stripe_account||!['test','live'].includes(row.mode)||
        !profiles.has(row.profile)||!listings.has(row.listing)||
        row.mode==='live'&&!await liveEligible(row.stripe_account))return null;
      return row;
    }
  };
  const portable=core.createOAuthProtocolHandlers({
    db:sql,env,
    buildAccessRow:({accessToken,refreshToken,clientId,grant})=>{
      if(!grant||typeof grant!=='object'||Array.isArray(grant)||
        ![Object.prototype,null].includes(Object.getPrototypeOf(grant))||
        own(grant,'client_id')!==clientId||
        !['test','live'].includes(own(grant,'mode'))||
        (own(grant,'mode')==='live'&&env?.VERCEL_ENV!=='production')||
        typeof own(grant,'stripe_account')!=='string'||
        !own(grant,'stripe_account')||
        !profiles.has(own(grant,'profile'))||!listings.has(own(grant,'listing')))
        return null;
      // Existing original SQL parameter names are deliberate; the portable
      // validator asserts the access/refresh/client triplet before issuance.
      return {accessToken,refreshToken,clientId,
        stripeAccount:own(grant,'stripe_account'),mode:own(grant,'mode'),
        profile:own(grant,'profile'),listing:own(grant,'listing'),
        ...(own(grant,'mode')==='live'?{
          liveWriteApproved:own(grant,'live_write_approved')===true}:{})};
    }
  });
  // Owner ruling 2026-11-03, per D-001 client compatibility: at this
  // service's token door the `resource` parameter is OPTIONAL — the
  // source handler accepts an absent resource and validates one that is
  // sent. The portable protocol still mandates the parameter, so when
  // the client sent none the seam supplies the one resource this issuer
  // serves (the source handler's own urls() value). A resource the
  // client DID send passes through untouched: the core refuses a wrong
  // one (invalid_target), exactly as the source handler does. Same
  // adaptation pattern as the WWW-Authenticate realm mapping below.
  function supplyResourceIfAbsent(req){
    let resource;
    try{resource=publicOrigin(env)+'/api/mcp';}catch{return;}
    const absent=(v)=>v===undefined||v===null||v==='';
    if(req?.method==='GET'){
      if(req.query&&typeof req.query==='object'&&absent(req.query.resource))
        req.query.resource=resource;
      return;
    }
    const body=req?.body;
    if(body&&typeof body==='object'&&!Buffer.isBuffer(body)&&!Array.isArray(body)){
      if(absent(body.resource))body.resource=resource;
      return;
    }
    if(typeof body!=='string')return;
    const contentType=String(req.headers?.['content-type']||'')
      .split(';')[0].toLowerCase();
    if(contentType==='application/x-www-form-urlencoded'){
      const params=new URLSearchParams(body);
      if(absent(params.get('resource'))){
        params.set('resource',resource);
        req.body=params.toString();
      }
    }else if(contentType==='application/json'){
      try{
        const parsed=JSON.parse(body);
        if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&
          absent(parsed.resource)){
          parsed.resource=resource;
          req.body=JSON.stringify(parsed);
        }
      }catch{/* malformed bodies stay the core's refusal to make */}
    }
  }
  async function token(req,res){
    // Core's generic challenge uses realm "MCP OAuth", while existing
    // original Stripe OAuth clients assert "Stripe MCP OAuth". Preserve
    // the exact source WWW-Authenticate contract without changing auth.
    supplyResourceIfAbsent(req);
    const previous=res.setHeader;
    const oldDescriptor=Object.getOwnPropertyDescriptor(res,'setHeader');
    if(typeof previous!=='function') throw TypeError('HTTP response header writer required');
    res.setHeader=function(name,value){
      const mapped=String(name).toLowerCase()==='www-authenticate'&&
        value==='Basic realm="MCP OAuth"'
        ? 'Basic realm="Stripe MCP OAuth"' : value;
      return previous.call(this,name,mapped);
    };
    try{return await portable.token(req,res);}
    finally{
      // Do not leave request-specific response mutations behind.
      if(oldDescriptor)Object.defineProperty(res,'setHeader',oldDescriptor);
      else delete res.setHeader;
    }
  }
  return Object.freeze({
    register:original.register,authorize:original.authorize,
    token,metadata:original.metadata,
    resourceMetadata:original.resourceMetadata,
    // Optional portable token exchange must not remove the service-owned
    // disconnect endpoint advertised by the original issuer.
    ...(typeof original.revoke==='function'?{revoke:original.revoke}:{})
  });
}
