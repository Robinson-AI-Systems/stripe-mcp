import {selectedAccountClient} from './account-mode.js';
// G-5c2: selected-mode guarded payment-method preference changes; LIVE requires independent owner grant.
import {defineWrite,gone} from './write.js';
import {fullProfiles} from './billing-shared.js';
import {safeConfiguration} from './account-payment-settings.js';
const bad=s=>{throw new TypeError(s);};
const dashboardUrl='https://dashboard.stripe.com/test/settings/payment_methods';
const methods=['us_bank_account','card','apple_pay','link'];
const idOk=x=>typeof x==='string'&&/^pmc_[A-Za-z0-9]{2,100}$/.test(x);
const accountOk=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const shape={
  configuration:{type:'string',pattern:'^pmc_[A-Za-z0-9]{2,100}$'},
  method:{type:'string',enum:methods},
  preference:{type:'string',enum:['on','off']},
  outsideApp:{type:'boolean'}};
function input(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||!idOk(a.configuration)||
    !methods.includes(a.method)||!['on','off'].includes(a.preference)||
    Object.keys(a).some(x=>!Object.hasOwn({...shape,
      dryRun:true,confirm:true,requestKey:true},x))||
    (a.outsideApp!==undefined&&typeof a.outsideApp!=='boolean'))
    bad('Select exact TEST configuration, method and on/off preference');
}
async function own(ctx){
  const account=ctx?.connection?.stripeAccount;
  if(!accountOk(account))bad('A selected account is required');
  return selectedAccountClient(ctx);
}
async function current(a,ctx){
  input(a);
  const s=await own(ctx);
  const obj=await s.paymentMethodConfigurations.retrieve(a.configuration);
  const projected=safeConfiguration(obj,ctx.connection.mode);
  if(projected.managedByConnect||!projected.active||
    projected.methods[a.method]===null)
    bad('Only active own-account TEST direct configurations can be changed');
  return obj;
}
export function makeMethodPreferenceWrite(){
  const op=defineWrite({
    name:'account_update_payment_method_settings',
    read:current,
    summarize:(before,a,ctx)=>{
      input(a);
      return ctx.connection.mode.toUpperCase()+' MODE. Request '+a.method+' '+a.preference+' for exact direct configuration '+
        before.id+'. Verify independently; this does not guarantee Checkout availability.';
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await own(ctx);
      const before=await s.paymentMethodConfigurations.retrieve(a.configuration);
      if(safeConfiguration(before,ctx.connection.mode).managedByConnect||
        before.active!==true||before[a.method]==null)
        bad('Configuration became unsuitable for TEST update');
      await s.paymentMethodConfigurations.update(a.configuration,
        {[a.method]:{display_preference:{preference:a.preference}}},
        {idempotencyKey});
    },
    readAfter:current,
    verify:(before,after,a,ctx)=>{
      const b=safeConfiguration(before,ctx.connection.mode),
        v=safeConfiguration(after,ctx.connection.mode);
      return before.id===after.id&&!v.managedByConnect&&
        b.active&&v.active&&v.methods[a.method]?.preference===a.preference&&
        v.methods[a.method]?.effective===a.preference;
    }
  });
  return {...op,async handler(a,ctx){
    const output=await op.handler(a,ctx);
    if(output.isError&&output.content?.[0]?.text?.[0]!=='{')return output;
    let result;
    try{result=JSON.parse(output.content[0].text);}catch{return output;}
    if(result.done===true)return output;
    return {...output,content:[{type:'text',text:JSON.stringify({...result,
      manualSettingsUrl:ctx.connection.mode==='live'?dashboardUrl.replace('/test/','/'):
        dashboardUrl,
      manualSteps:['Open your selected Stripe environment > Settings > Payment methods.',
        'Choose this direct configuration and edit the selected payment method.',
        'Save and call account_list_payment_method_settings to verify the provider state.'],
      verified:false,verifyWith:'account_list_payment_method_settings',
      note:'A rejected or uncertain update is NOT evidence that the method is enabled.'})}]};
  }};
}
const op=makeMethodPreferenceWrite();
export const tools=[{...op.tool,area:'account',profiles:fullProfiles,
  description:'Guarded verified TEST/LIVE payment-method preference update with independent readback and honest Dashboard fallback.',
  inputSchema:{type:'object',properties:{...shape,
    dryRun:{type:'boolean'},confirm:{type:'boolean'},
    requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['configuration','method','preference'],additionalProperties:false}}];
export const handlers={account_update_payment_method_settings:(a,ctx)=>
  !['test','live'].includes(ctx?.connection?.mode)?gone('Selected Stripe account mode required'):
    makeMethodPreferenceWrite().handler(a,ctx)};
