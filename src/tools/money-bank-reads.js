// G-1b TEST-only own-account external-bank summary and payout schedule.
// Stripe's external-account API is Connect-scoped and may deny a platform's
// own account. Do not imply that a returned list is complete when inaccessible.
import {allProfiles,guarded,fail,paging,pageResult,ref} from './billing-shared.js';

const invalid=m=>{throw new TypeError(m);};
const acct=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const bank=x=>typeof x==='string'&&/^ba_[A-Za-z0-9]{2,100}$/.test(x);
const payoutsUrl='https://dashboard.stripe.com/settings/payouts';
function validate(a,fields){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!fields.includes(k)))
    invalid('Unsupported account payout read arguments');
}
async function authenticatedAccount(s,ctx){
  if(!acct(ctx?.connection?.stripeAccount))invalid('Selected Stripe account unavailable');
  const own=await s.accounts.retrieve();
  if(own?.object!=='account'||own.id!==ctx.connection.stripeAccount)
    invalid('Stripe authenticated account identity does not match selected account');
  return own;
}
function summary(v,accountId){
  if(v?.object!=='bank_account'||!bank(v.id)||
    (v.account!=null&&ref(v.account)!==accountId)||
    !/^[0-9]{4}$/.test(v.last4)||!/^[a-z]{3}$/.test(v.currency)||
    !/^[A-Z]{2}$/.test(v.country))
    invalid('Payout bank account summary is invalid or foreign');
  return {id:v.id,bankName:typeof v.bank_name==='string'?v.bank_name:null,
    last4:v.last4,currency:v.currency,country:v.country,
    status:typeof v.status==='string'?v.status:null,
    defaultForCurrency:v.default_for_currency===true};
}
export const tools=[
  {name:'money_list_bank_accounts',area:'money',writes:false,profiles:allProfiles,
    description:'List masked TEST payout bank destinations on the selected account, or report restricted API access.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{
      limit:{type:'integer',minimum:1,maximum:100},
      starting_after:{type:'string',pattern:'^ba_[A-Za-z0-9]{2,100}$'}
    },additionalProperties:false}},
  {name:'money_get_payout_schedule',area:'money',writes:false,profiles:allProfiles,
    description:'Read own TEST account payout interval and delay; never modify payouts.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
export const handlers={
  money_list_bank_accounts:(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return fail('TEST-only bank destination read');
    return guarded(ctx,async s=>{
      validate(a,['limit','starting_after']);
      const options={...paging(a),object:'bank_account'};
      if(a.starting_after&&!bank(a.starting_after))
        invalid('Exact external payout bank cursor required');
      const own=await authenticatedAccount(s,ctx);
      if(typeof s.accounts?.listExternalAccounts!=='function')
        return {available:false,reason:'not_supported_by_connected_provider',
          dashboardUrl:payoutsUrl,items:[],complete:false};
      let page;
      try{
        page=await s.accounts.listExternalAccounts(own.id,options);
      }catch(e){
        if([401,403].includes(e?.statusCode)||['permission_error','account_invalid']
          .includes(e?.code))
          return {available:false,reason:'provider_did_not_authorize_own_account_external_accounts',
            dashboardUrl:payoutsUrl,items:[],complete:false};
        throw e;
      }
      const result=pageResult(page,v=>summary(v,own.id));
      if(result.data.length>options.limit)
        invalid('Provider bank destination page exceeds requested limit');
      return {available:true,...result,complete:!result.has_more,
        masking:'bank last4 only; no routing/account numbers'};
    });
  },
  money_get_payout_schedule:(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return fail('TEST-only payout schedule read');
    return guarded(ctx,async s=>{
      validate(a,[]);
      const own=await authenticatedAccount(s,ctx);
      const value=own.settings?.payouts?.schedule;
      if(!value||!['daily','weekly','monthly','manual'].includes(value.interval))
        return {available:false,reason:'own_account_schedule_not_readable',
          dashboardUrl:payoutsUrl};
      const delay=value.delay_days;
      if(delay!==undefined&&delay!==null&&
        !(Number.isInteger(delay)&&delay>=0&&delay<=365)&&delay!=='minimum')
        invalid('Stripe account payout delay unavailable or invalid');
      const anchor=value.weekly_anchor;
      if(anchor!==undefined&&anchor!==null&&
        !['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
          .includes(anchor))
        invalid('Unsupported payout weekly anchor');
      if(value.monthly_anchor!=null&&
        (!Number.isInteger(value.monthly_anchor)||value.monthly_anchor<1||
          value.monthly_anchor>31))
        invalid('Unsupported payout monthly anchor');
      return {available:true,interval:value.interval,delayDays:delay??null,
        weeklyAnchor:anchor??null,monthlyAnchor:value.monthly_anchor??null,
        accountId:own.id,mode:'test',source:'own_account_readback'};
    });
  }
};
