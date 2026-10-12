import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createRtcReadOnlyHttpHandler} from '../../src/core/rtc-http.js';

const account='acct_TESTCORRUPTPASS';
const token='rtc_pass_'+randomBytes(32).toString('base64url');
function request(){return {method:'GET',headers:{authorization:'Bearer '+token}};}
function response(){return {statusCode:200,body:null,headers:{},
  setHeader(key,value){this.headers[key]=value;return this;},
  status(value){this.statusCode=value;return this;},
  send(json){this.body=JSON.parse(json);return this;}};}
async function makeFixture(){
  const db=createFakeDb({accounts:[{id:account}]});
  await db.saveTestKey({account,label:'TEST',ciphertext:'v1.fake',
    kind:'restricted',last4:'FAKE'});
  await db.createRtcReadOnlyPass({id:'rtc-agent-corruptpass123',account,token,
    expiresAt:new Date(Date.now()+60*60*1000)});
  const pass=await db.getRtcPassStatus(token);
  return {db,pass,registry:{tools:[],handlers:{}}};
}
async function checkStatus(fixture,overrides){
  const {db,pass,registry}=fixture;
  const tampered={...db,async getRtcPassStatus(){return {...pass,...overrides};}};
  const res=response();
  await createRtcReadOnlyHttpHandler({db:tampered,registry})(request(),res,'whoami');
  return res;
}
describe('RTC corrupted pass claim isolation',()=>{
  it('preserves valid one-hour TEST read-only passes',async()=>{
    const fixture=await makeFixture();
    const r=await checkStatus(fixture,{});
    expect(r.statusCode).toBe(200);
    expect(r.body.result).toMatchObject({mode:'test',profile:'read_only',
      moneyLimitCents:0,allowWrites:false});
  });
  it('fails closed on corrupt or impossible expiry timestamps',async()=>{
    const fixture=await makeFixture();
    for(const expires_at of [null,'broken',Number.NaN,
      new Date(Date.now()+365*24*60*60*1000),
      new Date(Date.now()-10)]){
      const r=await checkStatus(fixture,{expires_at});
      expect(r.statusCode).toBe(401);
      expect(r.body.error.code).toBe('pass_expired');
    }
  });
  it('never coerces missing money limits to zero',async()=>{
    const fixture=await makeFixture();
    for(const money_limit_cents of [null,undefined,false,'0']){
      const r=await checkStatus(fixture,{money_limit_cents});
      expect(r.statusCode).toBe(403);
      expect(r.body.error.code).toBe('refused_by_guard');
    }
  });
  it('requires stored integer rate limits, not coerced string or boolean',async()=>{
    const fixture=await makeFixture();
    for(const rate_limit_per_minute of [true,'120',null,undefined,601,0]){
      const r=await checkStatus(fixture,{rate_limit_per_minute});
      expect(r.statusCode).toBe(403);
      expect(r.body.error.code).toBe('refused_by_guard');
    }
  });
});

describe('RTC corrupt pass identity and scoped result ownership',()=>{
  it('refuses missing/malformed identity fields before authenticated reads',async()=>{
    const fixture=await makeFixture();
    for(const fields of [
      {client_id:null},{client_id:'connector-client'},
      {stripe_account:'acct_other-with-dash'},
      {result_scope:null},{result_scope:'not-a-uuid'}
    ]){
      const response=await checkStatus(fixture,fields);
      expect(response.statusCode).toBe(403);
      expect(response.body.error.code).toBe('refused_by_guard');
    }
  });
  it('returns an auth challenge when the stored pass is expired',async()=>{
    const response=await checkStatus(await makeFixture(),
      {expires_at:new Date(Date.now()-1000)});
    expect(response.statusCode).toBe(401);
    expect(response.headers['WWW-Authenticate']).toContain('invalid_token');
  });
});
