import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {isGuardedLiveWrite} from '../../src/core/profiles.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

afterEach(()=>vi.unstubAllEnvs());
const account='acct_E3TEST123',record=r=>JSON.parse(r.content[0].text);
const all=['meter_list','meter_get','meter_create','meter_update',
  'meter_deactivate','meter_reactivate','meter_record_usage',
  'meter_list_usage_summaries','alert_list','alert_create','alert_activate',
  'alert_deactivate','alert_archive','credit_list_grants','credit_create_grant',
  'credit_void_grant'];
function fixture({mode='test',providerMode=mode,profile='full',grant=false,appOwned=false}={}){
  if(mode==='live')vi.stubEnv('VERCEL_ENV','production');
  const live=providerMode==='live',calls=[];
  const meter=(id='mtr_ABC123',opts={})=>({object:'billing.meter',id,
    livemode:live,display_name:'Usage',event_name:'meter_usage',
    status:'active',default_aggregation:{formula:'sum'},
    customer_mapping:{type:'by_id',event_payload_key:'stripe_customer_id'},
    value_settings:{event_payload_key:'value'},...opts});
  const alert=(id='alrt_ABC123',opts={})=>({object:'billing.alert',id,
    livemode:live,alert_type:'usage_threshold',status:'active',title:'Usage threshold',
    usage_threshold:{meter:'mtr_ABC123',gte:10,recurrence:'one_time',filters:null},...opts});
  const credit=(id='credgr_ABC123',opts={})=>({object:'billing.credit_grant',id,
    livemode:live,customer:'cus_ABC123',
    amount:{type:'monetary',monetary:{currency:'usd',value:500}},
    applicability_config:{scope:{price_type:'metered'}},
    category:'promotional',voided_at:null,...opts});
  const meters=new Map([['mtr_ABC123',meter()]]),
    alerts=new Map([['alrt_ABC123',alert()]]),
    grants=new Map([['credgr_ABC123',credit()]]);
  const list=m=>async()=>({data:[...m.values()],has_more:false});
  const sdk={
    accounts:{retrieve:vi.fn(async()=>({object:'account',id:account}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:live}))},
    customers:{retrieve:vi.fn(async id=>({object:'customer',id,
      livemode:live,metadata:appOwned?{agreementId:'app-owned'}:{}}))},
    billing:{
      meters:{
        list:vi.fn(list(meters)),retrieve:vi.fn(async id=>meters.get(id)),
        create:vi.fn(async(p,o)=>{calls.push({name:'meter.create',p,o});
          const v=meter('mtr_NEW123',{display_name:p.display_name,
            event_name:p.event_name,default_aggregation:p.default_aggregation,
            customer_mapping:p.customer_mapping,value_settings:p.value_settings});
          meters.set(v.id,v);return v;}),
        update:vi.fn(async(id,p,o)=>{calls.push({name:'meter.update',p,o});
          Object.assign(meters.get(id),p);return meters.get(id);}),
        deactivate:vi.fn(async(id,p,o)=>{calls.push({name:'meter.deactivate',o});
          meters.get(id).status='inactive';return meters.get(id);}),
        reactivate:vi.fn(async(id,p,o)=>{calls.push({name:'meter.reactivate',o});
          meters.get(id).status='active';return meters.get(id);}),
        listEventSummaries:vi.fn(async()=>({data:[{object:'billing.meter_event_summary',
          id:'mtrusg_123',meter:'mtr_ABC123',livemode:live,
          aggregated_value:42,start_time:1760000400,end_time:1760004000}],
          has_more:false}))
      },
      meterEvents:{create:vi.fn(async(p,o)=>{calls.push({name:'event.create',p,o});
        return {object:'billing.meter_event',livemode:live,
          event_name:p.event_name,identifier:p.identifier,payload:p.payload,
          timestamp:p.timestamp??1760001000,created:1760001001};})},
      alerts:{
        list:vi.fn(list(alerts)),retrieve:vi.fn(async id=>alerts.get(id)),
        create:vi.fn(async(p,o)=>{calls.push({name:'alert.create',p,o});
          const v=alert('alrt_NEW123',{title:p.title,usage_threshold:{
            gte:p.usage_threshold.gte,meter:p.usage_threshold.meter,
            recurrence:p.usage_threshold.recurrence,
            filters:p.usage_threshold.filters??null}});
          alerts.set(v.id,v);return v;}),
        activate:vi.fn(async(id,p,o)=>{calls.push({name:'alert.activate',o});
          alerts.get(id).status='active';return alerts.get(id);}),
        deactivate:vi.fn(async(id,p,o)=>{calls.push({name:'alert.deactivate',o});
          alerts.get(id).status='inactive';return alerts.get(id);}),
        archive:vi.fn(async(id,p,o)=>{calls.push({name:'alert.archive',o});
          alerts.get(id).status='archived';return alerts.get(id);})
      },
      creditGrants:{
        list:vi.fn(list(grants)),retrieve:vi.fn(async id=>grants.get(id)),
        create:vi.fn(async(p,o)=>{calls.push({name:'credit.create',p,o});
          const v=credit('credgr_NEW123',{customer:p.customer,
            amount:p.amount,applicability_config:p.applicability_config,
            category:p.category,name:p.name??null});
          grants.set(v.id,v);return v;}),
        voidGrant:vi.fn(async(id,p,o)=>{calls.push({name:'credit.void',o});
          grants.get(id).voided_at=1760001100;return grants.get(id);})
      }
    }
  };
  const db=createFakeDb({accounts:[{id:account,label:'E3',live_enabled:true,
    live_connected:true}]});
  db.requestMoneyApproval=vi.fn(async()=>true);
  db.reserveMoneyOut=vi.fn(async()=>({decision:'reserved'}));
  db.settleMoneyReservation=vi.fn(async()=>true);
  const claims=new Set();
  db.claimMeterUsageEvent=vi.fn(async args=>{
    const identity=args.account+'|'+args.identifier;
    if(claims.has(identity))return false;
    claims.add(identity);return true;
  });
  db.confirmMeterUsageEvent=vi.fn(async()=>true);
  db.consumeApprovedMoneyChange=vi.fn(async()=>true);
  const connection={stripeAccount:account,mode,profile,rtcLiveOwnerApproved:grant,
    moneyLimitCents:grant?50000:0};
  const ctx={db,connection,connectionId:'E3-test-owner',
    liveAccessGranted:grant,services:{stripeForConnection:async()=>sdk}};
  return {sdk,ctx,calls,meters,alerts,grants,db,
    run:(name,args={})=>registry.handlers[name](args,ctx),
    confirm:(name,args={})=>registry.handlers[name]({
      ...args,confirm:true,requestKey:'e3-'+name},ctx)};
}
describe('E-3 real Stripe Billing meter, usage, alert and credit-grant surfaces',()=>{
  it('registers exactly sixteen strict native operations, with write-contract safety',()=>{
    expect(registry.tools.filter(t=>all.includes(t.name)).map(x=>x.name).sort())
      .toEqual([...all].sort());
    for(const t of registry.tools.filter(t=>all.includes(t.name))){
      expect(t.area).toBe('catalog');
      expect(t.inputSchema.additionalProperties).toBe(false);
      if(t.writes)expect(t.writeContract).toBe('defineWrite-v1');
    }
  });
  it('reads provider-backed meters, asynchronous summaries, alerts and credit grants',async()=>{
    const f=fixture();
    expect(record(await f.run('meter_list')).data[0].id).toBe('mtr_ABC123');
    expect(record(await f.run('meter_get',{meterId:'mtr_ABC123'})).status).toBe('active');
    const summaries=record(await f.run('meter_list_usage_summaries',{meterId:'mtr_ABC123',
      customerId:'cus_ABC123',startTime:1760000400,endTime:1760004000}));
    expect(summaries.aggregationIsAsynchronous).toBe(true);
    expect(summaries.data[0].value).toBe(42);
    expect(record(await f.run('alert_list')).data[0].status).toBe('active');
    expect(record(await f.run('credit_list_grants')).data[0].amountCents).toBe(500);
    expect(f.calls).toEqual([]);
  });
  it('guards meter create, name and mapping immutability, deactivate and reactivate',async()=>{
    const f=fixture(),a={displayName:'API Requests',
      eventName:'api_requests',formula:'sum'};
    expect(record(await f.run('meter_create',{...a,dryRun:true})).done).toBe(false);
    expect(f.calls).toHaveLength(0);
    expect(record(await f.confirm('meter_create',a)).confirmed).toBe(true);
    expect(f.calls.filter(x=>x.name==='meter.create')).toHaveLength(1);
    await expect(f.confirm('meter_create',a)).rejects.toThrow(/already exists/);
    expect(record(await f.confirm('meter_update',{meterId:'mtr_ABC123',
      displayName:'Renamed'})).confirmed).toBe(true);
    expect(record(await f.confirm('meter_deactivate',{meterId:'mtr_ABC123'}))
      .confirmed).toBe(true);
    expect(record(await f.confirm('meter_reactivate',{meterId:'mtr_ABC123'}))
      .confirmed).toBe(true);
    expect(f.meters.get('mtr_ABC123').status).toBe('active');
  });
  it('requires stable original event identifiers, exact provider receipt and customer',async()=>{
    const f=fixture(),a={meterId:'mtr_ABC123',customerId:'cus_ABC123',
      units:42,identifier:'usage-event-0001'};
    expect(record(await f.run('meter_record_usage',{...a,dryRun:true})).done)
      .toBe(false);
    expect(f.calls).toHaveLength(0);
    expect(record(await f.confirm('meter_record_usage',a)).confirmed).toBe(true);
    const e=f.calls.find(c=>c.name==='event.create');
    expect(e.p).toMatchObject({event_name:'meter_usage',identifier:a.identifier,
      payload:{stripe_customer_id:a.customerId,value:'42'}});
    await expect(f.confirm('meter_record_usage',{...a,identifier:'bad'}))
      .rejects.toThrow(/stable unique/);
    expect(f.calls.filter(x=>x.name==='event.create')).toHaveLength(1);
    expect(f.db.claimMeterUsageEvent).toHaveBeenCalledOnce();
    expect(f.db.confirmMeterUsageEvent).toHaveBeenCalledOnce();
    f.meters.get('mtr_ABC123').status='inactive';
    await expect(f.confirm('meter_record_usage',a)).rejects.toThrow(/Inactive/);
  });
  it('handles alert create and lifecycle, including irreversible archive',async()=>{
    const f=fixture(),a={title:'Requests',meterId:'mtr_ABC123',threshold:100};
    expect(record(await f.confirm('alert_create',a)).confirmed).toBe(true);
    expect(record(await f.confirm('alert_deactivate',{alertId:'alrt_NEW123'}))
      .confirmed).toBe(true);
    expect(record(await f.confirm('alert_activate',{alertId:'alrt_NEW123'}))
      .confirmed).toBe(true);
    expect(record(await f.confirm('alert_archive',{alertId:'alrt_NEW123'}))
      .confirmed).toBe(true);
    expect(f.alerts.get('alrt_NEW123').status).toBe('archived');
    await expect(f.confirm('alert_activate',{alertId:'alrt_NEW123'}))
      .rejects.toThrow(/prior lifecycle/);
  });
  it('classifies grants as financial money-out and requires owner reserve/settlement',async()=>{
    const f=fixture(),a={customerId:'cus_ABC123',amountCents:5000,
      currency:'usd',category:'promotional'};
    expect(record(await f.run('credit_create_grant',{...a,dryRun:true})).done)
      .toBe(false);
    expect(f.calls).toHaveLength(0);
    expect(record(await f.confirm('credit_create_grant',a)).confirmed).toBe(true);
    expect(f.db.requestMoneyApproval).toHaveBeenCalledOnce();
    expect(f.db.reserveMoneyOut).toHaveBeenCalledOnce();
    expect(f.db.settleMoneyReservation).toHaveBeenCalledOnce();
    expect(f.calls.find(c=>c.name==='credit.create').p.amount)
      .toEqual({type:'monetary',monetary:{currency:'usd',value:5000}});
    expect(record(await f.confirm('credit_void_grant',{grantId:'credgr_NEW123'}))
      .confirmed).toBe(true);
    expect(f.db.consumeApprovedMoneyChange).toHaveBeenCalledOnce();
    const exactVoid=f.db.requestMoneyApproval.mock.calls.at(-1)[0];
    expect(exactVoid.target).toBe('credgr_NEW123');
    expect(exactVoid.description).toContain('credgr_NEW123');
    expect(f.db.consumeApprovedMoneyChange.mock.calls[0][0].target).toBe('credgr_NEW123');
    await expect(f.confirm('credit_void_grant',{grantId:'credgr_NEW123'}))
      .rejects.toThrow(/already voided/);
  });
  it('rejects a declined independent financial approval without provider mutation',async()=>{
    const f=fixture(),a={customerId:'cus_ABC123',amountCents:500,
      currency:'usd',category:'promotional'};
    f.db.reserveMoneyOut.mockResolvedValueOnce({decision:'owner_approval_required'});
    const denial=record(await f.confirm('credit_create_grant',a));
    expect(denial.done).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
  it('leaves uncertain usage claims permanently reserved instead of resending',async()=>{
    const f=fixture(),a={meterId:'mtr_ABC123',customerId:'cus_ABC123',
      units:2,identifier:'uncertain-usage-001'};
    f.sdk.billing.meterEvents.create.mockRejectedValueOnce(new Error('network uncertain'));
    expect(record(await f.confirm('meter_record_usage',a)).done).toBe(false);
    expect(record(await f.confirm('meter_record_usage',a)).done).toBe(false);
    expect(f.sdk.billing.meterEvents.create).toHaveBeenCalledOnce();
    expect(f.db.confirmMeterUsageEvent).not.toHaveBeenCalled();
  });
  it('refuses changing alerts scoped to a profiled application customer',async()=>{
    const f=fixture({appOwned:true});
    f.alerts.get('alrt_ABC123').usage_threshold.filters=[
      {type:'customer',customer:'cus_ABC123'}];
    await expect(f.confirm('alert_deactivate',{alertId:'alrt_ABC123'}))
      .rejects.toThrow(/Application-owned/);
    await expect(f.confirm('alert_create',{meterId:'mtr_ABC123',
      title:'App restricted',threshold:10,customerId:'cus_ABC123'}))
      .rejects.toThrow(/Application-owned/);
    expect(f.calls).toHaveLength(0);
  });
  it('refuses financial void without independently authenticated approval',async()=>{
    const f=fixture();
    f.db.consumeApprovedMoneyChange.mockResolvedValueOnce(false);
    const denied=record(await f.confirm('credit_void_grant',{grantId:'credgr_ABC123'}));
    expect(denied.done).toBe(false);
    expect(f.sdk.billing.creditGrants.voidGrant).not.toHaveBeenCalled();
  });
  it('rejects mixed provider mode and disallows LIVE writes without owner grant',async()=>{
    const mismatch=fixture({mode:'test',providerMode:'live'});
    expect((await mismatch.run('meter_list')).isError).toBe(true);
    expect((await mismatch.run('credit_list_grants')).isError).toBe(true);
    const notGranted=fixture({mode:'live',providerMode:'live',grant:false});
    const result=record(await notGranted.confirm('meter_update',{
      meterId:'mtr_ABC123',displayName:'No'}));
    expect(result.done).toBe(false);
    expect(notGranted.calls).toHaveLength(0);
    const granted=fixture({mode:'live',providerMode:'live',grant:true});
    const liveTool=registry.tools.find(t=>t.name==='credit_create_grant');
    expect(isGuardedLiveWrite(liveTool,granted.ctx.connection)).toBe(true);
    expect(record(await granted.confirm('meter_update',{
      meterId:'mtr_ABC123',displayName:'Owner'})).confirmed).toBe(true);
  });
  it('rejects stale summary periods, unknown credits and malformed payload keys',async()=>{
    const f=fixture();
    expect((await f.run('meter_list_usage_summaries',{meterId:'mtr_ABC123',
      customerId:'cus_ABC123',startTime:1760000401,endTime:1760004000})).isError)
      .toBe(true);
    await expect(f.confirm('meter_create',{displayName:'Usage',
      eventName:'usage_abc',formula:'sum',customerKey:'x',valueKey:'x'}))
      .rejects.toThrow(/must differ/);
    await expect(f.confirm('credit_void_grant',{grantId:'credgr_MISSING'}))
      .rejects.toThrow(/unavailable/);
    expect(f.calls).toEqual([]);
  });
});
