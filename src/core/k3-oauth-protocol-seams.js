// Stripe-owned K-3 OAuth protocol boundary, dependency-free in production.
// The private core is injected during disposable CI only. Owner login,
// redirect account selection and policy remain original Stripe handlers.
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
  const sql={
    createOAuthClient:(...args)=>db.createOAuthClient(...args),
    getOAuthClient:(...args)=>db.getOAuthClient(...args),
    consumeAuthCode:(...args)=>db.consumeAuthCode(...args),
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
        !row.stripe_account||row.mode!=='test'||!profiles.has(row.profile)||
        !listings.has(row.listing)) return null;
      return row;
    }
  };
  const portable=core.createOAuthProtocolHandlers({
    db:sql,env,
    buildAccessRow:({accessToken,refreshToken,clientId,grant})=>{
      if(!grant||typeof grant!=='object'||Array.isArray(grant)||
        ![Object.prototype,null].includes(Object.getPrototypeOf(grant))||
        own(grant,'client_id')!==clientId||own(grant,'mode')!=='test'||
        typeof own(grant,'stripe_account')!=='string'||
        !own(grant,'stripe_account')||
        !profiles.has(own(grant,'profile'))||!listings.has(own(grant,'listing')))
        return null;
      // Existing original SQL parameter names are deliberate; the portable
      // validator asserts the access/refresh/client triplet before issuance.
      return {accessToken,refreshToken,clientId,
        stripeAccount:own(grant,'stripe_account'),mode:'test',
        profile:own(grant,'profile'),listing:own(grant,'listing')};
    }
  });
  async function token(req,res){
    // Core's generic challenge uses realm "MCP OAuth", while existing
    // original Stripe OAuth clients assert "Stripe MCP OAuth". Preserve
    // the exact source WWW-Authenticate contract without changing auth.
    const previous=res.setHeader;
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
      if(Object.hasOwn(res,'setHeader'))delete res.setHeader;
    }
  }
  return Object.freeze({
    register:original.register,authorize:original.authorize,
    token,metadata:original.metadata,
    resourceMetadata:original.resourceMetadata
  });
}
