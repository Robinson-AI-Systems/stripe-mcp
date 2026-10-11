// G-3c: guarded Radar list removal and value-item lifecycle, TEST only.
// User-supplied item values never appear in previews, results or audit.
import {isIP} from 'node:net';
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields,ref} from './billing-shared.js';
import {valueListSafe,valueItemSafe} from './radar-reads.js';
const invalid=m=>{throw new TypeError(m);};
const listId={type:'string',pattern:'^rsl_[A-Za-z0-9]{2,100}$'};
const itemId={type:'string',pattern:'^rsli_[A-Za-z0-9]{2,100}$'};
const ownership={outsideApp:{type:'boolean'}};
const listArgs={listId,...ownership};
const addArgs={listId,value:{type:'string',minLength:1,maxLength:200},...ownership};
const removeArgs={itemId,...ownership};
const listClient=(s,id)=>s.radar.valueLists.retrieve(id);
async function readList(a,ctx,props,needed=['listId']){
  validateFields(a,props,needed);
  const s=await client(ctx),v=await listClient(s,a.listId);
  if(v?.id!==a.listId)valueListSafe(v); // checked below also rejects absent/foreign
  valueListSafe(v);
  if(v.id!==a.listId)invalid('Radar list identity mismatch');
  return v;
}
function validateValue(type,value){
  if(typeof value!=='string'||value.length<1||value.length>200||
    value!==value.trim()||/[\r\n\0]/.test(value))
    invalid('Invalid Radar value length or characters');
  if(type==='email'&&!/^[^\s@]{1,64}@[^\s@]{1,180}\.[^\s@]{2,30}$/.test(value))
    invalid('Email must be formatted correctly');
  if(type==='ip_address'&&!isIP(value))invalid('Valid IPv4 or IPv6 required');
  if(type==='country'&&!/^[A-Z]{2}$/.test(value))invalid('Two-letter country required');
  if(type==='card_bin'&&!/^[0-9]{6,8}$/.test(value))
    invalid('Six to eight numeric BIN digits required');
}
const controls={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
const isGone=e=>e?.code==='resource_missing'||e?.raw?.code==='resource_missing';
export function makeRadarDeleteList(){
  let receipt=null;
  return defineWrite({
    name:'radar_delete_value_list',
    read:async(a,ctx)=>{
      const list=await readList(a,ctx,listArgs);
      if(list.list_items?.total_count!==0||list.list_items?.has_more===true)
        invalid('Only empty verified TEST Radar lists may be deleted');
      const page=await (await client(ctx)).radar.valueListItems.list({
        value_list:list.id,limit:1});
      if(!Array.isArray(page?.data)||page.data.length!==0||
        page.has_more!==false)invalid('Radar list emptiness could not be verified');
      return list;
    },
    summarize:b=>'TEST MODE. IRREVERSIBLY delete verified EMPTY value list '+b.id+
      ', alias '+b.alias+'. No rules referencing this list may remain.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const result=await (await client(ctx)).radar.valueLists.del(
        a.listId,{}, {idempotencyKey});
      if(result?.id!==a.listId||result.deleted!==true)
        invalid('Radar list deletion receipt unavailable');
      receipt=result.id;
    },
    readAfter:async(a,ctx)=>{
      if(!receipt)return null;
      try{return await listClient(await client(ctx),a.listId);}
      catch(e){if(isGone(e))return {id:a.listId,deleted:true};throw e;}
    },
    verify:(b,a)=>receipt===b.id&&a?.id===b.id&&a.deleted===true
  });
}
export function makeRadarAddItem(){
  let createdId=null;
  return defineWrite({
    name:'radar_add_list_item',
    read:async(a,ctx)=>{
      const list=await readList(a,ctx,addArgs);
      validateValue(list.item_type,a.value);
      return list;
    },
    summarize:(b,a)=>'TEST MODE. Add one '+b.item_type+' value to Radar list '+
      b.id+'. Value length '+a.value.length+
      '; actual value is private and never written to preview or audit.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const result=await (await client(ctx)).radar.valueListItems.create({
        value_list:a.listId,value:a.value},{idempotencyKey});
      if(!/^rsli_[A-Za-z0-9]{2,100}$/.test(result?.id??'')||
        result.object!=='radar.value_list_item'||result.livemode!==false||
        ref(result.value_list)!==a.listId)
        invalid('Radar item creation response identity unavailable');
      createdId=result.id;
    },
    readAfter:async(_a,ctx)=>createdId?
      (await client(ctx)).radar.valueListItems.retrieve(createdId):null,
    verify:(b,a,args)=>!!createdId&&a?.id===createdId&&
      valueItemSafe(a).valueListId===b.id&&a.value===args.value
  });
}
export function makeRadarRemoveItem(){
  let receipt=null;
  return defineWrite({
    name:'radar_remove_list_item',
    read:async(a,ctx)=>{
      validateFields(a,removeArgs,['itemId']);
      const s=await client(ctx),item=await s.radar.valueListItems.retrieve(a.itemId);
      if(item?.id!==a.itemId)valueItemSafe(item);
      const safe=valueItemSafe(item);
      const list=await listClient(s,safe.valueListId);
      valueListSafe(list);
      if(list.id!==safe.valueListId)
        invalid('Radar parent value list identity mismatch');
      return {...item,metadata:list.metadata??{},customer:null,
        _parentId:safe.valueListId};
    },
    summarize:b=>'TEST MODE. IRREVERSIBLY remove item '+b.id+
      ' from verified Radar list '+b._parentId+'. Actual private item value hidden.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const result=await (await client(ctx)).radar.valueListItems.del(
        a.itemId,{}, {idempotencyKey});
      if(result?.id!==a.itemId||result.deleted!==true)
        invalid('Radar value-list item deletion receipt unavailable');
      receipt=result.id;
    },
    readAfter:async(a,ctx)=>{
      if(!receipt)return null;
      try{return await (await client(ctx)).radar.valueListItems.retrieve(a.itemId);}
      catch(e){if(isGone(e))return {id:a.itemId,deleted:true};throw e;}
    },
    verify:(b,a)=>receipt===b.id&&a?.id===b.id&&a.deleted===true
  });
}
const specs=[
  {make:makeRadarDeleteList,name:'radar_delete_value_list',props:listArgs,
    required:['listId'],description:'Irreversibly delete an independently verified EMPTY TEST Radar list.'},
  {make:makeRadarAddItem,name:'radar_add_list_item',props:addArgs,
    required:['listId','value'],description:'Add a TEST Radar list item with safe preview and verified private value.'},
  {make:makeRadarRemoveItem,name:'radar_remove_list_item',props:removeArgs,
    required:['itemId'],description:'Remove a TEST Radar list item with verified parent and deletion tombstone.'}
];
export const tools=specs.map(s=>({...s.make().tool,
  area:'risk',profiles:fullProfiles,safety:s.name==='radar_add_list_item'?'P':'C',
  description:s.description,annotations:{destructiveHint:s.name!=='radar_add_list_item'},
  inputSchema:{type:'object',properties:{...s.props,...controls},required:s.required,
    additionalProperties:false}}));
export const handlers=Object.fromEntries(specs.map(s=>[s.name,(a,ctx)=>
  ctx?.connection?.mode!=='test'?gone('Radar list changes require TEST mode'):
  s.make().handler(a,ctx)]));
