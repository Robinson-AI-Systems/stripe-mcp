// Distinguish product capability from a developer's TEST/no-spend authority.
// Whitelisted nonmoney provider objects support real guarded POST/DELETE;
// unclassified money transfers need provider-derived approval, not AI flags.
// CAP-4 D-9: every non-money pinned POST/DELETE operation is classified
// in universal-classification.js; the table governs its rows, the money
// branch below is untouched and fires first for its 92 operations, and
// the legacy tail below the table lookup serves only operations the
// pinned catalog does not carry.
import {catalog} from './openapi-index.js';
import {classificationFor} from './universal-classification.js';
const nonmoney=[
  /^\/v1\/tax_rates(?:\/\{[^}]+\})?$/,
  /^\/v1\/terminal\/locations(?:\/\{[^}]+\})?$/,
  /^\/v1\/shipping_rates(?:\/\{[^}]+\})?$/,
  /^\/v1\/coupons(?:\/\{[^}]+\})?$/
];
const transfer=/(?:^|\/)(?:refunds|payouts|transfers|topups|treasury|issuing|credit_notes|credit_grants|payment_intents|charges|outbound_payments)(?:\/|$)/;
const FINANCIAL_REASON='Financial or unclassified money-moving operation requires an original provider-derived amount and separate owner approval; this is an unimplemented capability, not permanent user policy';
const GENERIC_REASON='Operation needs provider-specific ownership/cost classification and original readback; currently a tracked capability gap, not a permanent end-user restriction';
const KIND_NOTICES={
  create:'Creates a provider resource; future metered costs may be unknown',
  update:'Updates a Stripe setting and may affect later financial behavior',
  delete:'Permanently deletes a resource; this may be irreversible',
  action:'Changes the state of an existing Stripe resource; the outcome is verified by reading the resource back',
  settings:'Updates account-level Stripe settings; the outcome is verified by reading the settings back'
};
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
  if(transfer.test(op.path))
    return {allowed:false,reason:FINANCIAL_REASON};
  // The D-9 classification table governs every pinned non-money row:
  // generic-allow rows pass under the existing guarded-write contract;
  // every other row refuses with its class reason. The classification
  // IS the review the moneyLike heuristic was standing in for, so a
  // classified row is not vetoed by that heuristic.
  const row=classificationFor(op);
  if(row){
    if(row.disposition==='allow')
      return {allowed:true,kind:row.kind,notice:KIND_NOTICES[row.kind],
        classification:row};
    return {allowed:false,reason:row.reason,classification:row};
  }
  if(moneyLike&&!nonmoney.some(x=>x.test(op.path)))
    return {allowed:false,reason:FINANCIAL_REASON};
  if(!nonmoney.some(x=>x.test(op.path)))
    return {allowed:false,reason:GENERIC_REASON};
  if(op.method==='POST'&&/\/\{[^}]+\}$/.test(op.path)&&
    op.root.paths[op.path].get)
    return {allowed:true,kind:'update',notice:KIND_NOTICES.update};
  if(op.method==='POST'&&companionGet(op))
    return {allowed:true,kind:'create',notice:KIND_NOTICES.create};
  if(op.method==='DELETE'&&op.root.paths[op.path].get)
    return {allowed:true,kind:'delete',notice:KIND_NOTICES.delete};
  return {allowed:false,reason:'Operation lacks a verifiable matching GET route'};
}
