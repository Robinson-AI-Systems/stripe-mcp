// K-3 owner-of-policy adapter for PRIVATE portable bearer verification.
// This module imports no private dependency. Original standalone
// requireMcpToken remains production-active until separately released/adopted.
const VALID_PROFILES=new Set(['read_only','everyday','full']);
const VALID_LISTINGS=new Set(['catalog','compact']);
const BEARER=/^[Bb][Ee][Aa][Rr][Ee][Rr][ \t]+([A-Za-z0-9_-]{30,256})$/;

export function createStripeCoreMcpAuthenticator({core,db,env=process.env}){
  if(typeof core?.authorizationHeaderEvidence!=='function'||
    typeof core?.createMcpBearerAuthenticator!=='function'||
    typeof db?.getAccessToken!=='function')
    throw new TypeError('Private core and durable service token lookup required');
  const gate=core.createMcpBearerAuthenticator({
    getAccessToken:token=>db.getAccessToken(token),
    projectConnection:record=>{
      // Only source-owned DB claims may grant account/profile. No caller
      // args, caller confirm, RTC pass or arbitrary injected profile may.
      if(!record||record.kind!=='connector'||record.mode!=='test'||
        !VALID_PROFILES.has(record.profile)||!VALID_LISTINGS.has(record.listing)||
        typeof record.client_id!=='string'||!record.client_id||
        typeof record.stripe_account!=='string'||
        !/^acct_[A-Za-z0-9]{2,100}$/.test(record.stripe_account)||
        typeof record.result_scope!=='string'||!record.result_scope)
        return null;
      return {
        clientId:record.client_id,stripeAccount:record.stripe_account,
        mode:'test',profile:record.profile,listing:record.listing,
        resultScope:record.result_scope
      };
    },env
  });
  return async(req,res)=>{
    // Validate the ORIGINAL Node transport's normalized/raw/distinct header
    // evidence before constructing a canonical bearer header for the portable
    // strict parser. Multiple or conflicting credentials cannot be hidden.
    const evidence=core.authorizationHeaderEvidence(req);
    const match=evidence?.valid && typeof evidence.value==='string'
      ? BEARER.exec(evidence.value):null;
    const headers=match?{authorization:'Bearer '+match[1]}:{};
    return gate({headers},res);
  };
}
