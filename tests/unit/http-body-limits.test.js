import { describe, it, expect } from 'vitest';
import { paramsOf, incomingBodyWithinLimit, MAX_HTTP_BODY_BYTES } from '../../src/core/http.js';

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
