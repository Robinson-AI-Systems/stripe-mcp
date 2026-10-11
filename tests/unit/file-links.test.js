import {describe,it,expect,vi} from 'vitest';
import {makeFileLinkWrite,tools,handlers} from '../../src/tools/file-links-write.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const id='file_FAKE1234',link='link_FAKE1234';
const expiresAt=Math.floor(Date.now()/1000)+3600;
const uploaded={object:'file',id,purpose:'business_logo',size:123,
  created:1680203749,filename:'brand.png',type:'png'};
const created={object:'file_link',id:link,file:id,expires_at:expiresAt,
  expired:false,url:'https://files.stripe.com/links/FAKELINK123'};
const parse=r=>JSON.parse(r.content[0].text);
function fixture(file=uploaded,after=created){
  const stripe={files:{retrieve:vi.fn(async()=>file)},
    fileLinks:{create:vi.fn(async()=>created),retrieve:vi.fn(async()=>after)}};
  const db=createFakeDb();
  const ctx={db,connection:{mode:'test',stripeAccount:'acct_FAKE123',profile:'full'},
    services:{stripeForConnection:async()=>stripe}};
  return {stripe,db,ctx,call:(a)=>handlers.file_create_link(a,ctx)};
}
describe('G-2b1 public brand links only',()=>{
  it('declares one guarded write on full profile',()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({writes:true,name:'file_create_link',
      writeContract:'defineWrite-v1',profiles:['full']});
    expect(registry.tools.filter(x=>x.name==='file_create_link')).toHaveLength(1);
  });
  it('requires preview/confirm and independently verifies provider-created link',async()=>{
    const f=fixture();
    const preview=parse(await f.call({fileId:id,expiresAt,dryRun:true}));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain('business_logo');
    expect(f.stripe.fileLinks.create).not.toHaveBeenCalled();
    const result=parse(await f.call({fileId:id,expiresAt,confirm:true,requestKey:'fixture'}));
    expect(result).toMatchObject({confirmed:true,done:true,
      publicUrl:created.url,expiresAt});
    expect(f.stripe.fileLinks.create).toHaveBeenCalledWith({
      file:id,expires_at:expiresAt},{idempotencyKey:expect.stringMatching(/^rmcp_file_create_link_/)});
    expect(f.stripe.fileLinks.retrieve).toHaveBeenCalledWith(link);
  });
  it('will not link evidence, reports, identity documents or LIVE records',async()=>{
    for(const purpose of ['dispute_evidence','finance_report_run','identity_document']){
      const f=fixture({...uploaded,purpose});
      await expect(f.call({fileId:id,expiresAt,dryRun:true})).rejects.toThrow();
      expect(f.stripe.fileLinks.create).not.toHaveBeenCalled();
    }
    const f=fixture();
    const live=await handlers.file_create_link({fileId:id,expiresAt,confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    expect(f.stripe.fileLinks.create).not.toHaveBeenCalled();
  });
  it('will not announce success for forged link identities or an invalid target',async()=>{
    const f=fixture(uploaded,{...created,file:'file_FOREIGN'});
    const result=parse(await f.call({fileId:id,expiresAt,confirm:true}));
    expect(result.confirmed).toBe(false);
    expect(result).not.toHaveProperty('publicUrl');
  });
  it('rejects expiry outside 1 minute to 24 hours and wrong ID',async()=>{
    const f=fixture();
    for(const a of [{fileId:id,expiresAt:Math.floor(Date.now()/1000)+30},
      {fileId:id,expiresAt:Math.floor(Date.now()/1000)+90000},
      {fileId:'bad',expiresAt}]){
      await expect(f.call(a)).rejects.toThrow();
    }
  });
});
