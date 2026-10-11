// G-5c1: native TEST own-account payment-method configuration visibility.
import {client,reply,fail,allProfiles} from './billing-shared.js';
const bad=message=>{throw new TypeError(message);};
const idOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const cfgOk=x=>typeof x==='string'&&/^pmc_[A-Za-z0-9]{2,100}$/.test(x);
const methodNames=['card','us_bank_account','apple_pay','link','cashapp','klarna'];
const prefOk=['on','off','none'];
const unreadable=(account)=>({account,available:false,configurations:null,hasMore:null,
  nextCursor:null,verification:'not_readable',
  note:'This TEST key cannot read payment-method configurations. Check Stripe Dashboard TEST > Settings > Payment methods; this does not prove ACH is off.'});
const unsupported=e=>[403,404].includes(e?.statusCode??e?.status)||
  ['permission_denied','resource_missing'].includes(e?.code);
export function safeConfiguration(v){
  if(v?.object!=='payment_method_configuration'||!cfgOk(v.id)||
    typeof v.active!=='boolean'||(v.parent!==undefined&&v.parent!==null&&
      typeof v.parent!=='string')||(v.application!==undefined&&
      v.application!==null&&typeof v.application!=='string'))
    bad('Provider configuration is incomplete or invalid');
  const methods={};
  for(const key of methodNames){
    const method=v[key];
    if(method===undefined||method===null){methods[key]=null;continue;}
    const pref=method.display_preference;
    if(typeof method.available!=='boolean'||!pref||!prefOk.includes(pref.value)||
      !prefOk.includes(pref.preference))
      bad('Provider payment method status unavailable');
    methods[key]={available:method.available,preference:pref.preference,
      effective:pref.value};
  }
  return {id:v.id,active:v.active,managedByConnect:Boolean(v.parent||v.application),methods};
}
function check(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(x=>!['limit','starting_after'].includes(x))||
    (a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>20))||
    (a.starting_after!==undefined&&!cfgOk(a.starting_after)))
    bad('Choose TEST configurations page 1–20 and a valid cursor');
}
export const tools=[{name:'account_list_payment_method_settings',area:'account',
  description:'Read safe TEST payment-method configuration states; denied access is unreadable, not disabled.',
  writes:false,profiles:allProfiles,annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:20},
    starting_after:{type:'string',pattern:'^pmc_[A-Za-z0-9]{2,100}$'}},
    additionalProperties:false}}];
export const handlers={
  async account_list_payment_method_settings(a,ctx){
    const account=ctx?.connection?.stripeAccount;
    if(ctx?.connection?.mode!=='test'||!idOk(account))
      return fail('Select a configured TEST account');
    try{
      check(a);
      const s=await client(ctx);
      const identity=await s.accounts.retrieve();
      if(identity?.object!=='account'||identity.id!==account||identity.livemode===true)
        bad('Exact own TEST account identity unavailable');
      let p;
      try{p=await s.paymentMethodConfigurations.list({limit:a.limit??10,
        ...(a.starting_after?{starting_after:a.starting_after}:{})});}
      catch(e){if(unsupported(e))return reply(unreadable(account));throw e;}
      if(p?.object!=='list'||!Array.isArray(p.data)||p.data.length>20||
        typeof p.has_more!=='boolean'||(p.has_more&&p.data.length===0))
        bad('Provider payment method settings page incomplete');
      const configurations=p.data.map(safeConfiguration);
      return reply({account,available:true,configurations,hasMore:p.has_more,
        nextCursor:p.has_more?configurations.at(-1).id:null,
        note:'Effective preference is observed configuration data, not proof that Checkout will offer a method for each payment.'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
