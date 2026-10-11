import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/file-reads.js';
import {registry} from '../../src/tools/index.js';
const id='file_FAKE1234';
const safe={object:'file',id,purpose:'dispute_evidence',created:1680203749,
  size:1024,type:'pdf',filename:'evidence.pdf',
  url:'https://files.stripe.com/private-secret',
  links:{data:[{url:'https://secret.example.test'}]},
  account_number:'secret number'};
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const api={files:{list:vi.fn(async()=>({data:[safe],has_more:false})),
    retrieve:vi.fn(async()=>safe)}};
  const ctx={connection:{stripeAccount:'acct_FAKE123',mode:'test',profile:'read_only'},
    services:{stripeForConnection:async()=>api}};
  return {api,ctx,call:(n,a)=>handlers[n](a,ctx)};
}
describe('G-2b1 protected Stripe file metadata',()=>{
  it('registers read-only file list/get',()=>{
    expect(tools.map(t=>t.name)).toEqual(['file_list','file_get']);
    for(const t of tools)expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
  });
  it('lists only exact evidence purpose and omits private URLs',async()=>{
    const f=fixture();
    const result=parse(await f.call('file_list',{purpose:'dispute_evidence',limit:5}));
    expect(f.api.files.list).toHaveBeenCalledWith({purpose:'dispute_evidence',limit:5});
    expect(result.data[0]).toMatchObject({id,purpose:'dispute_evidence',
      sizeBytes:1024,contentsUrl:null,publicUrl:null});
    const s=JSON.stringify(result);
    for(const secret of ['files.stripe.com','secret.example','secret number'])
      expect(s).not.toContain(secret);
    expect(parse(await f.call('file_get',{fileId:id})).id).toBe(id);
  });
  it('refuses unknown purposes, LIVE, and mismatched provider objects',async()=>{
    const f=fixture();
    expect((await f.call('file_list',{purpose:'identity_document'})).isError).toBe(true);
    expect((await f.call('file_get',{fileId:'bad'})).isError).toBe(true);
    expect((await handlers.file_get({fileId:id},{...f.ctx,
      connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    f.api.files.retrieve.mockResolvedValue({...safe,id:'file_OTHER'});
    expect((await f.call('file_get',{fileId:id})).isError).toBe(true);
    f.api.files.list.mockResolvedValue({data:[{...safe,purpose:'identity_document'}],has_more:false});
    expect((await f.call('file_list',{purpose:'dispute_evidence'})).isError).toBe(true);
  });
});
