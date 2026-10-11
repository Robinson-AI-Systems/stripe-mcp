import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned TEST Stripe multipart dispute_evidence file create and retrieve',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const created=await s.files.create({purpose:'dispute_evidence',
    file:{data:Buffer.from('%PDF-1.7\nfixture'),name:'evidence.pdf',
      type:'application/pdf'}});
  expect(created.object).toBe('file');
  expect((await s.files.retrieve('file_FAKE1234')).object).toBe('file');
});
