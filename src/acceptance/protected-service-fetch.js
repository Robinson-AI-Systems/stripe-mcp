// Optional Vercel Trusted Sources identity for owner-initiated tests of
// protected Production. Never alters SSO settings or exposes this token in
// logs/results. A token only works when the owner has independently authorized
// the exact development -> production Trusted Sources relationship.
import {approvedOrigin} from './rtc-service-check.js';
export function makeProtectedServiceFetch({
  origin,approvedOrigin:pin,oidcToken,fetcher=fetch
}={}){
  return async(url,init={})=>{
    const base=approvedOrigin(origin,pin);
    let destination;
    try{destination=new URL(String(url));}catch{throw new Error('Invalid protected endpoint');}
    if(destination.origin!==base||destination.username||destination.password||
      destination.protocol!=='https:'||destination.hash)
      throw new Error('Unapproved protected endpoint');
    const headers=new Headers(init.headers??{});
    if(oidcToken!==undefined&&oidcToken!==null&&oidcToken!==''){
      if(typeof oidcToken!=='string'||oidcToken.length<40||
        oidcToken.length>16384||!/^[-_.A-Za-z0-9]+$/.test(oidcToken))
        throw new Error('Invalid owner protected credential');
      headers.set('x-vercel-trusted-oidc-idp-token',oidcToken);
    }
    return fetcher(destination.toString(),{...init,headers,redirect:'manual'});
  };
}
