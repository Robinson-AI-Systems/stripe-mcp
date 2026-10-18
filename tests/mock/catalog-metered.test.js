import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},
  {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
const opts={idempotencyKey:'rmcp_e3_mock_123'};
describe('E-3 pinned stripe-mock billing meter, alert and credit-grant wire contracts',()=>{
  it('uses supported meter, summary and event paths without legacy usage records',async()=>{
    const s=sdk();
    expect((await s.billing.meters.list({limit:2})).object).toBe('list');
    expect((await s.billing.meters.retrieve('mtr_FAKE123')).object).toBe('billing.meter');
    expect((await s.billing.meters.create({
      display_name:'Usage',event_name:'unit_usage',
      default_aggregation:{formula:'sum'},
      customer_mapping:{type:'by_id',event_payload_key:'stripe_customer_id'},
      value_settings:{event_payload_key:'value'}},opts)).object).toBe('billing.meter');
    expect((await s.billing.meters.update('mtr_FAKE123',{
      display_name:'Renamed'},opts)).object).toBe('billing.meter');
    expect((await s.billing.meters.deactivate('mtr_FAKE123',{},opts))
      .object).toBe('billing.meter');
    expect((await s.billing.meters.reactivate('mtr_FAKE123',{},opts))
      .object).toBe('billing.meter');
    expect((await s.billing.meters.listEventSummaries('mtr_FAKE123',{
      customer:'cus_FAKE123',start_time:1760000400,
      end_time:1760004000,limit:2})).object).toBe('list');
    expect((await s.billing.meterEvents.create({
      event_name:'unit_usage',identifier:'usage-mock-123456',
      payload:{stripe_customer_id:'cus_FAKE123',value:'42'}},opts))
      .object).toBe('billing.meter_event');
  });
  it('uses supported usage threshold alert lifecycle paths',async()=>{
    const s=sdk();
    expect((await s.billing.alerts.list({limit:2})).object).toBe('list');
    expect((await s.billing.alerts.retrieve('alrt_FAKE123')).object).toBe('billing.alert');
    expect((await s.billing.alerts.create({
      alert_type:'usage_threshold',title:'Usage threshold',
      usage_threshold:{meter:'mtr_FAKE123',gte:10,recurrence:'one_time'}},opts))
      .object).toBe('billing.alert');
    expect((await s.billing.alerts.activate('alrt_FAKE123',{},opts))
      .object).toBe('billing.alert');
    expect((await s.billing.alerts.deactivate('alrt_FAKE123',{},opts))
      .object).toBe('billing.alert');
    expect((await s.billing.alerts.archive('alrt_FAKE123',{},opts))
      .object).toBe('billing.alert');
  });
  it('sends typed USD monetary credit grants with verified void call',async()=>{
    const s=sdk();
    expect((await s.billing.creditGrants.list({limit:2,customer:'cus_FAKE123'}))
      .object).toBe('list');
    expect((await s.billing.creditGrants.retrieve('credgr_FAKE123'))
      .object).toBe('billing.credit_grant');
    expect((await s.billing.creditGrants.create({
      customer:'cus_FAKE123',category:'promotional',
      amount:{type:'monetary',monetary:{currency:'usd',value:1000}},
      applicability_config:{scope:{price_type:'metered'}}},opts))
      .object).toBe('billing.credit_grant');
    expect((await s.billing.creditGrants.voidGrant('credgr_FAKE123',{},opts))
      .object).toBe('billing.credit_grant');
  });
});
