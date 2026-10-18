// E-4: native Stripe Tax. Financial liability records are not payouts.
// All provider writes use the original audited, confirmed write lifecycle.
import {defineWrite,gone} from './write.js';
import {allProfiles,fullProfiles,paging,pageResult,reply,fail} from './billing-shared.js';
import {catalogClient,catalogMode} from './catalog-mode.js';
import {findAppOwnership} from './app-guard.js';

const text=(n=140)=>({type:'string',minLength:1,maxLength:n});
const ident=p=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'});
const bool={type:'boolean'}, money={type:'integer',minimum:0,maximum:1000000000};
const date={type:'integer',minimum:946684800,maximum:4102444800};
const page={limit:{type:'integer',minimum:1,maximum:100},starting_after:text(110)};
const controls={dryRun:bool,confirm:bool,requestKey:text(128)};
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const address={type:'object',properties:{country:text(2),state:text(80),postalCode:text(32),
  city:text(120),line1:text(180),line2:text(180)},required:['country'],additionalProperties:false};
const lineItems={type:'array',minItems:1,maxItems:20,items:object({
  amount:money,reference:text(140),taxCode:ident('txcd'),taxBehavior:{type:'string',enum:['exclusive','inclusive']},
  quantity:{type:'integer',minimum:1,maximum:100000}},['amount','reference'])};
const regs={type:'object',additionalProperties:true};
const attrs={
  tax_get_settings:{},
  tax_calculate:{currency:text(3),address,lineItems}, 
  tax_list_registrations:{...page,status:{type:'string',enum:['active','expired','scheduled','all']}},
  tax_list_transactions:{...page},
  tax_get_transaction:{transactionId:ident('tax')},
  tax_list_codes:{...page},
  tax_get_code:{codeId:ident('txcd')},
  tax_update_settings:{taxBehavior:{type:'string',enum:['inclusive','exclusive','inferred_by_currency']},
    taxCode:ident('txcd'),headOffice:address},
  tax_add_registration:{country:text(2),countryOptions:regs,activeFrom:{anyOf:[date,{type:'string',enum:['now']}]},expiresAt:date},
  tax_end_registration:{registrationId:ident('taxreg')},
  tax_record_transaction:{calculationId:ident('taxcalc'),reference:text(160)},
  tax_reverse_transaction:{transactionId:ident('tax'),reference:text(160),
    reversalMode:{type:'string',enum:['full','partial']},
    flatAmount:{type:'integer',maximum:-1,minimum:-1000000000}}
};
const required={tax_calculate:['currency','address','lineItems'],
  tax_get_transaction:['transactionId'],tax_get_code:['codeId'],
  tax_add_registration:['country','countryOptions','activeFrom'],
  tax_end_registration:['registrationId'],
  tax_record_transaction:['calculationId','reference'],
  tax_reverse_transaction:['transactionId','reference']};
const writeNames=new Set(['tax_update_settings','tax_add_registration','tax_end_registration',
  'tax_record_transaction','tax_reverse_transaction']);
const schema=(name,write)=>object({...attrs[name],...(write?controls:{})},required[name]||[]);
export const tools=Object.keys(attrs).map(name=>{
  const write=writeNames.has(name);
  const core=write?defineWrite({name,read:async()=>({}),summarize:()=>name,
    apply:async()=>{},readAfter:async()=>({}),verify:()=>false}).tool:null;
  return {...(core??{}),name,area:'catalog',profiles:write?fullProfiles:allProfiles,
    writes:write,detailFieldsSupported:false,
    annotations:write?{destructiveHint:/end_registration|reverse_transaction/.test(name)}:
      {readOnlyHint:true},
    description:({
      tax_list_transactions:'List only Tax transactions independently indexed by this connector; Stripe offers no general tax transaction list API.',
      tax_add_registration:'Record an existing legal tax registration in Stripe; does not register with authorities.',
      tax_reverse_transaction:'Guarded full/partial Tax transaction reversal; does not refund payment.',
      tax_calculate:'Compute provider tax on explicit basket, currency and customer address without recording a sale.'
    }[name]??name.replaceAll('_',' ')),
    inputSchema:schema(name,write)};
});
const err=m=>{throw new TypeError(m);};
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const mode=ctx=>ctx.connection.mode==='live';
const id=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
function argsOk(a,name){
  if(!isObj(a)||Object.keys(a).some(k=>!Object.hasOwn({...attrs[name],...controls},k))||
    (required[name]??[]).some(k=>a[k]===undefined))err('Unsupported or missing Stripe Tax fields');
  for(const [k,v] of Object.entries(a)){
    if(['transactionId','registrationId','calculationId','codeId','taxCode'].includes(k)&&
      !id(v,{transactionId:'tax',registrationId:'taxreg',calculationId:'taxcalc',
        codeId:'txcd',taxCode:'txcd'}[k]))err('Invalid Tax resource ID');
    if(['country','currency'].includes(k)&&
      (typeof v!=='string'||!/^[a-zA-Z]{2,3}$/.test(v)||
        v.length!==(k==='country'?2:3)))err('Invalid ISO country/currency');
    if(['reference','requestKey'].includes(k)&&
      (typeof v!=='string'||v.length<1||v.length>160||!/^[A-Za-z0-9_.:-]+$/.test(v)))
      err('Stable printable reference/requestKey required');
    if(['confirm','dryRun'].includes(k)&&typeof v!=='boolean')err('Invalid confirmation');
    if(k==='reversalMode'&&!['full','partial'].includes(v))err('Invalid reversal mode');
    if(k==='taxBehavior'&&!['inclusive','exclusive','inferred_by_currency'].includes(v))
      err('Invalid tax behavior');
    if(['limit','expiresAt'].includes(k)&&(!Number.isSafeInteger(v)||v<1))err('Invalid integer');
    if(k==='flatAmount'&&(!Number.isSafeInteger(v)||v>=0||v< -1000000000))
      err('Partial reversal requires bounded negative amount');
  }
  if(a.address!==undefined)validateAddress(a.address);
  if(a.headOffice!==undefined)validateAddress(a.headOffice);
  if(a.lineItems!==undefined){
    if(!Array.isArray(a.lineItems)||!a.lineItems.length||a.lineItems.length>20)
      err('Use 1-20 tax line items');
    for(const line of a.lineItems){
      if(!isObj(line)||Object.keys(line).some(k=>
        !['amount','reference','taxCode','taxBehavior','quantity'].includes(k))||
        !Number.isSafeInteger(line.amount)||line.amount<0||line.amount>1000000000||
        typeof line.reference!=='string'||!line.reference||
        line.reference.length>140||
        (line.taxCode!==undefined&&!id(line.taxCode,'txcd'))||
        (line.quantity!==undefined&&(!Number.isSafeInteger(line.quantity)||
          line.quantity<1||line.quantity>100000)))err('Invalid Stripe Tax line item');
    }
  }
  if(a.countryOptions!==undefined){
    const serialized=JSON.stringify(a.countryOptions);
    if(!isObj(a.countryOptions)||!serialized||serialized.length>1400||
      !/^[A-Za-z0-9_{}":,.\-\s]+$/.test(serialized)||
      Object.hasOwn(a.countryOptions,'__proto__'))
      err('Invalid country-specific registration details');
  }
  if(name==='tax_calculate'&&a.currency!==a.currency.toLowerCase())
    err('Lowercase ISO currency required');
  if(name==='tax_reverse_transaction'&&
    ((a.reversalMode??'full')==='partial')!==(a.flatAmount!==undefined))
    err('Partial reversal needs explicit negative flatAmount');
  if(a.activeFrom!==undefined&&a.activeFrom!=='now'&&
    (!Number.isSafeInteger(a.activeFrom)||a.activeFrom<946684800))
    err('Invalid registration activation time');
}
function validateAddress(a){
  if(!isObj(a)||! /^[A-Za-z]{2}$/.test(a.country??'')||
    Object.entries(a).some(([k,v])=>
      !['country','state','postalCode','city','line1','line2'].includes(k)||
      typeof v!=='string'||!v.trim()||v.length>180||
      /[\x00-\x1f]/.test(v)))err('Explicit bounded customer/address fields required');
}
const addr=a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[
  {postalCode:'postal_code'}[k]??k,v]));
const line=x=>({amount:x.amount,reference:x.reference,
  ...(x.taxCode?{tax_code:x.taxCode}:{}),
  ...(x.taxBehavior?{tax_behavior:x.taxBehavior}:{}),
  ...(x.quantity?{quantity:x.quantity}:{})});
function safe(v,kind,ctx){
  if(!isObj(v)||v.object!==kind||(typeof v.livemode!=='boolean'&&kind!=='tax_code')||
    (typeof v.livemode==='boolean'&&v.livemode!==mode(ctx)))
    err('Stripe Tax did not prove selected account/mode or object type');
  return {id:v.id??null,object:v.object,livemode:v.livemode??null,
    status:v.status??null,amountTotal:v.amount_total??null,amountTax:v.tax_amount_exclusive??null,
    currency:v.currency??null,reference:v.reference??null,country:v.country??null,
    countryOptions:v.country_options??null,activeFrom:v.active_from??null,
    expiresAt:v.expires_at??null,name:v.name??null,description:v.description??null,
    defaults:v.defaults??null,headOffice:v.head_office??null,reversal:v.reversal??null};
}
async function scope(ctx,resource=null){
  if(!ctx.db?.listKnownAppsForAccount||!ctx.db?.getAppGuardScope)
    err('Application ownership registry unavailable');
  const account=ctx.connection.stripeAccount;
  const [apps,boundary]=await Promise.all([
    ctx.db.listKnownAppsForAccount(account),ctx.db.getAppGuardScope(account)]);
  if(!Array.isArray(apps)||!['legacy','scoped'].includes(boundary))
    err('Application ownership status unavailable');
  if(resource&&await findAppOwnership(resource,ctx))
    err('App-owned or uncertain source cannot be changed');
  if(apps.some(app=>app.profile?.owns_tax_rates===true)&&
    !resource)err('An application owns tax configuration for this account; use the application');
}
const reads={
  tax_get_settings:async(a,s,ctx)=>safe(await s.tax.settings.retrieve(),'tax.settings',ctx),
  tax_calculate:async(a,s,ctx)=>{
    const v=await s.tax.calculations.create({currency:a.currency,
      customer_details:{address:addr(a.address),address_source:'billing'},
      line_items:a.lineItems.map(line)});
    return safe(v,'tax.calculation',ctx);
  },
  tax_list_registrations:async(a,s,ctx)=>pageResult(await s.tax.registrations.list({
    ...paging(a),...(a.status?{status:a.status}:{})}),
    v=>safe(v,'tax.registration',ctx)),
  tax_list_transactions:async(a,s,ctx)=>{
    if(typeof ctx.db?.listTaxTransactionIndex!=='function')
      err('Local indexed Tax transaction ledger unavailable; Stripe does not offer a general transaction list');
    const rows=await ctx.db.listTaxTransactionIndex({account:ctx.connection.stripeAccount,
      mode:ctx.connection.mode,limit:a.limit??20,startingAfter:a.starting_after??null});
    if(!Array.isArray(rows))err('Tax transaction index unavailable');
    const verified=[];
    for(const row of rows.slice(0,a.limit??20)){
      const v=await s.tax.transactions.retrieve(row.transaction_id);
      verified.push(safe(v,'tax.transaction',ctx));
    }
    return {data:verified,has_more:rows.length>(a.limit??20),next:rows.length>(a.limit??20)?rows[(a.limit??20)-1].transaction_id:null,scope:'only_verified_connector_recorded',
      note:'Stripe has no Tax transactions list endpoint. Other transactions require tax_get_transaction with an exact ID.'};
  },
  tax_get_transaction:async(a,s,ctx)=>safe(
    await s.tax.transactions.retrieve(a.transactionId),'tax.transaction',ctx),
  tax_list_codes:async(a,s,ctx)=>pageResult(await s.taxCodes.list(paging(a)),
    v=>safe(v,'tax_code',ctx)),
  tax_get_code:async(a,s,ctx)=>safe(await s.taxCodes.retrieve(a.codeId),'tax_code',ctx)
};
export const handlers=Object.fromEntries(Object.keys(reads).map(name=>[name,
  async(a={},ctx)=>{
    try{if(!catalogMode(ctx))return gone('Selected Stripe mode required');
      argsOk(a,name);return reply(await reads[name](a,await catalogClient(ctx),ctx));
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }]));
function makeWrite(name){
  let createdId=null,current=null;
  const op=defineWrite({
    name,resultId:(_before,after)=>after?.id??null,
    read:async(a,ctx)=>{
      createdId=null;current=null;argsOk(a,name);
      await scope(ctx);
      const s=await catalogClient(ctx);
      if(name==='tax_update_settings')return s.tax.settings.retrieve();
      if(name==='tax_end_registration'){
        current=await s.tax.registrations.retrieve(a.registrationId);
        safe(current,'tax.registration',ctx);
        if(current.status==='expired')err('Already expired; cannot end again');
        return current;
      }
      if(name==='tax_record_transaction'){
        const calc=await s.tax.calculations.retrieve(a.calculationId);
        safe(calc,'tax.calculation',ctx);
        return calc;
      }
      if(name==='tax_reverse_transaction'){
        current=await s.tax.transactions.retrieve(a.transactionId);
        safe(current,'tax.transaction',ctx);
        if(current.type==='reversal')err('A reversal is not a reversible sale');
        return current;
      }
      return {object:'tax.registration',id:null,livemode:mode(ctx)};
    },
    summarize:(before,a,ctx)=>ctx.connection.mode.toUpperCase()+' MODE: '+name+
      '. Tax configuration and entries change recorded collection or tax liability.'+
      ' Stripe registration does not register or deregister with tax authorities.'+
      ' A reversal is a tax ledger operation, NOT a customer refund.'+
      ' Confirm legal/account authority and exact terms; provider readback required.',
    targetGuard:async()=>true,
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await catalogClient(ctx),opts={idempotencyKey};
      let v;
      if(name==='tax_update_settings')v=await s.tax.settings.update({
        ...(a.taxBehavior||a.taxCode?{defaults:{
          ...(a.taxBehavior?{tax_behavior:a.taxBehavior}:{}),
          ...(a.taxCode?{tax_code:a.taxCode}:{})}}:{}),
        ...(a.headOffice?{head_office:{address:addr(a.headOffice)}}:{})},opts);
      if(name==='tax_add_registration')v=await s.tax.registrations.create({
        country:a.country.toUpperCase(),country_options:a.countryOptions,
        active_from:a.activeFrom,...(a.expiresAt?{expires_at:a.expiresAt}:{})},opts);
      if(name==='tax_end_registration')v=await s.tax.registrations.update(
        a.registrationId,{expires_at:'now'},opts);
      if(name==='tax_record_transaction')v=await s.tax.transactions.createFromCalculation({
        calculation:a.calculationId,reference:a.reference},opts);
      if(name==='tax_reverse_transaction')v=await s.tax.transactions.createReversal({
        mode:a.reversalMode??'full',original_transaction:a.transactionId,reference:a.reference,
        ...(a.flatAmount?{flat_amount:a.flatAmount}:{})},opts);
      createdId=v?.id??null;
    },
    readAfter:async(a,ctx)=>{
      const s=await catalogClient(ctx);
      if(name==='tax_update_settings')return s.tax.settings.retrieve();
      if(name==='tax_end_registration')return s.tax.registrations.retrieve(a.registrationId);
      if(name==='tax_add_registration')return s.tax.registrations.retrieve(createdId);
      return s.tax.transactions.retrieve(createdId);
    },
    verify:async(before,after,a,ctx)=>{
      const kind=name==='tax_update_settings'?'tax.settings':
        name.includes('registration')?'tax.registration':'tax.transaction';
      safe(after,kind,ctx);
      if(name==='tax_update_settings')return ((a.taxBehavior===undefined||after.defaults?.tax_behavior===a.taxBehavior)&&
        (a.taxCode===undefined||after.defaults?.tax_code===a.taxCode)&&
        (a.headOffice===undefined||Object.entries(addr(a.headOffice)).every(
          ([k,v])=>after.head_office?.address?.[k]===v)));
      if(name==='tax_add_registration')return after.id===createdId&&
        after.country===a.country.toUpperCase();
      if(name==='tax_end_registration')return after.id===a.registrationId&&
        Number.isSafeInteger(after.expires_at)&&after.expires_at<=Math.floor(Date.now()/1000)+60;
      if(name==='tax_record_transaction')return after.id===createdId&&
        after.reference===a.reference&&after.type!=='reversal';
      return after.id===createdId&&after.reference===a.reference&&
        after.type==='reversal'&&
        after.reversal?.original_transaction===a.transactionId;
    },
    afterApply:async({ctx,args,status})=>{
      if(status==='confirmed'&&['tax_record_transaction','tax_reverse_transaction'].includes(name)){
        if(typeof ctx.db?.recordTaxTransactionIndex!=='function'||
          await ctx.db.recordTaxTransactionIndex({account:ctx.connection.stripeAccount,
            mode:ctx.connection.mode,transactionId:createdId,reference:args.reference})!==true)
          err('Verified Tax transaction cannot be indexed; manual reconciliation required');
      }
    },
    // Stripe tax posted transactions are not money-out; reserve no payout.
  });
  return async(a,ctx)=>{
    if(!catalogMode(ctx))return gone('Selected TEST/LIVE mode required');
    try {return await op.handler(a,ctx);}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  };
}
for(const name of writeNames)handlers[name]=makeWrite(name);
