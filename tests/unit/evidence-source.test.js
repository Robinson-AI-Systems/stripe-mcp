import {describe,it,expect,vi} from 'vitest';
import {parseEvidenceUrl,publicIpv4,evidenceType,downloadEvidence,
  MAX_EVIDENCE_BYTES} from '../../src/stripe/evidence-source.js';
const pdf=Buffer.from('%PDF-1.7\nfixture');
const makeBody=(bytes=pdf,headers={})=>({
  statusCode:200,headers:{'content-length':String(bytes.length),...headers},
  destroy:vi.fn(),async *[Symbol.asyncIterator](){yield bytes;}
});
describe('G-2b2 secure public evidence source',()=>{
  it('allows only HTTPS public host names; normalizes shared Drive links',()=>{
    expect(parseEvidenceUrl('https://public.example.com/path/file.pdf').hostname).toBe('public.example.com');
    const u=parseEvidenceUrl('https://drive.google.com/file/d/1234567890ABCDEFG/view');
    expect(u.href).toContain('export=download&id=1234567890ABCDEFG');
    for(const url of ['http://public.example.com/a','https://user:pass@public.example.com/a',
      'https://localhost/a','https://127.0.0.1/a','https://[::1]/a',
      'https://public.example.com:8443/a','https://public.example.com/#secret',
      'https://public.example.com/a\nHeader:injected']){
      expect(()=>parseEvidenceUrl(url)).toThrow();
    }
  });
  it('pins only publicly routable IPv4 and refuses RFC1918/link-local/test-nets',()=>{
    expect(publicIpv4('8.8.8.8')).toBe(true);
    for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254',
      '172.16.0.1','100.64.0.1','192.0.0.8','198.18.0.1',
      '203.0.113.3','::1'])expect(publicIpv4(ip)).toBe(false);
  });
  it('accepts only signature-verified PDF, PNG or JPEG',()=>{
    expect(evidenceType(pdf).extension).toBe('pdf');
    expect(evidenceType(Buffer.from([137,80,78,71,13,10,26,10,1])).extension).toBe('png');
    expect(evidenceType(Buffer.from([255,216,255,220,1,2,3,4])).extension).toBe('jpg');
    expect(()=>evidenceType(Buffer.from('<html>bad content</html>'))).toThrow();
  });
  it('checks DNS, pins address and bounds full byte count before returning',async()=>{
    const resolveHost=vi.fn(async()=>[{family:4,address:'8.8.8.8'}]);
    const request=vi.fn(async()=>makeBody());
    const result=await downloadEvidence('https://public.example.com/doc.pdf',
      {resolveHost,request});
    expect(result.buffer.equals(pdf)).toBe(true);
    expect(result.size).toBe(pdf.length);
    expect(resolveHost).toHaveBeenCalledWith('public.example.com',{family:4,all:true});
    expect(request.mock.calls[0][1]).toBe('8.8.8.8');
  });
  it('rejects private DNS rebinding, oversized response, HTML, and wrong length',async()=>{
    const source='https://public.example.com/a.pdf';
    const publicResolver=async()=>[{family:4,address:'8.8.8.8'}];
    await expect(downloadEvidence(source,{
      resolveHost:async()=>[{family:4,address:'169.254.169.254'}],
      request:async()=>{throw Error('must not fetch');}
    })).rejects.toThrow();
    for(const response of [
      makeBody(pdf,{'content-length':String(MAX_EVIDENCE_BYTES+1)}),
      makeBody(Buffer.from('not PDF content'),{'content-type':'text/html'}),
      makeBody(pdf,{'content-length':'999'})
    ])await expect(downloadEvidence(source,{resolveHost:publicResolver,
      request:async()=>response})).rejects.toThrow();
  });
  it('rejects redirects into a private host and accepts a safe pinned redirect',async()=>{
    const source='https://public.example.com/a.pdf';
    const redirect={statusCode:302,headers:{location:'https://other.example.com/a.pdf'},
      destroy:vi.fn()};
    const resolveHost=vi.fn(async()=>[{family:4,address:'8.8.8.8'}]);
    const request=vi.fn().mockResolvedValueOnce(redirect).mockResolvedValueOnce(makeBody());
    expect((await downloadEvidence(source,{resolveHost,request})).size).toBe(pdf.length);
    expect(redirect.destroy).toHaveBeenCalledOnce();
    const bad={...redirect,headers:{location:'https://127.0.0.1/'}};
    await expect(downloadEvidence(source,{resolveHost,
      request:async()=>bad})).rejects.toThrow();
  });
});
