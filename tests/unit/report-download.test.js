import {describe,it,expect,vi} from 'vitest';
import {createReportDownloader,MAX_REPORT_BYTES} from '../../src/stripe/report-download.js';
const account='acct_FAKEACCOUNT',run='frr_FAKEREPORT',id='file_FAKEREPORT';
const url='https://files.stripe.com/v1/files/'+id+'/contents';
const bytes='id,amount\n1,100\n';
function fixture(overrides={}) {
  const report={object:'reporting.report_run',id:run,livemode:false,status:'succeeded',result:id};
  const file={object:'file',id,purpose:'finance_report_run',livemode:false,
    type:'csv',url,size:Buffer.byteLength(bytes)};
  const db={getStripeAccount:vi.fn(async()=>({test_connected:true}))};
  const keyStore={loadKey:vi.fn(async()=>['sk','test','FAKEKEY'].join('_'))};
  const stripe={reporting:{reportRuns:{retrieve:vi.fn(async()=>({...report,...overrides.report}))}},
    files:{retrieve:vi.fn(async()=>({...file,...overrides.file}))}};
  const fetcher=vi.fn(async()=>new Response(bytes,{headers:{'content-length':String(Buffer.byteLength(bytes))}}));
  const download=createReportDownloader({db,keyStore,makeClient:()=>stripe,fetcher});
  return {db,keyStore,stripe,fetcher,download};
}
describe('G-1g owner-only CSV transport',()=>{
  it('verifies exact TEST run/file and downloads only authenticated fixed Stripe endpoint',async()=>{
    const f=fixture();
    const result=await f.download({account,run});
    expect(result.bytes.toString()).toBe(bytes);
    expect(result.filename).toBe('stripe-report-'+run+'.csv');
    expect(f.keyStore.loadKey).toHaveBeenCalledWith({account,mode:'test'});
    expect(f.fetcher).toHaveBeenCalledOnce();
    expect(f.fetcher.mock.calls[0][0]).toBe(url);
    expect(f.fetcher.mock.calls[0][1]).toMatchObject({
      method:'GET',redirect:'error',cache:'no-store',
      headers:{Authorization:'Bearer sk_test_FAKEKEY'}});
  });
  it('rejects foreign, LIVE, pending, and other-purpose files before fetching bytes',async()=>{
    for(const overrides of [
      {report:{id:'frr_FOREIGN'}},{report:{livemode:true}},
      {report:{status:'pending'}},{report:{result:'file_OTHER'}},
      {file:{id:'file_OTHER'}},{file:{purpose:'identity_document'}},
      {file:{livemode:true}},{file:{url:'https://invalid.example/evil'}},
      {file:{type:'png'}},{file:{size:MAX_REPORT_BYTES+1}}
    ]) {
      const f=fixture(overrides);
      await expect(f.download({account,run})).rejects.toThrow();
      expect(f.fetcher).not.toHaveBeenCalled();
    }
  });
  it('requires a TEST-connected account and exact identifiers',async()=>{
    const f=fixture();
    for(const bad of [{account:'acct_bad/../',run},{account,run:'x'}])
      await expect(f.download(bad)).rejects.toThrow();
    f.db.getStripeAccount.mockResolvedValue({test_connected:false});
    await expect(f.download({account,run})).rejects.toThrow();
    expect(f.keyStore.loadKey).not.toHaveBeenCalled();
  });
  it('refuses response errors, oversize streams, mismatched length, and binary payload',async()=>{
    for(const response of [
      new Response('error',{status:403}),
      new Response(bytes,{headers:{'content-length':'999999999'}}),
      new Response('short',{headers:{'content-length':'5'}}),
      new Response('a\0'.padEnd(Buffer.byteLength(bytes),'x'))
    ]) {
      const f=fixture();
      f.fetcher.mockResolvedValue(response);
      await expect(f.download({account,run})).rejects.toThrow();
    }
  });
});
