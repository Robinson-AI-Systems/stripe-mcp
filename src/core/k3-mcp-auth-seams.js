// K-3 owner-of-policy adapter for PRIVATE portable bearer verification.
// This module imports no private dependency. Original standalone
// requireMcpToken remains production-active until separately released/adopted.
import {publicOrigin} from './http.js';
import {resolveGrantContext,contextMayOperate,journalBoundaryEvent}
  from '../developer/access.js';
const VALID_PROFILES=new Set(['read_only','everyday','full']);
const VALID_LISTINGS=new Set(['catalog','compact']);
const BEARER=/^[Bb][Ee][Aa][Rr][Ee][Rr][ \t]+([A-Za-z0-9_-]{30,256})$/;

export function createStripeCoreMcpAuthenticator({core,db,env=process.env}){
  if(typeof core?.authorizationHeaderEvidence!=='function'||
    typeof core?.createMcpBearerAuthenticator!=='function'||
    typeof db?.getAccessToken!=='function')
    throw new TypeError('Private core and durable service token lookup required');
  const gate=core.createMcpBearerAuthenticator({
    getAccessToken:async token=>{
      const record=await db.getAccessToken(token);
      if(!record)return record;
      // Fleet developer access boundary (D-001) — source-owned policy the
      // portable authenticator must match exactly, or the K-3 bearer
      // differential fails: resolve the grant context the same way
      // src/core/mcp-auth.js does (issuance stamp wins, else derive from
      // the registered client when the store can answer), confine
      // developer context to TEST with the refusal journaled, and carry
      // the resolved context into the projected claims.
      const origin=publicOrigin(env);
      let context=record.context==='developer'?'developer':'customer';
      if(context!=='developer'&&typeof db.getOAuthClient==='function'){
        let client=null;
        try{client=await db.getOAuthClient(record.client_id);}catch{client=null;}
        context=resolveGrantContext({record,client,origin});
      }
      if(!contextMayOperate({context,mode:record.mode})){
        await journalBoundaryEvent(db,{surface:'mcp',context,mode:record.mode,
          reason:'developer_live_access_refused',clientId:record.client_id});
        return null;
      }
      const enriched={...record,__context:context};
      if(enriched.mode!=='live')return enriched;
      if(env.VERCEL_ENV!=='production'||typeof db.getStripeAccount!=='function')
        return null;
      try{
        const account=await db.getStripeAccount(enriched.stripe_account);
        if(account?.id!==enriched.stripe_account||account.live_enabled!==true||
          account.live_connected!==true)return null;
        return {...enriched,__verifiedLive:true};
      }catch{return null;}
    },
    projectConnection:record=>{
      // Only source-owned DB claims may grant account/profile. No caller
      // args, caller confirm, RTC pass or arbitrary injected profile may.
      if(!record||record.kind!=='connector'||!(record.mode==='test'||record.mode==='live'&&record.__verifiedLive===true)||
        !VALID_PROFILES.has(record.profile)||!VALID_LISTINGS.has(record.listing)||
        typeof record.client_id!=='string'||!record.client_id||
        typeof record.stripe_account!=='string'||!record.stripe_account||
        typeof record.result_scope!=='string'||!record.result_scope)
        return null;
      return {
        clientId:record.client_id,stripeAccount:record.stripe_account,
        mode:record.mode,profile:record.profile,listing:record.listing,
        context:record.__context||'customer',
        rtcLiveOwnerApproved:record.mode==='live'&&record.allow_writes===true,
        moneyLimitCents:0,resultScope:record.result_scope
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
