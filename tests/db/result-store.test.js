import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery} from '../../test/helpers/pg-neon-adapter.js';

let db;
const access='X'.repeat(40),refresh='Y'.repeat(40),
  otherAccess='Z'.repeat(40),client='same-fixture-client';
const handle='res_'+'A'.repeat(24),handle2='res_'+'B'.repeat(24);
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
});
afterAll(async()=>await closeIsolatedSchema());

describe('C-1 PostgreSQL private result store',()=>{
  it('creates opaque scope per token row and preserves it through refresh, not shared client IDs',async()=>{
    await db.createAccessToken({accessToken:access,refreshToken:refresh,
      clientId:client,stripeAccount:'acct_FAKE',mode:'test',profile:'full'});
    await db.createAccessToken({accessToken:otherAccess,refreshToken:'R'.repeat(40),
      clientId:client,stripeAccount:'acct_FAKE',mode:'test',profile:'full'});
    const a=await db.getAccessToken(access);
    const b=await db.getAccessToken(otherAccess);
    expect(a.result_scope).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.result_scope).not.toBe(b.result_scope);
    await db.rotateRefreshToken({refreshToken:refresh,clientId:client,
      accessToken:'Q'.repeat(40),newRefreshToken:'P'.repeat(40)});
    expect(await db.getAccessToken(access)).toBeNull();
    expect((await db.getAccessToken('Q'.repeat(40))).result_scope).toBe(a.result_scope);
  });
  it('stores safe JSON for exactly one scoped connection and refuses cross-connection retrieval',async()=>{
    const a=(await db.getAccessToken('Q'.repeat(40))).result_scope;
    const b=(await db.getAccessToken(otherAccess)).result_scope;
    const body={pages:['{"accounts":[{"id":"acct_FAKE"}]}'],totalBytes:37};
    await db.putScopedResult({handle,connection:a,body,summary:'Safe TEST summary',
      expiresAt:new Date(Date.now()+3600000)});
    expect(await db.getScopedResult({handle,connection:b})).toBeNull();
    expect((await db.getScopedResult({handle,connection:a})).body).toEqual(body);
    await expect(db.putScopedResult({handle,connection:a,body,summary:'duplicate',
      expiresAt:new Date(Date.now()+3600000)})).rejects.toThrow();
    expect(await db.getScopedResult({handle:'res_'+'C'.repeat(24),connection:a}))
      .toBeNull();
  });
  it('rejects expired stored handles and cleans expired records in a bounded statement',async()=>{
    const scope=(await db.getAccessToken('Q'.repeat(40))).result_scope;
    const body={pages:['{"ok":true}'],totalBytes:11};
    await db.putScopedResult({handle:handle2,connection:scope,body,summary:'Expires',
      expiresAt:new Date(Date.now()+3600000)});
    await rawQuery(`UPDATE result_store SET expires_at=now()-interval '1 minute'
      WHERE handle=$1`,[handle2]);
    expect(await db.getScopedResult({handle:handle2,connection:scope})).toBeNull();
    const next='res_'+'D'.repeat(24);
    await db.putScopedResult({handle:next,connection:scope,body,summary:'Cleaned',
      expiresAt:new Date(Date.now()+3600000)});
    const rows=await rawQuery(`SELECT handle FROM result_store WHERE handle=$1`,[handle2]);
    expect(rows).toHaveLength(0);
    expect(await db.getScopedResult({handle:next,connection:scope})).not.toBeNull();
  });
});
