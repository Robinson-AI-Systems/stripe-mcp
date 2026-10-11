// TEST time-travel primitives required for real subscription renewal scenarios.
import {defineWrite,gone} from './write.js';
import {client,guarded,reply,allProfiles,writeProfiles} from './billing-shared.js';
const clockId=x=>typeof x==='string'&&/^clock_[A-Za-z0-9]{2,100}$/.test(x);
const freeze=x=>Number.isSafeInteger(x)&&x>=946684800&&x<=4102444800;
const ownName=x=>typeof x==='string'&&x.startsWith('RTC DEV ')&&x.length<=80;
const own=x=>ownName(x?.name)&&x?.object==='test_helpers.test_clock'&&
  clockId(x.id)&&x.livemode===false;
const bad=x=>{throw new TypeError(x);};
const shape=x=>{
  if(x?.object!=='test_helpers.test_clock'||!clockId(x.id)||x.livemode===true||
    !freeze(x.frozen_time)||!['ready','advancing','internal_failure'].includes(x.status))
    bad('TEST clock provider identity/state could not be verified');
  return {id:x.id,name:x.name??null,status:x.status,
    frozenTime:x.frozen_time,targetFrozenTime:
      x.status_details?.advancing?.target_frozen_time??null,
    deletesAfter:x.deletes_after??null,mode:'test'};
};
const valid=(a,keys)=>{
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>![...keys,'confirm','dryRun','requestKey'].includes(k)))
    bad('Unsupported TEST clock arguments');
  if(a.requestKey!==undefined&&(typeof a.requestKey!=='string'||
    a.requestKey.length<1||a.requestKey.length>128))
    bad('Stable TEST clock requestKey must be 1–128 characters');
};
const name=a=>'RTC DEV '+(a.name??'Subscription Simulation');
export function makeTestClockWrite(kind){
  if(!['create','advance'].includes(kind))bad('Unknown clock write');
  let createdId=null;
  const isCreate=kind==='create';
  const op=defineWrite({
    name:'testclock_'+kind,
    read:async(a,ctx)=>{
      if(ctx?.connection?.mode!=='test')bad('TEST clocks require TEST mode');
      valid(a,isCreate?['name','frozenTime']:['clockId','frozenTime']);
      if(!freeze(a.frozenTime))bad('A bounded Unix timestamp frozenTime is required');
      if(isCreate){
        if(a.name!==undefined&&(typeof a.name!=='string'||!/^[-A-Za-z0-9 ]{1,60}$/.test(a.name)))
          bad('TEST clock name must be 1–60 simple characters');
        return {id:null,metadata:{},name:name(a)};
      }
      if(!clockId(a.clockId))bad('Invalid TEST clock ID');
      const before=await (await client(ctx)).testHelpers.testClocks.retrieve(a.clockId);
      if(!own(before))bad('Only RTC DEV TEST clocks can be advanced');
      if(before.status!=='ready')bad('TEST clock is not ready to advance');
      if(!freeze(before.frozen_time)||a.frozenTime<=before.frozen_time||
        a.frozenTime>before.frozen_time+2*366*86400)
        bad('Advance must be after frozen time and within two years; Stripe may require a shorter subscription interval');
      return {...before,metadata:{}};
    },
    summarize:(b,a)=>isCreate?
      'TEST MODE. Create an isolated developer test clock called '+name(a)+
        ' frozen at Unix time '+a.frozenTime+'. Test clocks cannot be used with LIVE.':
      'TEST MODE. Advance recorded developer clock '+a.clockId+
        ' from '+b.frozen_time+' to '+a.frozenTime+
        '. Stripe may advance asynchronously; verify status ready before claiming completion.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await client(ctx);
      const out=isCreate?
        await s.testHelpers.testClocks.create({
          frozen_time:a.frozenTime,name:name(a)
        },{idempotencyKey}):
        await s.testHelpers.testClocks.advance(a.clockId,{
          frozen_time:a.frozenTime
        },{idempotencyKey});
      if(out?.object!=='test_helpers.test_clock'||!clockId(out.id)||
        out.livemode===true||(isCreate&&!ownName(out.name))||
        (!isCreate&&out.id!==a.clockId))
        bad('Stripe did not acknowledge the intended TEST clock action');
      createdId=out.id;
    },
    readAfter:async(a,ctx)=>{
      const id=createdId??a.clockId;
      if(!clockId(id))return null;
      return (await client(ctx)).testHelpers.testClocks.retrieve(id);
    },
    verify:(before,after,a)=>after?.object==='test_helpers.test_clock'&&
      after.livemode===false&&clockId(after.id)&&
      ownName(after.name)&&after.status==='ready'&&
      after.frozen_time===a.frozenTime&&
      (isCreate?after.id===createdId&&after.name===name(a):
        after.id===before.id)
  });
  return op;
}
const common={frozenTime:{type:'integer',minimum:946684800,maximum:4102444800},
  dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
const definitions=[
  {kind:'create',description:'Create an isolated TEST clock and verify its initial frozen time.',
    properties:{...common,name:{type:'string',minLength:1,maxLength:60}},
    required:['frozenTime']},
  {kind:'advance',description:'Advance an RTC DEV TEST clock; completion requires independently verified ready state.',
    properties:{...common,clockId:{type:'string',pattern:'^clock_[A-Za-z0-9]{2,100}$'}},
    required:['frozenTime','clockId']}
];
export const tools=[
  {name:'testclock_list',area:'developer',writes:false,profiles:allProfiles,
    description:'List or inspect TEST clock statuses, including asynchronous advance progress.',
    annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{
      clockId:{type:'string',pattern:'^clock_[A-Za-z0-9]{2,100}$'},
      limit:{type:'integer',minimum:1,maximum:100},
      startingAfter:{type:'string',pattern:'^clock_[A-Za-z0-9]{2,100}$'}
    },additionalProperties:false}},
  ...definitions.map(d=>({
    ...makeTestClockWrite(d.kind).tool,
    name:'testclock_'+d.kind,area:'developer',profiles:writeProfiles,
    description:d.description,
    inputSchema:{type:'object',properties:d.properties,required:d.required,
      additionalProperties:false}
  }))
];
export const handlers={
  testclock_list:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('TEST clocks are unavailable in LIVE mode'):
    guarded(ctx,async s=>{
      valid(a??{},['clockId','limit','startingAfter']);
      if(a?.clockId){
        if(a.limit!==undefined||a.startingAfter!==undefined||!clockId(a.clockId))
          bad('Exact TEST clock lookup only accepts clockId');
        return {clock:shape(await s.testHelpers.testClocks.retrieve(a.clockId))};
      }
      const limit=a?.limit??20;
      if(!Number.isInteger(limit)||limit<1||limit>100||
        (a?.startingAfter!==undefined&&!clockId(a.startingAfter)))
        bad('Bounded TEST clock listing required');
      const v=await s.testHelpers.testClocks.list({limit,
        ...(a?.startingAfter?{starting_after:a.startingAfter}:{})});
      if(!Array.isArray(v?.data)||typeof v.has_more!=='boolean')
        bad('Invalid TEST clock list from Stripe');
      return {data:v.data.map(shape),hasMore:v.has_more,
        next:v.has_more?v.data.at(-1)?.id??null:null};
    }),
  testclock_create:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('TEST clock creation requires TEST mode'):
    makeTestClockWrite('create').handler(a,ctx),
  testclock_advance:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('TEST clock advancement requires TEST mode'):
    makeTestClockWrite('advance').handler(a,ctx)
};
