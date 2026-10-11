import {describe,it,expect,vi} from 'vitest';
import {makeEvidenceUpload,tools,handlers} from '../../src/tools/evidence-upload.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_FAKE123',id='file_FAKEEVIDENCE';
const filename='evidence.pdf',sourceUrl='https://public.example.com/document.pdf';
const bytes=Buffer.from('%PDF-1.7\nfixture');
const payload={buffer:bytes,size:bytes.length,extension:'pdf',mime:'application/pdf'};
const parse=r=>JSON.parse(r.content[0].text);
function fixture(download=vi.fn(async()=>payload)){
  const file={object:'file',id,purpose:'dispute_evidence',
    filename,size:bytes.length,livemode:false};
  const s={accounts:{retrieve:vi.fn(async()=>({object:'account',id:account,livemode:false}))},
    files:{create:vi.fn(async()=>file),retrieve:vi.fn(async()=>file)}};
  const ctx={connection:{mode:'test',stripeAccount:account,profile:'everyday'},
    db:createFakeDb(),services:{stripeForConnection:async()=>s}};
  const tool=makeEvidenceUpload({download});
  return {s,ctx,download,call:(a)=>tool.handler(a,ctx)};
}
describe('G-2b2 guarded TEST-only evidence import',()=>{
  it('registers exactly one write, accessible only for write profiles',()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({name:'file_upload_evidence',writes:true,
      writeContract:'defineWrite-v1'});
    expect(tools[0].profiles).not.toContain('read_only');
    expect(registry.tools.filter(x=>x.name==='file_upload_evidence')).toHaveLength(1);
  });
  it('preview never downloads source and completed upload returns only file ID',async()=>{
    const f=fixture();
    const args={sourceUrl,filename,requestKey:'test-only'};
    const preview=parse(await f.call({...args,dryRun:true}));
    expect(preview.preview).toContain('public.example.com');
    expect(preview.preview).not.toContain('document.pdf');
    expect(f.download).not.toHaveBeenCalled();
    const result=parse(await f.call({...args,confirm:true}));
    expect(result).toMatchObject({confirmed:true,done:true,fileId:id,
      purpose:'dispute_evidence',sizeBytes:bytes.length,evidenceSubmitted:false,
      contentsUrl:null});
    expect(f.s.files.create).toHaveBeenCalledWith({
      purpose:'dispute_evidence',
      file:{data:bytes,name:filename,type:'application/pdf'}
    },{idempotencyKey:expect.stringMatching(/^rmcp_file_upload_evidence_/)});
    expect(f.s.files.retrieve).toHaveBeenCalledWith(id);
    expect(JSON.stringify(result)).not.toContain('https://public.example.com');
    expect(JSON.stringify(result)).not.toContain('%PDF');
  });
  it('fails closed on mismatched bytes/type and unverified account and file',async()=>{
    const wrong=fixture(vi.fn(async()=>({...payload,extension:'png'})));
    const uncertain=parse(await wrong.call({sourceUrl,filename,confirm:true}));
    expect(uncertain.confirmed).toBe(false);
    expect(wrong.s.files.create).not.toHaveBeenCalled();
    const foreign=fixture();
    foreign.s.accounts.retrieve.mockResolvedValue({object:'account',id:'acct_FOREIGN'});
    await expect(foreign.call({sourceUrl,filename,dryRun:true})).rejects.toThrow();
    const wrongFile=fixture();
    wrongFile.s.files.retrieve.mockResolvedValue({object:'file',id,purpose:'identity_document',
      size:bytes.length,filename});
    expect(parse(await wrongFile.call({sourceUrl,filename,confirm:true})).confirmed).toBe(false);
  });
  it('rejects bad extensions and LIVE invocation without source access',async()=>{
    const f=fixture();
    await expect(f.call({sourceUrl,filename:'evidence.exe'})).rejects.toThrow();
    const denied=await handlers.file_upload_evidence({sourceUrl,filename,confirm:true},
      {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(denied.isError).toBe(true);
    expect(f.download).not.toHaveBeenCalled();
  });
});
