import {describe,it,expect,vi} from 'vitest';
import {makeProtectedServiceFetch}
  from '../../src/acceptance/protected-service-fetch.js';
const origin='https://stripe-owner.example.test';
const oidc='ey.'+'A'.repeat(60)+'.'+'B'.repeat(45);
const pin=()=>({origin,approvedOrigin:origin,oidcToken:oidc});
describe('owner trusted-source ingress for protected TEST acceptance',()=>{
  it('adds a private token only to exact approved HTTPS origin with redirects blocked',async()=>{
    const fetcher=vi.fn(async()=>new Response('ok',{status:200}));
    const call=makeProtectedServiceFetch({...pin(),fetcher});
    await call(origin+'/api/contract',{method:'GET'});
    await call(origin+'/api/mcp',{method:'POST',
      headers:{authorization:'Bearer '+'C'.repeat(43)}});
    expect(fetcher).toHaveBeenCalledTimes(2);
    for(const [,opts] of fetcher.mock.calls){
      expect(opts.redirect).toBe('manual');
      expect(opts.headers.get('x-vercel-trusted-oidc-idp-token')).toBe(oidc);
    }
    expect(fetcher.mock.calls[1][1].headers.get('authorization'))
      .toBe('Bearer '+'C'.repeat(43));
    expect(JSON.stringify(fetcher.mock.calls[0][0])).not.toContain(oidc);
  });
  it('never forwards trusted token to foreign origin, downgrade or embedded password',async()=>{
    const fetcher=vi.fn(async()=>new Response('ok'));
    const call=makeProtectedServiceFetch({...pin(),fetcher});
    for(const url of ['https://evil.example.test/api/mcp',
      'http://stripe-owner.example.test/api/mcp',
      'https://attacker:pass@stripe-owner.example.test/api/mcp',
      'https://stripe-owner.example.test/api/mcp#fragment',
      'http://127.0.0.1:9999/callback']){
      await expect(call(url,{method:'POST'})).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refuses invalid token bytes and mismatched pinned origin without a request',async()=>{
    const fetcher=vi.fn(async()=>new Response('ok'));
    const call=makeProtectedServiceFetch({
      ...pin(),oidcToken:'bad\nheader',fetcher});
    await expect(call(origin+'/api/contract')).rejects.toThrow();
    const wrong=makeProtectedServiceFetch({...pin(),
      approvedOrigin:'https://other.example.test',fetcher});
    await expect(wrong(origin+'/api/contract')).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not add a header or weaken redirect security without opt-in token',async()=>{
    const fetcher=vi.fn(async()=>new Response('ok'));
    const call=makeProtectedServiceFetch({origin,approvedOrigin:origin,fetcher});
    await call(origin+'/api/contract',{method:'GET'});
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
    expect(fetcher.mock.calls[0][1].headers.has('x-vercel-trusted-oidc-idp-token'))
      .toBe(false);
  });
});
