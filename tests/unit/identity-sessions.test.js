import {describe,it,expect,vi} from 'vitest';
import {identitySafe,makeIdentityCreate,tools,handlers}
  from '../../src/tools/identity-sessions.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='vs_FAKE1234';
const secret='PRIVATE_CLIENT_SECRET_SENTINEL';
const url='https://verify.stripe.com/start/verified-test-link';
const parse=r=>JSON.parse(r.content[0].text);
const source={id,object:'identity.verification_session',livemode:false,
  created:1695680197,status:'requires_input',type:'document',url,
  client_secret:secret,verified_outputs:{first_name:'PRIVATE_NAME_SENTINEL'},
  last_verification_report:'vr_SECRET123',metadata:{private:'SECRET_PERSON'},
  redaction:null};
function fixture({state=source,badReadback=false}={}){
  let record=structuredClone(state);
  const s={identity:{verificationSessions:{
    list:vi.fn(async()=>({data:[record],has_more:false})),
    retrieve:vi.fn(async()=>badReadback?{...record,url:'https://evil.test/capture'}:record),
    create:vi.fn(async(a)=>{record={...record,type:a.type};return record;})}}};
  const db=createFakeDb(),ctx={db,connectionId:'identity-fixture',
    connection:{mode:'test',profile:'full',stripeAccount:'acct_FAKE1234',
      resultScope:'identity-scope'},
    services:{stripeForConnection:async()=>s}};
  return {s,db,ctx,create:a=>makeIdentityCreate().handler(a,ctx),
    read:(name,args)=>handlers[name](args,ctx)};
}
describe('G-3d TEST Identity private session reads and guarded hosted creation',()=>{
  it('registers two full-only readers and one guarded full-only writer',()=>{
    expect(tools.map(t=>t.name)).toEqual([
      'identity_list_sessions','identity_get_session','identity_create_session']);
    expect(tools.slice(0,2).every(t=>t.writes===false)).toBe(true);
    expect(tools[2]).toMatchObject({writes:true,writeContract:'defineWrite-v1'});
    for(const t of tools)expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
  });
  it('safe projection never displays client_secret, document, report or private metadata',()=>{
    expect(identitySafe(source)).toMatchObject({id,type:'document',
      status:'requires_input',actionRequired:true});
    expect(JSON.stringify(identitySafe(source))).not.toMatch(/PRIVATE|SECRET|client_secret/);
    expect(()=>identitySafe({...source,livemode:true})).toThrow();
    expect(()=>identitySafe({...source,redaction:{status:'unknown'}})).toThrow();
  });
  it('read list/get route to actual provider with bounded pagination and safe text',async()=>{
    const f=fixture();
    const list=parse(await f.read('identity_list_sessions',{limit:2}));
    expect(list.data).toHaveLength(1);
    expect(f.s.identity.verificationSessions.list).toHaveBeenCalledWith({limit:2});
    const get=parse(await f.read('identity_get_session',{sessionId:id}));
    expect(get.id).toBe(id);
    expect(JSON.stringify([list,get])).not.toMatch(/PRIVATE|SECRET|client_secret/);
    expect((await f.read('identity_get_session',{sessionId:'vs_BAD'})).isError).toBe(true);
  });
  it('create requires preview/confirm, returns only selected safe TEST hosted URL after read-back',async()=>{
    const f=fixture(),a={type:'document',requestKey:'one-test'};
    const preview=parse(await f.create({...a,dryRun:true}));
    expect(preview.preview).toContain('TEST ONLY');
    expect(preview).not.toHaveProperty('verificationUrl');
    expect(parse(await f.create(a)).needsConfirmation).toBe(true);
    expect(f.s.identity.verificationSessions.create).not.toHaveBeenCalled();
    const confirmed=parse(await f.create({...a,confirm:true}));
    expect(confirmed).toMatchObject({done:true,confirmed:true,
      sessionId:id,verificationUrl:url});
    expect(f.s.identity.verificationSessions.create).toHaveBeenCalledWith({
      type:'document'},{idempotencyKey:expect.any(String)});
    expect(JSON.stringify(confirmed)).not.toMatch(/PRIVATE|SECRET|client_secret/);
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toMatch(/PRIVATE|SECRET|client_secret/);
  });
  it('unsafe hosted destination and provider drift remain uncertain, no URL leaked',async()=>{
    const f=fixture({badReadback:true});
    const denied=parse(await f.create({type:'document',confirm:true}));
    expect(denied.confirmed).toBe(false);
    expect(denied).not.toHaveProperty('verificationUrl');
    const extra=fixture();
    await expect(extra.create({type:'document',returnUrl:'https://evil.test',
      confirm:true})).rejects.toThrow();
  });
  it('LIVE/read_only and indirect profile gates deny all writes',async()=>{
    const f=fixture();
    for(const name of ['identity_list_sessions','identity_get_session','identity_create_session']){
      const args=name==='identity_get_session'?{sessionId:id}:
        name==='identity_create_session'?{type:'document',confirm:true}:{};
      const blocked=await dispatchReadOnlyTool({registry,name,args,db:f.db,
        connection:{...f.ctx.connection,profile:'read_only'},services:f.ctx.services});
      expect(blocked.isError).toBe(true);
    }
    const live=await handlers.identity_create_session({type:'document',confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    expect(f.s.identity.verificationSessions.create).not.toHaveBeenCalled();
  });
});
