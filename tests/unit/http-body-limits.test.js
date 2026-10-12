import { describe, it, expect } from 'vitest';
import { paramsOf, incomingBodyWithinLimit, safePreparsedObject, MAX_HTTP_BODY_BYTES } from '../../src/core/http.js';

describe('bounded pre-parsed HTTP input', () => {
  it('accepts ordinary structured POST bodies', () => {
    const data = { client_name: 'browser', redirect_uris: ['https://client.example.test/callback'] };
    expect(paramsOf({ method: 'POST', headers: {}, body: data })).toEqual(data);
  });
  it('refuses oversized, circular and unserializable bodies before DB access', () => {
    const huge = { client_name: 'x'.repeat(17000) };
    expect(() => paramsOf({ method: 'POST', headers: {}, body: huge }))
      .toThrow('Invalid request body');
    const circular = {}; circular.self = circular;
    expect(() => paramsOf({ method: 'POST', headers: {}, body: circular }))
      .toThrow('Invalid request body');
    expect(() => paramsOf({ method: 'POST', headers: {}, body: { value: 1n } }))
      .toThrow('Invalid request body');
    expect(() => paramsOf({ method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(huge) })).toThrow('Invalid request body');
  });
  it('bounds original pre-parsed transport bytes instead of normalized JSON', () => {
    const tiny = { client_name: 'ok' };
    const transport = (body, headers = {}) => ({ method: 'POST', body, headers });
    expect(incomingBodyWithinLimit(transport(tiny, { 'content-length': '3000000' }))).toBe(false);
    expect(incomingBodyWithinLimit(transport(tiny, { 'content-length': '16385' }))).toBe(false);
    expect(incomingBodyWithinLimit(transport(tiny, { 'content-length': '16384' }))).toBe(true);
    expect(incomingBodyWithinLimit(transport(tiny))).toBe(false);
    expect(incomingBodyWithinLimit(transport(tiny, { 'content-length': '-1' }))).toBe(false);
    expect(incomingBodyWithinLimit(transport(tiny, { 'content-length': '16, 16' }))).toBe(false);
    expect(incomingBodyWithinLimit(transport(tiny, { 'content-length': '99999999999999999999' }))).toBe(false);
    const raw = '{"client_name":"ok"}' + ' '.repeat(MAX_HTTP_BODY_BYTES);
    expect(incomingBodyWithinLimit({ ...transport(tiny), rawBody: raw })).toBe(false);
    expect(incomingBodyWithinLimit({ ...transport(tiny, { 'content-length': '2' }), rawBody: '{}' })).toBe(true);
    expect(incomingBodyWithinLimit({ ...transport(tiny, { 'content-length': '1' }), rawBody: '{}' })).toBe(false);
    expect(incomingBodyWithinLimit(transport(' '.repeat(MAX_HTTP_BODY_BYTES + 1)))).toBe(false);
    expect(incomingBodyWithinLimit({ method: 'GET', headers: {}, query: {} })).toBe(true);
  });
});

describe('RTC parsed JSON cannot bypass the transport cap',()=>{
  it('rejects oversized pre-parsed values even with a forged small length',()=>{
    const payload={data:'x'.repeat(MAX_HTTP_BODY_BYTES)};
    for(const length of ['2',String(MAX_HTTP_BODY_BYTES)]){
      expect(incomingBodyWithinLimit({method:'POST',headers:{'content-length':length},
        body:payload})).toBe(false);
    }
  });
  it('refuses unserializable pre-parsed JSON without a raw body',()=>{
    const circular={};circular.self=circular;
    for(const body of [circular,{value:1n}])
      expect(incomingBodyWithinLimit({method:'POST',headers:{'content-length':'2'},body}))
        .toBe(false);
    expect(incomingBodyWithinLimit({method:'POST',headers:{'content-length':'2'},
      body:{ok:true}})).toBe(true);
  });
});

describe('getter-free detached HTTP JSON', () => {
  it('rejects active getters and toJSON without invoking them', () => {
    let invocations = 0;
    const getter = {client_name:'ok'};
    Object.defineProperty(getter,'redirect_uris',{enumerable:true,
      get(){invocations++;throw Error('executed getter');}});
    const json = {client_name:'ok',toJSON(){invocations++;throw Error('executed toJSON');}};
    const nested = {args:{fields:['id']}};
    Object.defineProperty(nested.args,'id',{enumerable:true,get(){invocations++;return 'x';}});
    for(const body of [getter,json,nested]) {
      expect(incomingBodyWithinLimit({method:'POST',headers:{'content-length':'100'},body})).toBe(false);
      expect(()=>paramsOf({method:'POST',headers:{},body})).toThrow('Invalid request body');
      expect(()=>safePreparsedObject(body)).toThrow('Invalid request body');
    }
    expect(invocations).toBe(0);
  });
  it('rejects inherited toJSON, symbols, sparse arrays and exotic objects', () => {
    let invoked = 0;
    const inherited=Object.create({toJSON(){invoked++;}});
    inherited.client_name='x';
    for(const body of [inherited,{list:[,1]}, {list:new Date()},
      {list:[Symbol('no')]}, {list:{value:()=>{invoked++;}}}]) {
      expect(()=>safePreparsedObject(body)).toThrow('Invalid request body');
    }
    expect(invoked).toBe(0);
  });
  it('returns inert detached values and keeps exact raw-wire mismatch refusal', () => {
    const body={client_name:'safe',redirect_uris:['https://client.example.test/cb']};
    const cloned=safePreparsedObject(body);
    expect(cloned).toEqual(body);
    expect(cloned).not.toBe(body);
    expect(cloned.redirect_uris).not.toBe(body.redirect_uris);
    body.redirect_uris[0]='changed';
    expect(cloned.redirect_uris[0]).toBe('https://client.example.test/cb');
    expect(incomingBodyWithinLimit({method:'POST',headers:{'content-length':'2'},
      rawBody:'{}',body:cloned})).toBe(true);
    expect(incomingBodyWithinLimit({method:'POST',headers:{'content-length':'1'},
      rawBody:'{}',body:cloned})).toBe(false);
    expect(()=>safePreparsedObject({client_name:'x'.repeat(MAX_HTTP_BODY_BYTES)}))
      .toThrow('Invalid request body');
  });
});
