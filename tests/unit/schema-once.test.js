import {describe,expect,it,vi} from 'vitest';
import {createSchemaOnce} from '../../src/core/schema-once.js';

describe('owner setup one-time additive schema initialization',()=>{
  it('runs the complete initializer once for sequential successful requests',async()=>{
    const ensure=createSchemaOnce(),init=vi.fn(async()=>true);
    expect(await ensure(init)).toBe(true);
    for(let n=0;n<15;n++)expect(await ensure(init)).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
  });
  it('waits on one in-flight initializer under concurrent owner GET and POST',async()=>{
    const ensure=createSchemaOnce();
    let release;
    const init=vi.fn(()=>new Promise(resolve=>{release=resolve;}));
    const requests=Array.from({length:25},()=>ensure(init));
    await Promise.resolve();
    expect(init).toHaveBeenCalledTimes(1);
    release('schema ready');
    expect(await Promise.all(requests)).toEqual(Array(25).fill('schema ready'));
    expect(init).toHaveBeenCalledTimes(1);
  });
  it('refuses all callers on failure then safely retries next call',async()=>{
    const ensure=createSchemaOnce(),init=vi.fn()
      .mockRejectedValueOnce(Error('schema access unavailable'))
      .mockResolvedValue('ready');
    const first=await Promise.allSettled([ensure(init),ensure(init)]);
    expect(first.every(q=>q.status==='rejected')).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
    expect(await ensure(init)).toBe('ready');
    expect(init).toHaveBeenCalledTimes(2);
    expect(await ensure(init)).toBe('ready');
    expect(init).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid initializers without consuming the schema state',async()=>{
    const ensure=createSchemaOnce();
    await expect(ensure(null)).rejects.toThrow(/required/);
    const ok=vi.fn(async()=>{});
    await ensure(ok);
    expect(ok).toHaveBeenCalledOnce();
  });
});
