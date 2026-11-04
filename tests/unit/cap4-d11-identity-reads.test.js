// CAP-4 D-11 — Identity READ tools verify every returned session
// against the connection's own mode, through the projection the V2
// Identity family already built (`identitySafe(v, mode)`). At
// baseline the two read handlers refused every non-TEST connection
// at a handler gate ('TEST Identity mode required') before any
// provider call and called the projection with no mode, so no LIVE
// session could ever be read. The frozen field set is this family's
// defining discipline: verification state and verified metadata
// only — no document images, no personal data, no access secrets,
// in either mode — pinned below by the projection's exact key set
// with sentinel document/PII/secret values in the fixtures.
// Baseline accounting (verified against a pristine checkout of
// 3b563925): the LIVE happy paths, the provider-called wrong-mode
// refusals on LIVE connections and the descriptions fail at
// baseline. The rest pass at baseline and after, by design: the
// TEST happy paths and byte-identical TEST pins (TEST behavior did
// not move), the LIVE-on-TEST refusals (already enforced at
// baseline by the projection's historical no-mode check, so the
// refusal outcome is identical), the projection field-set and
// no-mode contract pins (the projection itself is unchanged V2
// code), and the LIVE privacy assertion, which passes vacuously at
// baseline because the gate refused everything (so nothing could
// leak) and gains its meaning after conversion.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {tools,handlers,identitySafe}
  from '../../src/tools/identity-sessions.js';

const acct='acct_D11FAKE',id='vs_FAKE1234';
const parse=r=>JSON.parse(r.content[0].text);
const secret='PRIVATE_CLIENT_SECRET_SENTINEL';
const pii='PRIVATE_NAME_SENTINEL';
const docImage='PRIVATE_DOCUMENT_IMAGE_SENTINEL';
const reportId='vr_SECRET123';

const sessionBase={id,object:'identity.verification_session',
  created:1695680197,type:'document',
  url:'https://verify.stripe.com/start/verified-link',
  client_secret:secret,
  verified_outputs:{first_name:pii,last_name:pii,
    document:{front:docImage,back:docImage}},
  last_verification_report:reportId,
  metadata:{private:'SECRET_PERSON'}};
const testSession={...sessionBase,livemode:false,
  status:'requires_input',redaction:null};
const liveSession={...sessionBase,livemode:true,
  status:'verified',redaction:{status:'redacted'}};

const projectedKeys=['id','type','status','createdAt',
  'redactionStatus','actionRequired','note'];
const testProjection={id,type:'document',status:'requires_input',
  createdAt:'Sep 25, 2023, 16:16:37 MDT',redactionStatus:null,
  actionRequired:true,
  note:'Private verification evidence and access secrets are not displayed.'};
const liveProjection={id,type:'document',status:'verified',
  createdAt:'Sep 25, 2023, 16:16:37 MDT',redactionStatus:'redacted',
  actionRequired:false,
  note:'Private verification evidence and access secrets are not displayed.'};

const liveSdkParts={accounts:{retrieve:async()=>({id:acct,
    object:'account',livemode:true})},
  balance:{retrieve:async()=>({object:'balance',livemode:true})}};
function identitySdk(record,listData=[record]){
  return {...liveSdkParts,
    identity:{verificationSessions:{
      list:vi.fn(async()=>({data:listData,has_more:false})),
      retrieve:vi.fn(async()=>record)}}};
}
function testCtx(sdk){
  return {connection:{stripeAccount:acct,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
}
async function liveCtx(sdk){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,live_enabled:true,
    live_connected:true,money_limit_cents:0}]});
  return {db,connection:{stripeAccount:acct,mode:'live',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

describe('CAP-4 D-11 Identity reads verify the connection mode',()=>{
  it('serves verified TEST sessions in list and get',async()=>{
    const s=identitySdk(testSession),ctx=testCtx(s);
    const list=parse(await handlers.identity_list_sessions({limit:2},ctx));
    expect(s.identity.verificationSessions.list)
      .toHaveBeenCalledWith({limit:2});
    expect(list.data).toEqual([testProjection]);
    expect(list.has_more).toBe(false);
    expect(parse(await handlers.identity_get_session({sessionId:id},ctx)))
      .toEqual(testProjection);
  });
  it('serves verified LIVE sessions in list and get',async()=>{
    const s=identitySdk(liveSession),ctx=await liveCtx(s);
    const list=parse(await handlers.identity_list_sessions({limit:2},ctx));
    expect(s.identity.verificationSessions.list)
      .toHaveBeenCalledWith({limit:2});
    expect(list.data).toEqual([liveProjection]);
    expect(list.has_more).toBe(false);
    expect(parse(await handlers.identity_get_session({sessionId:id},ctx)))
      .toEqual(liveProjection);
  });
  it('refuses a TEST session on a LIVE connection, after the provider call',async()=>{
    const s=identitySdk(testSession),ctx=await liveCtx(s);
    const list=await handlers.identity_list_sessions({},ctx);
    expect(list.isError).toBe(true);
    expect(list.content[0].text)
      .toMatch(/Exact LIVE Identity verification session unavailable/);
    expect(s.identity.verificationSessions.list).toHaveBeenCalled();
    const get=await handlers.identity_get_session({sessionId:id},ctx);
    expect(get.isError).toBe(true);
    expect(get.content[0].text)
      .toMatch(/Exact LIVE Identity verification session unavailable/);
    expect(s.identity.verificationSessions.retrieve)
      .toHaveBeenCalledWith(id);
  });
  it('refuses a wrong-mode member inside an otherwise valid LIVE list page',async()=>{
    const s=identitySdk(liveSession,[liveSession,testSession]),
      ctx=await liveCtx(s);
    expect((await handlers.identity_list_sessions({},ctx)).isError)
      .toBe(true);
    expect(s.identity.verificationSessions.list).toHaveBeenCalled();
  });
  it('refuses a LIVE session on a TEST connection in list and get',async()=>{
    const s=identitySdk(liveSession),ctx=testCtx(s);
    const list=await handlers.identity_list_sessions({},ctx);
    expect(list.isError).toBe(true);
    expect(list.content[0].text)
      .toMatch(/Exact TEST Identity verification session unavailable/);
    const get=await handlers.identity_get_session({sessionId:id},ctx);
    expect(get.isError).toBe(true);
    expect(get.content[0].text)
      .toMatch(/Exact TEST Identity verification session unavailable/);
  });
  it('pins the frozen field set: exact projection keys in both modes',()=>{
    for(const [record,mode] of [[testSession,'test'],[liveSession,'live']]){
      const safe=identitySafe(record,mode);
      expect(Object.keys(safe)).toEqual(projectedKeys);
      const serialized=JSON.stringify(safe);
      for(const sentinel of [secret,pii,docImage,reportId,
        'client_secret','verified_outputs','last_verification_report',
        'verify.stripe.com'])
        expect(serialized).not.toContain(sentinel);
    }
  });
  it('never leaks document, PII or secret values on handler reads in either mode',async()=>{
    const testSerialized=JSON.stringify([
      await handlers.identity_list_sessions({},testCtx(identitySdk(testSession))),
      await handlers.identity_get_session({sessionId:id},
        testCtx(identitySdk(testSession)))]);
    const liveSerialized=JSON.stringify([
      await handlers.identity_list_sessions({},
        await liveCtx(identitySdk(liveSession))),
      await handlers.identity_get_session({sessionId:id},
        await liveCtx(identitySdk(liveSession)))]);
    for(const serialized of [testSerialized,liveSerialized])
      for(const sentinel of [secret,pii,docImage,reportId,'SECRET_PERSON'])
        expect(serialized).not.toContain(sentinel);
  });
  it('keeps the no-mode projection contract historical (V2 precedent)',()=>{
    expect(identitySafe(testSession)).toEqual(testProjection);
    expect(identitySafe(testSession,'test')).toEqual(testProjection);
    expect(identitySafe(liveSession,'live')).toEqual(liveProjection);
    expect(()=>identitySafe(liveSession)).toThrow(
      /Exact TEST Identity verification session unavailable/);
    expect(()=>identitySafe(liveSession,'test')).toThrow();
    expect(()=>identitySafe(testSession,'live')).toThrow(
      /Exact LIVE Identity verification session unavailable/);
  });
  it('keeps TEST list and get output byte-identical to baseline',async()=>{
    const ctx=testCtx(identitySdk(testSession));
    expect(parse(await handlers.identity_list_sessions({limit:2},ctx)))
      .toEqual({data:[testProjection],has_more:false,next:null});
    expect(parse(await handlers.identity_get_session({sessionId:id},ctx)))
      .toEqual(testProjection);
  });
  it('read descriptions name both modes; the family registers unchanged',()=>{
    const reads=tools.filter(t=>t.name.startsWith('identity_')&&!t.writes);
    expect(reads.map(t=>t.name)).toEqual([
      'identity_list_sessions','identity_get_session']);
    for(const t of reads){
      expect(t.description).toContain('TEST or LIVE');
      expect(t.writes).toBe(false);
    }
    expect(tools.map(t=>t.name)).toEqual([
      'identity_list_sessions','identity_get_session',
      'identity_create_session']);
  });
});
