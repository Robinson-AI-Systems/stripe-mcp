import {describe,expect,it} from 'vitest';
import ownerSetup from '../../api/stripe/setup.js';
import {incomingBodyWithinLimit,MAX_HTTP_BODY_BYTES} from '../../src/core/http.js';

function response(){
  return {statusCode:200,headers:{},body:'',
    setHeader(k,v){this.headers[k]=v;return this;},
    status(v){this.statusCode=v;return this;},
    send(v){this.body=v;return this;}};
}
async function invoke(method,body,headers={},rawBody){
  const res=response();
  await ownerSetup({method,body,headers,rawBody},res);
  return res;
}
describe('original Stripe owner HTTP preflight',()=>{
  it('denies oversized owner POSTs without querying a database',async()=>{
    const res=await invoke('POST','x',{
      'content-type':'application/x-www-form-urlencoded',
      'content-length':String(MAX_HTTP_BODY_BYTES+1)});
    expect(res.statusCode).toBe(413);
    expect(res.body).toContain('invalid_owner_request');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('denies inconsistent or malformed request length before schema startup',async()=>{
    for(const [body,length] of [['a=1','2'],['a=1','not-a-number']]){
      const res=await invoke('POST',body,{
        'content-type':'application/x-www-form-urlencoded','content-length':length});
      expect(res.statusCode).toBe(413);
    }
    const noOriginal=await invoke('POST',{action:'run-test-smoke'},{
      'content-type':'application/json'});
    expect(noOriginal.statusCode).toBe(413);
  });
  it('denies unsupported methods and POST content types',async()=>{
    const method=await invoke('DELETE',null);
    expect(method.statusCode).toBe(405);
    expect(method.headers.Allow).toBe('GET, POST');
    const contentType=await invoke('POST','csrf=x',{
      'content-type':'text/plain','content-length':'6'});
    expect(contentType.statusCode).toBe(415);
  });
  it('retains the legitimate small form and original length consistency',()=>{
    const raw='csrf=abc&action=run-test-smoke';
    const req={method:'POST',body:raw,rawBody:raw,headers:{
      'content-type':'application/x-www-form-urlencoded',
      'content-length':String(Buffer.byteLength(raw))
    }};
    expect(incomingBodyWithinLimit(req)).toBe(true);
    expect(incomingBodyWithinLimit({...req,rawBody:raw+'x'})).toBe(false);
  });
});
