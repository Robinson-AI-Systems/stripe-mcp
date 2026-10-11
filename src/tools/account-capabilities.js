// G-5b: own-account TEST capability statuses; Connect-only refusal is unreadable, never "disabled".
import {client,reply,fail,allProfiles} from './billing-shared.js';
const bad=m=>{throw new TypeError(m);};
const accountOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const capabilityOk=x=>typeof x==='string'&&/^[a-z][a-z0-9_]{1,80}$/.test(x);
const allowed=['id','status','requested','dueCount','pendingCount'];
const status=['active','inactive','pending','unrequested'];
function checkArgs(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['limit','offset','fields','detail'].includes(k)))
    bad('Only a bounded TEST capability status page is permitted');
  if(a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>20))
    bad('Select 1 to 20 capability statuses');
  if(a.offset!==undefined&&(!Number.isInteger(a.offset)||a.offset<0||a.offset>500))
    bad('Select a bounded status page offset');
  if(a.detail!==undefined&&!['summary','full'].includes(a.detail))
    bad('Only summary/full capability status is supported');
  if(a.fields!==undefined&&(!Array.isArray(a.fields)||a.fields.length>allowed.length||
    new Set(a.fields).size!==a.fields.length||
    a.fields.some(k=>!allowed.includes(k))))
    bad('Only named safe capability fields are allowed');
}
function countRequirements(v,key){
  const rows=v?.requirements?.[key];
  if(rows===undefined||rows===null)return null;
  if(!Array.isArray(rows)||rows.length>1000)
    bad('Provider capability requirements unreadable');
  return rows.length;
}
export function capabilitySafe(v,account,{detail='summary',fields}={}){
  if(!v||v.object!=='capability'||!capabilityOk(v.id)||
    !status.includes(v.status)||(v.account!=null&&v.account!==account)||
    (v.requested!==undefined&&typeof v.requested!=='boolean'))
    bad('Exact own-account capability status unavailable');
  const summary={id:v.id,status:v.status};
  const full={...summary,requested:v.requested??null,
    dueCount:countRequirements(v,'currently_due'),
    pendingCount:countRequirements(v,'pending_verification')};
  const projected=detail==='full'?full:summary;
  return fields===undefined?projected:Object.fromEntries(Object.entries(projected)
    .filter(([k])=>k==='id'||fields.includes(k)));
}
const unreadable=account=>({account,available:false,verification:'not_readable',
  capabilities:null,hasMore:null,nextOffset:null,
  note:'Stripe did not permit native capability listing on this TEST key. This is NOT proof of disabled payment methods. Check capabilities and payment methods in the account Dashboard.'});
const unsupported=e=>[403,404].includes(e?.statusCode??e?.status)||
  ['permission_denied','resource_missing'].includes(e?.code);
export const tools=[{
  name:'account_list_capabilities',area:'account',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  description:'Read TEST account capabilities and statuses; unpermitted own-account reads are marked unreadable, not disabled.',
  inputSchema:{type:'object',properties:{
    limit:{type:'integer',minimum:1,maximum:20},
    offset:{type:'integer',minimum:0,maximum:500},
    detail:{type:'string',enum:['summary','full']},
    fields:{type:'array',maxItems:5,uniqueItems:true,
      items:{type:'string',enum:allowed}}
  },additionalProperties:false}
}];
export const handlers={
  async account_list_capabilities(a,ctx){
    const account=ctx?.connection?.stripeAccount;
    if(ctx?.connection?.mode!=='test'||!accountOk(account))
      return fail('Select a configured TEST account');
    try{
      checkArgs(a);
      const s=await client(ctx);
      const identity=await s.accounts.retrieve();
      if(identity?.object!=='account'||identity.id!==account||
        identity.livemode===true)
        bad('Own-account TEST identity could not be verified');
      let page;
      try{page=await s.accounts.listCapabilities(account);}
      catch(e){if(unsupported(e))return reply(unreadable(account));throw e;}
      if(page?.object!=='list'||!Array.isArray(page.data)||
        typeof page.has_more!=='boolean'||page.data.length>500||
        page.has_more===true)
        bad('Provider capability enumeration was incomplete or unavailable');
      // Validate all entries before projecting a page. Invalid rows must not be skipped.
      const all=page.data.map(x=>capabilitySafe(x,account,{detail:a.detail,fields:a.fields}));
      const offset=a.offset??0,limit=a.limit??10,selected=all.slice(offset,offset+limit);
      const more=all.length>offset+limit;
      return reply({account,available:true,capabilities:selected,
        hasMore:more,nextOffset:more?offset+limit:null,
        totalObserved:all.length,
        note:'Capability status is not proof that Checkout, ACH or other payment methods are configured or enabled.'});
    }catch(e){
      if(e instanceof TypeError)return fail(e.message);
      throw e;
    }
  }
};
