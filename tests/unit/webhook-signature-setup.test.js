import {describe,it,expect} from 'vitest';
import {createSetupHandler} from '../../src/stripe/setup-page.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const env={PUBLIC_BASE_URL:'https://stripe.example.test',ADMIN_PASSPHRASE:'owner-test-pass'};
function res(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
  status(c){this.code=c;return this;},send(b){this.body=b;return this;},json(b){this.body=b;return this;}}}
const req=(method,body={},headers={})=>({method,query:method==='GET'?body:{},
  body,headers,socket:{remoteAddress:'192.0.2.5'}});
describe('Owner-only signature secret form',()=>{
  it('requires origin, csrf, independently verified owner password and never reflects a secret',async()=>{
    const db=createFakeDb(),calls=[];
    const handler=createSetupHandler({db,env,
      provisionWebhookSecret:async p=>{calls.push(p);return {account:p.account,endpoint:p.endpoint};}});
    const page=res();await handler(req('GET'),page);
    expect(page.body).toContain('provision-webhook-secret');
    const cookie=page.headers['Set-Cookie'].split(';')[0],csrf=cookie.split('=')[1];
    const data={action:'provision-webhook-secret',csrf,account:'acct_TEST',
      endpoint:'we_TEST',secret:'whsec_'+'Q'.repeat(40),passphrase:env.ADMIN_PASSPHRASE};
    const send=async(d,h={origin:env.PUBLIC_BASE_URL,cookie})=>{
      const response=res();await handler(req('POST',d,h),response);return response;};
    expect((await send(data,{origin:'https://other.test',cookie})).code).toBe(403);
    expect((await send({...data,csrf:'forged'})).code).toBe(403);
    expect((await send({...data,passphrase:'wrong'})).code).toBe(401);
    expect(calls).toHaveLength(0);
    const approved=await send(data);
    expect(approved.code).toBe(200);
    expect(calls).toHaveLength(1);
    expect(approved.body).not.toContain(data.secret);
  });
});
