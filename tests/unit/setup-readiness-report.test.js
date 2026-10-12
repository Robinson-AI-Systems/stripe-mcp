import {describe,it,expect} from 'vitest';
import {buildSetupReadinessReport} from '../../src/acceptance/setup-readiness-report.js';
const base={mode:'test',focus:'webhooks',source:'custom_mcp_dispatch',
  dashboardVerified:false,writeOperations:0,
  records:[{tool:'event_list',status:'observed'},{tool:'webhook_list',status:'not_readable'}]};
describe('owner TEST Setup & Readiness Report',()=>{
  it('separates native evidence, unreadable settings and delivery acceptance',()=>{
    const r=buildSetupReadinessReport(base);
    expect(r).toMatchObject({readiness:'incomplete',dashboardVerified:false,
      webhookDeliveryVerified:false,oauthVerified:false,liveEnabled:false,
      counts:{observed:1,not_readable:1,partial:0,error:0}});
    expect(r.exceptions).toHaveLength(1);
    expect(r.exceptions[0].next).toContain('Only inspect');
    expect(r.ownerAction).toContain('No configuration change');
    expect(JSON.stringify(r)).not.toContain('acct_');
  });
  it('does not pretend successful native reads verify owner settings or event delivery',()=>{
    const report=buildSetupReadinessReport({...base,records:base.records.map(v=>
      ({...v,status:'observed'}))});
    expect(report.configuredSettingsVerified).toBe(false);
    expect(report.webhookDeliveryVerified).toBe(false);
    expect(report.exceptions).toEqual([]);
  });
  it('provides targeted exceptions for errors and incomplete data',()=>{
    const report=buildSetupReadinessReport({...base,records:[
      {tool:'event_list',status:'error'}, {tool:'webhook_list',status:'partial'}]});
    expect(report.ownerAction).toContain('Retry failed');
    expect(report.exceptions.map(x=>x.status)).toEqual(['error','partial']);
  });
  it('refuses fabricated successes, unknown groups, extra keys and duplicate checks',()=>{
    const records=[
      [{tool:'event_list',status:'ok'},{tool:'webhook_list',status:'observed'}],
      [{tool:'event_list',status:'observed'},{tool:'event_list',status:'observed'}],
      [{tool:'stripe_admin_overview',status:'observed'},{tool:'webhook_list',status:'observed'}]
    ];
    for(const bad of records)expect(()=>buildSetupReadinessReport({...base,records:bad})).toThrow();
    for(const changed of [{mode:'live'},{dashboardVerified:true},{writeOperations:1},
      {source:'generic_connector'},{focus:'__proto__'},{focus:'all'}])
      expect(()=>buildSetupReadinessReport({...base,...changed})).toThrow();
  });
  it('honestly reports owner-admin not_readable and partial evidence',()=>{
    const report=buildSetupReadinessReport({...base,focus:'administration',
      records:[
        {tool:'stripe_admin_overview',status:'partial'},
        {tool:'admin_review_security',status:'partial'},
        {tool:'admin_list_guided_settings',status:'not_readable'}
      ]});
    expect(report.counts).toMatchObject({partial:2,not_readable:1});
    expect(report.configuredSettingsVerified).toBe(false);
    expect(report.exceptions).toHaveLength(3);
  });
});
