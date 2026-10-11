import {describe,it,expect,vi} from 'vitest';
import {makeIdentityCancel,makeIdentityRedact,tools,handlers}
  from '../../src/tools/identity-lifecycle.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='vs_FAKE1234',privateValue='PRIVATE_DOCUMENT_SENTINEL';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({status='requires_input',appOwned=false,drift=false}={}){
  let current={id,object:'identity.verification_session',livemode:false,
    created:1695680197,status,type:'document',redaction:null,
    client_secret:privateValue,verified_outputs:{name:privateValue},
    metadata:appOwned?{agreementId:'private'}:{}};
  const api={retrieve:vi.fn(async()=>drift?{...current,status:'processing'}:current),
    cancel:vi.fn(async()=>{current={...current,status:'canceled',url:null};return current;}),
    redact:vi.fn(async()=>{current={...current,status:status==='requires_input'?'canceled':status,
      redaction:{status:'processing'},url:null};return current;})};
  const db=createFakeDb(),ctx={db,connectionId:'identity-lifecycle',
    connection:{stripeAccount:'acct_FAKE1234',mode:'test',profile:'full',
      resultScope:'identity-lifecycle'},services:{stripeForConnection:async()=>({
        identity:{verificationSessions:api}})}};
  return {api,db,ctx,cancel:a=>makeIdentityCancel().handler(a,ctx),
    redact:a=>makeIdentityRedact().handler(a,ctx)};
}
describe('G-3e independent TEST-only Identity cancellation/redaction',()=>{
  it('registers distinct full-only destructive write contracts',()=>{
    expect(tools.map(t=>t.name)).toEqual(['identity_cancel_session','identity_redact_session']);
    for(const t of tools){
      expect(t).toMatchObject({writes:true,writeContract:'defineWrite-v1',safety:'C',
        profiles:['full']});
      expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
    }
  });
  it('requires preview then explicit confirm for exact input-pending cancellation',async()=>{
    const f=fixture(),args={sessionId:id,requestKey:'cancel-once'};
    expect(parse(await f.cancel({...args,dryRun:true})).preview).toContain('does not erase');
    expect(parse(await f.cancel(args)).needsConfirmation).toBe(true);
    expect(f.api.cancel).not.toHaveBeenCalled();
    expect(parse(await f.cancel({...args,confirm:true}))).toMatchObject({
      done:true,confirmed:true});
    expect(f.api.cancel).toHaveBeenCalledWith(id,{},
      {idempotencyKey:expect.stringMatching(/^rmcp_identity_cancel_session_/)});
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(privateValue);
  });
  it('redaction is separately confirmed, only observed processing (not claimed erasure)',async()=>{
    const f=fixture({status:'verified'}),args={sessionId:id,requestKey:'redact-once'};
    expect(parse(await f.redact({...args,dryRun:true})).preview)
      .toContain('NOT completed erasure');
    expect(f.api.redact).not.toHaveBeenCalled();
    expect(parse(await f.redact({...args,confirm:true}))).toMatchObject({
      done:true,confirmed:true});
    expect(f.api.redact).toHaveBeenCalledWith(id,{},
      {idempotencyKey:expect.stringMatching(/^rmcp_identity_redact_session_/)});
    await expect(handlers.identity_redact_session({sessionId:id,dryRun:true},f.ctx))
      .rejects.toThrow(/unredacted TEST Identity session/);
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(privateValue);
  });
  it('wrong statuses, wrong IDs and unknown args produce zero provider writes',async()=>{
    const canceled=fixture({status:'canceled'});
    await expect(canceled.cancel({sessionId:id,confirm:true})).rejects.toThrow();
    await expect(canceled.redact({sessionId:id,confirm:true})).rejects.toThrow();
    const processing=fixture({status:'processing'});
    await expect(processing.redact({sessionId:id,confirm:true})).rejects.toThrow();
    const wrong=fixture();
    await expect(wrong.cancel({sessionId:'vs_BAD',confirm:true})).rejects.toThrow();
    await expect(wrong.redact({sessionId:id,privateInput:privateValue,confirm:true}))
      .rejects.toThrow();
    for(const f of [canceled,processing,wrong]){
      expect(f.api.cancel).not.toHaveBeenCalled();
      expect(f.api.redact).not.toHaveBeenCalled();
    }
  });
  it('provider drift never confirms and app-owned metadata blocks mutations',async()=>{
    const f=fixture({drift:true});
    await expect(f.cancel({sessionId:id,confirm:true})).rejects.toThrow();
    const owned=fixture({appOwned:true});
    const result=parse(await owned.redact({sessionId:id,confirm:true}));
    expect(result.done).toBe(false);
    expect(owned.api.redact).not.toHaveBeenCalled();
  });
  it('LIVE, read-only profile and indirect names never mutate',async()=>{
    const f=fixture();
    for(const t of tools){
      const blocked=await dispatchReadOnlyTool({registry,name:t.name,
        args:{sessionId:id},db:f.db,connection:f.ctx.connection,
        services:f.ctx.services});
      expect(parse(blocked).needsConfirmation).toBe(true);
      const live=await handlers[t.name]({sessionId:id,confirm:true},
        {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
      expect(live.isError).toBe(true);
      const ro=await handlers[t.name]({sessionId:id,confirm:true},
        {...f.ctx,connection:{...f.ctx.connection,profile:'read_only'}});
      expect(ro.isError).toBe(true);
    }
    expect(f.api.cancel).not.toHaveBeenCalled();
    expect(f.api.redact).not.toHaveBeenCalled();
  });
});
