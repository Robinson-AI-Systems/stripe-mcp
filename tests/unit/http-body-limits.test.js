import { describe, it, expect } from 'vitest';
import { paramsOf } from '../../src/core/http.js';

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
});
