import {describe,it,expect,vi} from 'vitest';
import {tools,handlers,warningSafe,reviewSafe,valueListSafe,valueItemSafe}
  from '../../src/tools/radar-reads.js';
import {registry} from '../../src/tools/index.js';
const now=1695680197;
const warning={id:'issfr_FAKE1234',object:'radar.early_fraud_warning',
  livemode:false,created:now,charge:'ch_FAKE1234',payment_intent:null,
  actionable:true,fraud_type:'misc',ip_address:'SECRET_IP'};
const review={id:'prv_FAKE1234',object:'review',livemode:false,created:now,
  charge:null,payment_intent:'pi_FAKE1234',open:true,reason:'rule',
  billing_zip:'SECRET_ZIP',ip_address:'SECRET_IP'};
const list={id:'rsl_FAKE1234',object:'radar.value_list',livemode:false,
  created:now,alias:'fraud_test',item_type:'email',name:'Fraud test',
  list_items:{total_count:1}};
const item={id:'rsli_FAKE1234',object:'radar.value_list_item',
  livemode:false,created:now,value_list:list.id,value:'SECRET_EMAIL'};
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const s={radar:{
    earlyFraudWarnings:{list:vi.fn(async()=>({data:[warning],has_more:false})),
      retrieve:vi.fn(async()=>warning)},
    valueLists:{list:vi.fn(async()=>({data:[list],has_more:false})),
      retrieve:vi.fn(async()=>list)},
    valueListItems:{list:vi.fn(async()=>({data:[item],has_more:false}))}},
    reviews:{list:vi.fn(async()=>({data:[review],has_more:false})),
      retrieve:vi.fn(async()=>review)}};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:'acct_FAKE1234'},
    services:{stripeForConnection:async()=>s}};
  return {ctx,s,run:(name,args={})=>handlers[name](args,ctx)};
}
describe('G-3a safe Radar reads',()=>{
  it('registers six TEST reader tools in all profiles',()=>{
    expect(tools).toHaveLength(6);
    expect(tools.every(t=>t.writes===false&&t.profiles.includes('read_only'))).toBe(true);
    for(const t of tools)expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
  });
  it('projects safe exact identifiers and strips IP/address/list-item raw values',()=>{
    const all=[warningSafe(warning),reviewSafe(review),valueListSafe(list),valueItemSafe(item)];
    expect(JSON.stringify(all)).not.toMatch(/SECRET_/);
    expect(all[0]).toMatchObject({id:warning.id,charge:warning.charge});
    expect(all[1]).toMatchObject({id:review.id,open:true});
    expect(all[3]).toMatchObject({id:item.id,valueListId:list.id,hasValue:true});
  });
  it('reads every native SDK route with strict pagination and no raw values',async()=>{
    const f=fixture();
    for(const [name,args] of [
      ['radar_list_fraud_warnings',{limit:10}],
      ['radar_get_fraud_warning',{warningId:warning.id}],
      ['radar_list_reviews',{}],['radar_get_review',{reviewId:review.id}],
      ['radar_list_value_lists',{}],
      ['radar_list_list_items',{valueListId:list.id,limit:4}]
    ]){
      const res=parse(await f.run(name,args));
      expect(JSON.stringify(res)).not.toMatch(/SECRET_/);
      expect(res.data?.length??1).toBe(1);
    }
    expect(f.s.radar.valueListItems.list).toHaveBeenCalledWith({
      limit:4,value_list:list.id});
  });
  it('blocks foreign list items, malformed cursors and provider identity drift',async()=>{
    const f=fixture();
    const wrong=()=>f.run('radar_list_list_items',{valueListId:'rsl_OTHER'});
    const foreign=await wrong();
    expect(foreign.isError).toBe(true);
    expect((await f.run('radar_list_reviews',{starting_after:'issfr_BAD'})).isError).toBe(true);
    expect((await f.run('radar_get_review',{reviewId:'prv_MISMATCH'})).isError).toBe(true);
    expect(()=>reviewSafe({...review,livemode:true})).toThrow();
    expect(()=>valueItemSafe({...item,value_list:'rsl_?' })).toThrow();
  });
  it('refuses LIVE even when the provider might permit reads',async()=>{
    const f=fixture(),live={...f.ctx,connection:{...f.ctx.connection,mode:'live'}};
    const res=await handlers.radar_list_reviews({},live);
    expect(res.isError).toBe(true);
    expect(f.s.reviews.list).not.toHaveBeenCalled();
  });
});
