import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {requireMcpToken} from '../../src/core/mcp-auth.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery}
  from '../../test/helpers/pg-neon-adapter.js';

const account='acct_OAUTHWIRE';
const otherAccount='acct_OAUTHOTHER';
const origin='https://stripe-auth.example.test';
const connector=randomBytes(32).toString('base64url');
const rtcPass='rtc_pass_'+randomBytes(32).toString('base64url');
const refresh=randomBytes(32).toString('base64url');
const rotated=randomBytes(32).toString('base64url');
const nextRefresh=randomBytes(32).toString('base64url');
const client='oauth-wire-client';
let db,server,host;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,test_key_enc) VALUES($1,$2,$3),($4,$5,$6)',
    [account,'OAuth TEST','v1.fake',otherAccount,'Other TEST','v1.fake']);
  await db.createAccessToken({accessToken:connector,refreshToken:refresh,clientId:client,
    stripeAccount:account,mode:'test',profile:'read_only',listing:'compact'});
  expect(await db.createRtcReadOnlyPass({id:'rtc-agent-oauthwire',
    account:otherAccount,token:rtcPass,areas:['server'],
    expiresAt:new Date(Date.now()+3600000)})).toBe(true);
  server=createServer(async(req,res)=>{
    res.status=n=>{res.statusCode=n;return res;};
    res.send=value=>{res.end(value);return res;};
    try{
      const allowed=await requireMcpToken(req,res,db,{PUBLIC_BASE_URL:origin});
      if(allowed&&!res.writableEnded){
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({authorized:true,account:allowed.stripeAccount,
          mode:allowed.mode,profile:allowed.profile,listing:allowed.listing,
          client:allowed.clientId}));
      }
    }catch{
      if(!res.writableEnded){res.statusCode=503;res.end('{}');}
    }
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  host='http://127.0.0.1:'+server.address().port;
});
afterAll(async()=>{
  if(server)await new Promise((done,fail)=>server.close(e=>e?fail(e):done()));
  await closeIsolatedSchema();
});
async function call(authorization){
  const reply=await fetch(host+'/api/mcp',{headers:authorization?{authorization}:{},redirect:'manual'});
  return {status:reply.status,body:await reply.json(),
    challenge:reply.headers.get('www-authenticate')};
}
describe('real PostgreSQL and localhost HTTP MCP connector bearer boundary',()=>{
  it('accepts legitimate case-insensitive bearer schemes, keeps exact account and scope',async()=>{
    for(const scheme of ['Bearer','bearer','BEARER','bEaReR']){
      const observed=await call(scheme+' '+connector);
      expect(observed.status).toBe(200);
      expect(observed.body).toMatchObject({authorized:true,account,
        mode:'test',profile:'read_only',listing:'compact',client});
      expect(JSON.stringify(observed.body)).not.toContain(connector);
    }
  });
  it('refuses RTC pass on connector route, malformed bearer and unknown connector',async()=>{
    for(const authorization of [
      'Bearer '+rtcPass,'Bearer '+connector.slice(0,-1)+'X',
      'Basic '+connector,'Bearer '+connector+' other',
      'Bearer\n'+connector
    ]){
      const observed=await call(authorization);
      expect(observed.status).toBe(401);
      expect(observed.challenge).toContain('Bearer resource_metadata=');
      expect(JSON.stringify(observed.body)).not.toContain(connector);
      expect(JSON.stringify(observed.body)).not.toContain(rtcPass);
    }
    expect((await call(null)).status).toBe(401);
  });
  it('retains TEST read_only account and profile through atomic refresh and revocation',async()=>{
    const before=await db.getAccessToken(connector);
    expect(before).toMatchObject({stripe_account:account,mode:'test',
      profile:'read_only',listing:'compact',kind:'connector'});
    expect(await db.rotateRefreshToken({refreshToken:refresh,clientId:client,
      accessToken:rotated,newRefreshToken:nextRefresh})).toMatchObject({
        stripe_account:account,mode:'test',profile:'read_only',listing:'compact'});
    expect((await call('Bearer '+connector)).status).toBe(401);
    expect((await call('bearer '+rotated)).body).toMatchObject({
      account,mode:'test',profile:'read_only',listing:'compact'});
    expect(await db.rotateRefreshToken({refreshToken:refresh,clientId:client,
      accessToken:'replayed',newRefreshToken:'replay-secret'})).toBeNull();
    expect(await db.revokeAccessToken(rotated)).toBe(true);
    expect((await call('Bearer '+rotated)).status).toBe(401);
    expect((await call('Bearer '+rtcPass)).status).toBe(401);
    expect(await db.getTokenByRefreshToken(nextRefresh)).toBeNull();
  });
});
