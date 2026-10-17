// Distinguish product capability from a developer's TEST/no-spend authority.
// Whitelisted nonmoney provider objects support real guarded POST/DELETE;
// unclassified money transfers need provider-derived approval, not AI flags.
import {catalog} from './openapi-index.js';
const nonmoney=[
  /^\/v1\/tax_rates(?:\/\{[^}]+\})?$/,
  /^\/v1\/terminal\/locations(?:\/\{[^}]+\})?$/,
  /^\/v1\/shipping_rates(?:\/\{[^}]+\})?$/
];
const transfer=/(?:^|\/)(?:refunds|payouts|transfers|topups|treasury|issuing|credit_notes|credit_grants|payment_intents|charges|outbound_payments)(?:\/|$)/;
export function companionGet(op){
  const prefix=op.path+'/';
  const options=[...catalog().operations.values()].filter(x=>
    x.method==='GET'&&x.path.startsWith(prefix)&&
    /^\{[A-Za-z0-9_]+\}$/.test(x.path.slice(prefix.length)));
  return options.length===1?options[0].path:null;
}
export function classifyUniversalWrite(op,body,{metadataOnly=false,moneyLike=false}={}){
  if(op.method==='POST'&&metadataOnly&&
    /\/\{[^}]+\}$/.test(op.path)&&op.root.paths[op.path].get)
    return {allowed:true,kind:'update',notice:'A verified metadata-only update'};
  if(transfer.test(op.path)||moneyLike&&!nonmoney.some(x=>x.test(op.path)))
    return {allowed:false,reason:'Financial or unclassified money-moving operation requires an original provider-derived amount and separate owner approval; this is an unimplemented capability, not permanent user policy'};
  if(!nonmoney.some(x=>x.test(op.path)))
    return {allowed:false,reason:'Operation needs provider-specific ownership/cost classification and original readback; currently a tracked capability gap, not a permanent end-user restriction'};
  if(op.method==='POST'&&/\/\{[^}]+\}$/.test(op.path)&&
    op.root.paths[op.path].get)
    return {allowed:true,kind:'update',notice:'Updates a Stripe setting and may affect later financial behavior'};
  if(op.method==='POST'&&companionGet(op))
    return {allowed:true,kind:'create',notice:'Creates a provider resource; future metered costs may be unknown'};
  if(op.method==='DELETE'&&op.root.paths[op.path].get)
    return {allowed:true,kind:'delete',notice:'Permanently deletes a resource; this may be irreversible'};
  return {allowed:false,reason:'Operation lacks a verifiable matching GET route'};
}
