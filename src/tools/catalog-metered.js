// E-3: native metered billing. Financial credits and asynchronous usage receipts
// retain independent safeguards; no deprecated usage-record API is used.
import {defineWrite,gone} from './write.js';
import {allProfiles,writeProfiles,fullProfiles,paging,pageResult,reply,fail,checkId} from './billing-shared.js';
import {catalogClient,catalogMode} from './catalog-mode.js';
import {findAppOwnership} from './app-guard.js';

const error=msg=>{throw new TypeError(msg);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const str=(n=100)=>({type:'string',maxLength:n});
const key=str(60),meterId=str(110),alertId=str(110),grantId=str(110);
const customerId=str(110),bool={type:'boolean'};
const positive={type:'integer',minimum:1,maximum:100000000};
const time={type:'integer',minimum:946684800,maximum:4102444800};
const pg={limit:{type:'integer',minimum:1,maximum:100},starting_after:str(110)};
const flags={dryRun:bool,confirm:bool,requestKey:str(128)};
const schema=(properties,required=[])=>({type:'object',properties,
  ...(required.length?{required}:{}),additionalProperties:false});
const ids={meterId:'mtr',alertId:'alrt',grantId:'credgr',customerId:'cus'};
const textFields=new Set(['displayName','eventName','title','name']);
const fields={
  meter_list:{props:{...pg,status:{type:'string',enum:['active','inactive']}}},
  meter_get:{props:{meterId},required:['meterId']},
  meter_list_usage_summaries:{props:{meterId,customerId,startTime:time,endTime:time,
    ...pg,grouping:{type:'string',enum:['hour','day']}},required:['meterId','customerId','startTime','endTime']},
  alert_list:{props:{...pg}},
  credit_list_grants:{props:{...pg,customerId}}
};
const writes={
  meter_create:{props:{displayName:str(100),eventName:key,
    formula:{type:'string',enum:['sum','count','last']},
    customerKey:key,valueKey:key},required:['displayName','eventName','formula']},
  meter_update:{props:{meterId,displayName:str(100)},required:['meterId','displayName']},
  meter_deactivate:{props:{meterId},required:['meterId']},
  meter_reactivate:{props:{meterId},required:['meterId']},
  meter_record_usage:{props:{meterId,customerId,units:positive,identifier:str(100),timestamp:time},
    required:['meterId','customerId','units','identifier']},
  alert_create:{props:{meterId,title:str(100),threshold:positive,customerId},
    required:['meterId','title','threshold']},
  alert_activate:{props:{alertId},required:['alertId']},
  alert_deactivate:{props:{alertId},required:['alertId']},
  alert_archive:{props:{alertId},required:['alertId']},
  credit_create_grant:{props:{customerId,amountCents:positive,currency:{type:'string',enum:['usd']},
    category:{type:'string',enum:['promotional','paid']},name:str(100),expiresAt:time},
    required:['customerId','amountCents','currency','category']},
  credit_void_grant:{props:{grantId},required:['grantId']}
};
const readDefs=Object.entries(fields);
const writeDefs=Object.entries(writes);
export const tools=[
  ...readDefs.map(([name,d])=>({name,area:'catalog',profiles:allProfiles,writes:false,
    annotations:{readOnlyHint:true},detailFieldsSupported:false,
    description:name.replaceAll('_',' ').slice(0,90),
    inputSchema:schema(d.props,d.required)}))
];
function check(a,def,write=false){
  if(!object(a)||Object.keys(a).some(k=>!(k in def.props)&&!(write&&k in flags))||
    (def.required??[]).some(k=>a[k]===undefined))
    error('Missing or unsupported metering parameters');
  for(const [k,v] of Object.entries(a)){
    if(ids[k])checkId(v,ids[k]);
    else if(k==='starting_after'||k==='limit'){
      // paging() checks both bounds and cursor syntax.
      paging({[k]:v});
    }else if(textFields.has(k)){
      if(typeof v!=='string'||!v.trim()||v.length>100||/[\x00-\x1f]/.test(v))
        error('Invalid '+k);
      if(k==='eventName'&&!/^[a-zA-Z][a-zA-Z0-9_.-]{2,59}$/.test(v))
        error('Invalid meter event name');
    }else if(['customerKey','valueKey'].includes(k)){
      if(typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(v))
        error('Invalid event payload key');
    }else if(k==='identifier'){
      if(typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$/.test(v))
        error('Supply a stable unique event identifier');
    }else if(['threshold','units','amountCents'].includes(k)){
      if(!Number.isSafeInteger(v)||v<=0||v>100000000)error('Invalid '+k);
    }else if(['timestamp','startTime','endTime','expiresAt'].includes(k)){
      if(!Number.isSafeInteger(v)||v<946684800||v>4102444800)
        error('Invalid '+k);
    }else if(['confirm','dryRun'].includes(k)&&typeof v!=='boolean'){
      error('Invalid confirmation flag');
    }else if(k==='requestKey'&&
      (typeof v!=='string'||v.length<1||v.length>128))error('Stable request key required');
    else if(['status','formula','grouping','category','currency'].includes(k)&&
      !({status:['active','inactive'],formula:['sum','count','last'],
        grouping:['hour','day'],category:['promotional','paid'],currency:['usd']})[k].includes(v))
      error('Unsupported '+k);
  }
  if(a.customerKey&&a.valueKey&&a.customerKey===a.valueKey)
    error('Customer and value mapping keys must differ');
  if(a.startTime!==undefined&&a.endTime!==undefined&&
    (a.startTime>=a.endTime||a.startTime%60!==0||a.endTime%60!==0||
      a.endTime-a.startTime>366*86400))
    error('Meter period must be complete and aligned to the minute');
}
const mode=ctx=>ctx.connection.mode==='live';
const scope=async ctx=>{
  if(typeof ctx.db?.listKnownAppsForAccount!=='function'||
    typeof ctx.db?.getAppGuardScope!=='function')
    error('Application ownership scope unavailable');
  const account=ctx.connection.stripeAccount;
  const [apps,guard]=await Promise.all([
    ctx.db.listKnownAppsForAccount(account),ctx.db.getAppGuardScope(account)]);
  if(!Array.isArray(apps)||!['legacy','scoped'].includes(guard))
    error('Account ownership scope unavailable');
  return apps;
};
const noApp=async(record,ctx)=>{
  const mark=await findAppOwnership(record,ctx);
  if(mark)error('Application-owned or uncertain billing record cannot be mutated');
};
async function customer(s,id,ctx){
  const v=await s.customers.retrieve(id);
  if(v?.object!=='customer'||v.id!==id||v.deleted===true||
    v.livemode!==mode(ctx)||!object(v.metadata))
    error('Selected-mode customer and app ownership were not verified');
  return v;
}
function meter(v,ctx){
  if(v?.object!=='billing.meter'||v.livemode!==mode(ctx)||
    !/^mtr_[A-Za-z0-9]{2,100}$/.test(v.id??'')||
    !['active','inactive'].includes(v.status)||
    !['sum','count','last'].includes(v.default_aggregation?.formula)||
    v.customer_mapping?.type!=='by_id'||
    !/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(v.customer_mapping?.event_payload_key??'')||
    !/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(v.value_settings?.event_payload_key??''))
    error('Stripe meter identity, mode or mapping unavailable');
  return {id:v.id,displayName:v.display_name,eventName:v.event_name,
    formula:v.default_aggregation.formula,status:v.status,
    customerKey:v.customer_mapping.event_payload_key,
    valueKey:v.value_settings.event_payload_key};
}
function alert(v,ctx){
  if(v?.object!=='billing.alert'||v.livemode!==mode(ctx)||
    !/^alrt_[A-Za-z0-9]{2,100}$/.test(v.id??'')||
    !['active','inactive','archived'].includes(v.status)||
    v.alert_type!=='usage_threshold'||
    !Number.isSafeInteger(v.usage_threshold?.gte)||
    v.usage_threshold.gte<1)
    error('Selected-mode billing alert not verified');
  const linked=v.usage_threshold.meter;
  const mid=typeof linked==='string'?linked:linked?.id;
  checkId(mid,'mtr');
  return {id:v.id,title:v.title,status:v.status,meterId:mid,
    threshold:v.usage_threshold.gte,recurrence:v.usage_threshold.recurrence,
    customerId:typeof v.usage_threshold.filters?.[0]?.customer==='string'?
      v.usage_threshold.filters[0].customer:
      v.usage_threshold.filters?.[0]?.customer?.id??null};
}
function credit(v,ctx){
  if(v?.object!=='billing.credit_grant'||v.livemode!==mode(ctx)||
    !/^credgr_[A-Za-z0-9]{2,100}$/.test(v.id??'')||
    v.amount?.type!=='monetary'||
    !Number.isSafeInteger(v.amount.monetary?.value)||
    v.amount.monetary.value<1||
    !/^[a-z]{3}$/.test(v.amount.monetary.currency??''))
    error('Provider billing credit amount, account mode or ID unavailable');
  const cus=typeof v.customer==='string'?v.customer:v.customer?.id;
  checkId(cus,'cus');
  return {id:v.id,customerId:cus,currency:v.amount.monetary.currency,
    amountCents:v.amount.monetary.value,category:v.category,
    name:v.name??null,voidedAt:v.voided_at??null,
    scope:v.applicability_config?.scope?.price_type??null};
}
const bill=s=>s.billing;
const readers={
  meter_list:async(a,s,ctx)=>pageResult(await bill(s).meters.list({
    ...paging(a),...(a.status?{status:a.status}:{})}),v=>meter(v,ctx)),
  meter_get:async(a,s,ctx)=>meter(await bill(s).meters.retrieve(a.meterId),ctx),
  meter_list_usage_summaries:async(a,s,ctx)=>{
    const m=meter(await bill(s).meters.retrieve(a.meterId),ctx);
    await customer(s,a.customerId,ctx);
    const p=await bill(s).meters.listEventSummaries(a.meterId,{
      ...paging(a),customer:a.customerId,start_time:a.startTime,end_time:a.endTime,
      ...(a.grouping?{value_grouping_window:a.grouping}:{})});
    return {meter:m.id,customerId:a.customerId,
      aggregationIsAsynchronous:true,...pageResult(p,v=>{
        if(v?.object!=='billing.meter_event_summary'||v.livemode!==mode(ctx)||
          v.meter!==m.id||!Number.isFinite(v.aggregated_value))
          error('Meter summary facts unavailable');
        return {id:v.id,value:v.aggregated_value,start:v.start_time,end:v.end_time};
      })};
  },
  alert_list:async(a,s,ctx)=>pageResult(await bill(s).alerts.list(paging(a)),v=>alert(v,ctx)),
  credit_list_grants:async(a,s,ctx)=>pageResult(await bill(s).creditGrants.list({
    ...paging(a),...(a.customerId?{customer:a.customerId}:{})}),v=>credit(v,ctx))
};
export const handlers=Object.fromEntries(readDefs.map(([name,def])=>[name,
  async(a={},ctx)=>{
    try{
      check(a,def);
      const s=await catalogClient(ctx);
      return reply(await readers[name](a,s,ctx));
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }]));
function writeHandler(name,def){
  let result=null,previous=null,archived=false;
  const creditAction=name.startsWith('credit_');
  const op=defineWrite({
    name,
    resultId:(_b,v)=>v?.id??null,
    read:async(a,ctx)=>{
      result=null;previous=null;archived=false;
      check(a,def,true);
      await scope(ctx);
      const s=await catalogClient(ctx);
      if(name==='meter_create'){
        const list=await bill(s).meters.list({limit:100});
        if(!Array.isArray(list?.data)||list.has_more)
          error('Cannot safely prove unique meter event name');
        for(const value of list.data){
          const item=meter(value,ctx);
          if(item.eventName===a.eventName)
            error('Meter event name already exists; use the original meter');
        }
        return {object:'billing.meter',metadata:{},id:null};
      }
      if(name==='meter_update'||name==='meter_deactivate'||name==='meter_reactivate'){
        const v=await bill(s).meters.retrieve(a.meterId);
        const m=meter(v,ctx);
        await noApp(v,ctx);previous=v;
        if(name==='meter_deactivate'&&m.status!=='active'||
          name==='meter_reactivate'&&m.status!=='inactive')
          error('Meter already in requested or incompatible status');
        return v;
      }
      if(name==='meter_record_usage'){
        const v=await bill(s).meters.retrieve(a.meterId),m=meter(v,ctx);
        if(m.status!=='active')error('Inactive meter does not accept usage');
        const c=await customer(s,a.customerId,ctx);
        await noApp(c,ctx);
        if(a.timestamp!==undefined&&
          (a.timestamp<Math.floor(Date.now()/1000)-35*86400||
            a.timestamp>Math.floor(Date.now()/1000)+300))
          error('Usage timestamp outside Stripe ingestion window');
        previous=m;
        return c;
      }
      if(name==='alert_create'){
        const v=await bill(s).meters.retrieve(a.meterId),m=meter(v,ctx);
        if(m.status!=='active')error('Alert meter must be active');
        await noApp(v,ctx);
        if(a.customerId){
          const c=await customer(s,a.customerId,ctx);await noApp(c,ctx);
        }
        return v;
      }
      if(name.startsWith('alert_')){
        const v=await bill(s).alerts.retrieve(a.alertId),al=alert(v,ctx);
        await noApp(v,ctx);
        if(al.customerId){const c=await customer(s,al.customerId,ctx);await noApp(c,ctx);}
        if(name==='alert_activate'&&al.status!=='inactive'||
          name!=='alert_activate'&&al.status!=='active')
          error('Alert not in expected prior lifecycle state');
        previous=v;return v;
      }
      if(name==='credit_create_grant'){
        const c=await customer(s,a.customerId,ctx);await noApp(c,ctx);
        return c;
      }
      if(name==='credit_void_grant'){
        const v=await bill(s).creditGrants.retrieve(a.grantId),cr=credit(v,ctx);
        if(cr.voidedAt!==null)error('Credit grant was already voided');
        const c=await customer(s,cr.customerId,ctx);
        await noApp(c,ctx);previous=v;
        return {...v,customer:c};
      }
      error('Unsupported metered billing mutation');
    },
    summarize:(before,a,ctx)=>ctx.connection.mode.toUpperCase()+' MODE: '+name+
      '. Meter records can change usage charges; alerts can affect notifications. '+
      (creditAction?'Financial credits change customer entitlements or future invoices. ':
        name==='meter_record_usage'?'Stripe accepts usage asynchronously; no final bill is proven. ':'')+
      'Explicit owner confirmation, stable retry key, audit and provider verification required.'+
      (name==='alert_archive'?' Archive is irreversible.':''),
    money:creditAction?async(a,_ctx,b)=>{
      const value=name==='credit_create_grant'?a.amountCents:credit(b,_ctx).amountCents;
      const target=name==='credit_create_grant'?a.customerId:credit(b,_ctx).customerId;
      const currency=name==='credit_create_grant'?a.currency:credit(b,_ctx).currency;
      return {amountCents:value,currency,direction:name==='credit_create_grant'?'out':'change',
        targetId:target,description:name+' for selected customer '+target};
    }:undefined,
    targetGuard:async()=>true,
    beforeApply:name==='credit_void_grant'?async({ctx,key,prepared,tool})=>{
      if(typeof ctx.db?.requestMoneyApproval!=='function'||
        typeof ctx.db?.consumeApprovedMoneyChange!=='function')
        return {accepted:false,reason:'Independent credit-void approval unavailable'};
      const exact={account:ctx.connection.stripeAccount,idempotencyKey:key,
        tool,description:prepared.description,target:prepared.targetId,
        mode:ctx.connection.mode,amountCents:prepared.amountCents,currency:prepared.currency};
      if(await ctx.db.requestMoneyApproval(exact)!==true)
        return {accepted:false,reason:'Exact credit-void request unavailable'};
      const approved=await ctx.db.consumeApprovedMoneyChange(exact);
      return {accepted:approved,reason:approved?undefined:
        'Independent owner approval is required for this exact credit void'};
    }:undefined,
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await catalogClient(ctx),opts={idempotencyKey},b=bill(s);
      if(name==='meter_create')result=await b.meters.create({
        display_name:a.displayName,event_name:a.eventName,
        default_aggregation:{formula:a.formula},
        customer_mapping:{type:'by_id',event_payload_key:a.customerKey??'stripe_customer_id'},
        value_settings:{event_payload_key:a.valueKey??'value'}},opts);
      if(name==='meter_update')result=await b.meters.update(a.meterId,{
        display_name:a.displayName},opts);
      if(name==='meter_deactivate')result=await b.meters.deactivate(a.meterId,{},opts);
      if(name==='meter_reactivate')result=await b.meters.reactivate(a.meterId,{},opts);
      if(name==='meter_record_usage'){
        const m=previous;
        if(typeof ctx.db?.claimMeterUsageEvent!=='function'||
          typeof ctx.db?.confirmMeterUsageEvent!=='function')
          error('Durable meter event ledger unavailable');
        const claim={account:ctx.connection.stripeAccount,meterId:a.meterId,
          customerId:a.customerId,eventName:m.eventName,
          identifier:a.identifier,units:a.units,requestKey:idempotencyKey,
          mode:ctx.connection.mode};
        if(await ctx.db.claimMeterUsageEvent(claim)!==true)
          error('Meter event identifier is already reserved; reconcile an uncertain original, never replay');
        result=await b.meterEvents.create({event_name:m.eventName,
          identifier:a.identifier,
          ...(a.timestamp?{timestamp:a.timestamp}:{}),
          payload:{[m.customerKey]:a.customerId,[m.valueKey]:String(a.units)}},opts);
        if(result?.object!=='billing.meter_event'||result.livemode!==mode(ctx)||
          result.identifier!==a.identifier||result.event_name!==m.eventName||
          result.payload?.[m.customerKey]!==a.customerId||
          result.payload?.[m.valueKey]!==String(a.units))
          error('Original usage provider acknowledgment uncertain; identifier remains reserved');
        if(await ctx.db.confirmMeterUsageEvent(claim)!==true)
          error('Durable usage acknowledgement uncertain; identifier remains reserved');
      }
      if(name==='alert_create')result=await b.alerts.create({
        alert_type:'usage_threshold',title:a.title,
        usage_threshold:{meter:a.meterId,gte:a.threshold,recurrence:'one_time',
          ...(a.customerId?{filters:[{type:'customer',customer:a.customerId}]}:{})}},opts);
      if(name==='alert_activate')result=await b.alerts.activate(a.alertId,{},opts);
      if(name==='alert_deactivate')result=await b.alerts.deactivate(a.alertId,{},opts);
      if(name==='alert_archive'){
        result=await b.alerts.archive(a.alertId,{},opts);archived=true;
      }
      if(name==='credit_create_grant')result=await b.creditGrants.create({
        customer:a.customerId,amount:{type:'monetary',
          monetary:{currency:a.currency,value:a.amountCents}},
        category:a.category,applicability_config:{scope:{price_type:'metered'}},
        ...(a.name?{name:a.name}:{}),
        ...(a.expiresAt?{expires_at:a.expiresAt}:{})},opts);
      if(name==='credit_void_grant')result=await b.creditGrants.voidGrant(a.grantId,{},opts);
    },
    readAfter:async(a,ctx)=>{
      const b=bill(await catalogClient(ctx));
      if(name==='meter_record_usage')return result; // Stripe has no GET meter-event API.
      if(name.startsWith('meter_'))
        return b.meters.retrieve(a.meterId??result?.id);
      if(name.startsWith('alert_')){
        try{return await b.alerts.retrieve(a.alertId??result?.id);}
        catch(e){if(name==='alert_archive'&&archived&&
          e?.statusCode===404&&e?.code==='resource_missing'&&
          result?.status==='archived'&&result?.id===a.alertId)
          return result;throw e;}
      }
      return b.creditGrants.retrieve(a.grantId??result?.id);
    },
    verify:(before,after,a,ctx)=>{
      if(name==='meter_record_usage'){
        const m=previous;
        return after?.object==='billing.meter_event'&&
          after.livemode===mode(ctx)&&after.event_name===m.eventName&&
          after.identifier===a.identifier&&
          after.payload?.[m.customerKey]===a.customerId&&
          after.payload?.[m.valueKey]===String(a.units)&&
          Number.isSafeInteger(after.created)&&Number.isSafeInteger(after.timestamp)&&
          (a.timestamp===undefined||after.timestamp===a.timestamp);
      }
      if(name.startsWith('meter_')){
        const v=meter(after,ctx);
        return v.id===(a.meterId??result?.id)&&
          (name!=='meter_create'||v.eventName===a.eventName&&
            v.formula===a.formula&&v.customerKey===(a.customerKey??'stripe_customer_id')&&
            v.valueKey===(a.valueKey??'value'))&&
          (!['meter_create','meter_update'].includes(name)||v.displayName===a.displayName)&&
          (name!=='meter_deactivate'||v.status==='inactive')&&
          (name!=='meter_reactivate'||v.status==='active');
      }
      if(name.startsWith('alert_')){
        const v=alert(after,ctx);
        return v.id===(a.alertId??result?.id)&&
          (name!=='alert_create'||v.title===a.title&&v.meterId===a.meterId&&
            v.threshold===a.threshold&&v.recurrence==='one_time'&&
            v.customerId===(a.customerId??null))&&
          (name!=='alert_activate'||v.status==='active')&&
          (name!=='alert_deactivate'||v.status==='inactive')&&
          (name!=='alert_archive'||v.status==='archived');
      }
      const v=credit(after,ctx);
      if(v.id!==(a.grantId??result?.id))return false;
      if(name==='credit_create_grant')return v.customerId===a.customerId&&
        v.amountCents===a.amountCents&&v.currency===a.currency&&
        v.category===a.category&&v.scope==='metered'&&v.voidedAt===null;
      return v.customerId===credit(before,ctx).customerId&&
        v.amountCents===credit(before,ctx).amountCents&&
        v.voidedAt!==null;
    }
  });
  return (a,ctx)=>catalogMode(ctx)?op.handler(a,ctx):
    gone('Selected TEST/LIVE account required for metered billing');
}
for(const [name,def] of writeDefs){
  const write=defineWrite({name,read:async()=>({}),summarize:()=>name,
    apply:async()=>{},readAfter:async()=>({}),verify:async()=>false});
  // The actual handler enforces durable money reservation; discovery must
  // identify the same credit grants as financial before LIVE delegation.
  tools.push({...write.tool,
    ...(name.startsWith('credit_')?{moneySpec:'provider-derived',safety:'$'}:{}),
    area:'catalog',
    profiles:name==='meter_record_usage'?writeProfiles:fullProfiles,
    description:name.replaceAll('_',' '),
    ...(name==='alert_archive'||name==='credit_void_grant'?
      {annotations:{destructiveHint:true}}:{}),
    inputSchema:schema({...def.props,...flags},def.required)});
  handlers[name]=(a,ctx)=>writeHandler(name,def)(a,ctx);
}
