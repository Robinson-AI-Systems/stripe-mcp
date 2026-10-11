import {describe,it,expect,vi} from 'vitest';
import {makeRadarDeleteList,makeRadarAddItem,makeRadarRemoveItem,tools,handlers}
  from '../../src/tools/radar-list-lifecycle.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const listId='rsl_FAKE1234',itemId='rsli_FAKE1234';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({itemType='email',hasItems=false,uncertain=false,appOwned=false}={}){
  let list={id:listId,object:'radar.value_list',livemode:false,created:1695680197,
    name:'Sample',alias:'sample_list',item_type:itemType,
    list_items:{total_count:hasItems?1:0,has_more:false},
    metadata:appOwned?{agreementId:'app-owns'}:{}};
  let item={id:itemId,object:'radar.value_list_item',livemode:false,
    value_list:listId,created:1695680197,value:'secret@example.com'};
  let deletedList=false,deletedItem=false;
  const missing=()=>Object.assign(new Error('Not found'),{code:'resource_missing'});
  const s={radar:{valueLists:{
    retrieve:vi.fn(async()=>{if(deletedList&&!uncertain)throw missing();return list;}),
    del:vi.fn(async()=>{if(!uncertain)deletedList=true;
      return {id:listId,object:'radar.value_list',deleted:true};})},
    valueListItems:{
      list:vi.fn(async()=>({data:hasItems?[item]:[],has_more:false})),
      retrieve:vi.fn(async()=>{if(deletedItem&&!uncertain)throw missing();return item;}),
      create:vi.fn(async(_a)=>{item={...item,value:_a.value};
        return item;}),
      del:vi.fn(async()=>{if(!uncertain)deletedItem=true;
        return {id:itemId,object:'radar.value_list_item',deleted:true};})}}};
  const db=createFakeDb(),ctx={db,connectionId:'risk-list-client',
    connection:{mode:'test',stripeAccount:'acct_FAKE1234',profile:'full'},
    services:{stripeForConnection:async()=>s}};
  return {s,ctx,db,del:a=>makeRadarDeleteList().handler(a,ctx),
    add:a=>makeRadarAddItem().handler(a,ctx),
    remove:a=>makeRadarRemoveItem().handler(a,ctx)};
}
describe('G-3c Radar list-item writes, exact guarded handlers',()=>{
  it('registers three full-only destructive/provider writes',()=>{
    expect(tools).toHaveLength(3);
    expect(tools.every(t=>t.writes===true&&t.profiles.join(',')==='full'&&
      t.writeContract==='defineWrite-v1')).toBe(true);
    for(const t of tools)expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
  });
  it('list deletion: preview and missing confirm write nothing; empty list deletes once',async()=>{
    const f=fixture(),a={listId,requestKey:'delete-empty'};
    expect(parse(await f.del({...a,dryRun:true})).preview).toContain('EMPTY');
    expect(parse(await f.del(a)).needsConfirmation).toBe(true);
    expect(f.s.radar.valueLists.del).not.toHaveBeenCalled();
    expect(parse(await f.del({...a,confirm:true}))).toMatchObject({done:true,confirmed:true});
    expect(f.s.radar.valueLists.del).toHaveBeenCalledWith(listId,{},
      {idempotencyKey:expect.any(String)});
  });
  it('deletion refuses list with items or app-owned marker even with confirm',async()=>{
    const nonempty=fixture({hasItems:true});
    await expect(nonempty.del({listId,confirm:true})).rejects.toThrow(/EMPTY|empty/i);
    expect(nonempty.s.radar.valueLists.del).not.toHaveBeenCalled();
    const owned=fixture({appOwned:true});
    expect(parse(await owned.del({listId,confirm:true})).done).toBe(false);
    expect(owned.s.radar.valueLists.del).not.toHaveBeenCalled();
  });
  it('add item hides sensitive value but sends it to Stripe with stable idempotency',async()=>{
    const f=fixture({hasItems:false}),a={listId,value:'private@example.com',requestKey:'add'};
    const preview=parse(await f.add({...a,dryRun:true}));
    expect(preview.preview).toContain('Value length');
    expect(JSON.stringify(preview)).not.toContain(a.value);
    expect(parse(await f.add({...a,confirm:true}))).toMatchObject({done:true,confirmed:true});
    expect(f.s.radar.valueListItems.create).toHaveBeenCalledWith({
      value_list:listId,value:a.value},{idempotencyKey:expect.any(String)});
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(a.value);
  });
  it('bad values, wrong item type and uncertain deletion all fail closed',async()=>{
    const f=fixture({itemType:'ip_address'});
    await expect(f.add({listId,value:'not-an-ip',confirm:true})).rejects.toThrow();
    expect(f.s.radar.valueListItems.create).not.toHaveBeenCalled();
    const uncertain=fixture({uncertain:true});
    expect(parse(await uncertain.del({listId,confirm:true})).confirmed).toBe(false);
    expect(parse(await uncertain.remove({itemId,confirm:true})).confirmed).toBe(false);
  });
  it('remove item re-verifies parent and tombstone, never reveals raw value',async()=>{
    const f=fixture();
    const preview=parse(await f.remove({itemId,dryRun:true}));
    expect(JSON.stringify(preview)).not.toContain('secret@example.com');
    expect(parse(await f.remove({itemId,confirm:true}))).toMatchObject({
      done:true,confirmed:true});
    expect(f.s.radar.valueListItems.del).toHaveBeenCalledWith(itemId,{},
      {idempotencyKey:expect.any(String)});
  });
  it('LIVE and read_only cannot mutate via handlers',async()=>{
    const f=fixture();
    for(const [name,a] of [['radar_delete_value_list',{listId}],
      ['radar_add_list_item',{listId,value:'private@example.com'}],
      ['radar_remove_list_item',{itemId}]]){
      for(const v of [{mode:'live'},{profile:'read_only'}]){
        expect((await handlers[name]({...a,confirm:true},{...f.ctx,
          connection:{...f.ctx.connection,...v}})).isError).toBe(true);
      }
    }
    expect(f.s.radar.valueLists.del).not.toHaveBeenCalled();
    expect(f.s.radar.valueListItems.del).not.toHaveBeenCalled();
  });
});
