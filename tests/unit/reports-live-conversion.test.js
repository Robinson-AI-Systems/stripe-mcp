import {describe,it,expect,vi,afterEach} from 'vitest';
import {handlers,tools} from '../../src/tools/report-run-write.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {isGuardedLiveWrite,isGuardedTestWrite,listingForConnection}
  from '../../src/core/profiles.js';
const account='acct_FAKE1234',typeId='balance.summary.1';
const args={reportType:typeId,intervalStart:1680000000,intervalEnd:1680010000};
const parse=r=>JSON.parse(r.content[0].text);
function liveFixture({typeLivemode=true,createdLivemode=true,
  readBackLivemode=true}={}){
  let created=null;const writes=[];
  let type={id:typeId,object:'reporting.report_type',livemode:typeLivemode,
    data_available_start:1670000000,data_available_end:1690000000,metadata:{}};
  const reporting={
    reportTypes:{retrieve:vi.fn(async()=>({...type}))},
    reportRuns:{
      create:vi.fn(async(p,opts)=>{writes.push({params:p,
        idempotencyKey:opts?.idempotencyKey});
        created={id:'frr_LIVE1234',object:'reporting.report_run',
          report_type:p.report_type,status:'pending',
          livemode:createdLivemode,parameters:p.parameters};
        return {...created};}),
      retrieve:vi.fn(async()=>({...created,livemode:readBackLivemode}))}};
  const provider={
    accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',
      livemode:true}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
    reporting};
  const db=createFakeDb({accounts:[{id:account,live_enabled:true,
    live_connected:true}]});
  const ctx={db,connectionId:'report-writer-live',liveAccessGranted:true,
    connection:{stripeAccount:account,mode:'live',profile:'full',
      context:'customer',rtcLiveOwnerApproved:true,
      resultScope:'reports-live'},
    services:{stripeForConnection:async()=>provider}};
  return {provider,db,ctx,writes,reporting,
    setType:x=>{type={...type,...x};}};
}
function testFixture({typeLivemode=false,readBackLivemode=false}={}){
  let created=null;const writes=[];
  let type={id:typeId,object:'reporting.report_type',livemode:typeLivemode,
    data_available_start:1670000000,data_available_end:1690000000,metadata:{}};
  const reporting={
    reportTypes:{retrieve:vi.fn(async()=>({...type}))},
    reportRuns:{
      create:vi.fn(async(p,opts)=>{writes.push({params:p,
        idempotencyKey:opts?.idempotencyKey});
        created={id:'frr_TEST1234',object:'reporting.report_run',
          report_type:p.report_type,status:'pending',livemode:false,
          parameters:p.parameters};
        return {...created};}),
      retrieve:vi.fn(async()=>({...created,livemode:readBackLivemode}))}};
  const db=createFakeDb({accounts:[{id:account,
    money_limit_cents:10000}]});
  const ctx={db,connectionId:'report-writer-test',
    connection:{stripeAccount:account,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>({reporting})}};
  return {ctx,writes,reporting};
}
describe('owner-obedience V2 Reports: dispatcher admission delta',()=>{
  it('admits exactly report_run in LIVE, for the owner-approved full connection only',()=>{
    const areaWrites=registry.tools.filter(t=>t.area==='reports'&&t.writes);
    expect(areaWrites.map(t=>t.name)).toEqual(['report_run']);
    expect(tools).toHaveLength(1);
    const run=areaWrites[0];
    const owner={mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0};
    expect(isGuardedLiveWrite(run,owner)).toBe(true);
    expect(isGuardedLiveWrite(run,{...owner,rtcLiveOwnerApproved:false}))
      .toBe(false);
    expect(isGuardedLiveWrite(run,{...owner,profile:'everyday'})).toBe(false);
    expect(isGuardedLiveWrite(run,{...owner,profile:'read_only'})).toBe(false);
    expect(isGuardedTestWrite(run,{mode:'test',profile:'full'})).toBe(true);
    expect(listingForConnection(registry,owner).some(t=>t.name==='report_run'))
      .toBe(true);
    // The report reads are not writes: the LIVE admission of the area
    // does not surface them as guarded writes in either mode.
    for(const read of registry.tools.filter(t=>t.area==='reports'&&!t.writes)){
      expect(isGuardedLiveWrite(read,owner)).toBe(false);
      expect(isGuardedTestWrite(read,{mode:'test',profile:'full'})).toBe(false);
    }
  });
});
describe('owner-obedience V2 Reports: LIVE report runs',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it('preview discloses type, interval and real figures; fingerprint confirm creates exactly once, reported as pending — never finished',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveFixture(),a={...args,requestKey:'live-run'};
    const preview=parse(await handlers.report_run({...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain(typeId);
    expect(preview.preview).toContain('1680000000');
    expect(preview.preview).toContain('real figures');
    expect(preview.preview).toContain('not that CSV data is ready');
    expect(preview.previewFingerprint)
      .toMatch(/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    expect(f.writes).toHaveLength(0);
    const done=parse(await handlers.report_run({...a,confirm:true,
      previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true,
      runId:'frr_LIVE1234',reportStatus:'pending',reportCompleted:false,
      downloadUrl:null});
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].idempotencyKey).toMatch(/^rmcp_report_run_/);
    expect(JSON.stringify(done)).not.toMatch(/https?:\/\//);
  });
  it('a drifted confirmation refuses with the fresh fingerprint and executes nothing; the fresh fingerprint then confirms',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveFixture(),a={...args,requestKey:'live-drift'};
    const preview=parse(await handlers.report_run({...a,dryRun:true},f.ctx));
    f.setType({data_available_end:1690000001});
    const refused=parse(await handlers.report_run({...a,confirm:true,
      previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(refused.done).toBe(false);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(f.writes).toHaveLength(0);
    const done=parse(await handlers.report_run({...a,confirm:true,
      previewFingerprint:refused.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.writes).toHaveLength(1);
  });
  it('a fabricated fingerprint refuses and executes nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveFixture();
    const refused=parse(await handlers.report_run({...args,confirm:true,
      requestKey:'live-fake',previewFingerprint:'WRITE-00000-00000-00000-00000'},
      f.ctx));
    expect(refused.done).toBe(false);
    expect(f.writes).toHaveLength(0);
  });
  it('a report type whose window is TEST refuses on a LIVE connection, and a type outside the available window refuses before any write',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const wrongMode=liveFixture({typeLivemode:false});
    await expect(handlers.report_run({...args,confirm:true,
      requestKey:'live-wrong-type'},wrongMode.ctx)).rejects.toThrow();
    expect(wrongMode.writes).toHaveLength(0);
    const windowed=liveFixture();
    windowed.setType({data_available_end:1679999999});
    await expect(handlers.report_run({...args,confirm:true,
      requestKey:'live-window'},windowed.ctx)).rejects.toThrow(
      /available period cannot be verified/);
    expect(windowed.writes).toHaveLength(0);
    const premium=liveFixture();
    await expect(handlers.report_run({...args,
      reportType:'identity.private.1',confirm:true,
      requestKey:'live-premium'},premium.ctx)).rejects.toThrow();
    expect(premium.writes).toHaveLength(0);
  });
  it('a wrong-mode created run is never claimed, and a wrong-mode read-back stays unconfirmed',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const created=liveFixture({createdLivemode:false});
    const unclaimed=parse(await handlers.report_run({...args,confirm:true,
      requestKey:'live-created-wrong'},created.ctx));
    expect(unclaimed.done).toBe(false);
    expect(unclaimed.confirmed).toBe(false);
    expect(unclaimed).not.toHaveProperty('runId');
    expect(created.writes).toHaveLength(1);
    const readBack=liveFixture({readBackLivemode:false});
    const unconfirmed=parse(await handlers.report_run({...args,confirm:true,
      requestKey:'live-readback-wrong'},readBack.ctx));
    expect(unconfirmed.confirmed).not.toBe(true);
    expect(unconfirmed.done).not.toBe(true);
  });
  it('wrong-mode objects refuse in the TEST direction too: a LIVE-mode type or read-back on a TEST connection never confirms',async()=>{
    const wrongType=testFixture({typeLivemode:true});
    await expect(handlers.report_run({...args,confirm:true,
      requestKey:'test-wrong-type'},wrongType.ctx)).rejects.toThrow();
    expect(wrongType.writes).toHaveLength(0);
    const wrongReadBack=testFixture({readBackLivemode:true});
    const unconfirmed=parse(await handlers.report_run({...args,confirm:true,
      requestKey:'test-readback-wrong'},wrongReadBack.ctx));
    expect(unconfirmed.confirmed).not.toBe(true);
    expect(unconfirmed.done).not.toBe(true);
    expect(wrongReadBack.writes).toHaveLength(1);
  });
});
