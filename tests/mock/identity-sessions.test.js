import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned native TEST Identity list, retrieve and create, cancel and redact SDK endpoints',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.identity.verificationSessions.list({limit:2})).object).toBe('list');
  expect((await s.identity.verificationSessions.retrieve('vs_FAKE1234')).object)
    .toBe('identity.verification_session');
  expect((await s.identity.verificationSessions.create({type:'document'},
    {idempotencyKey:'rmcp_identity_create_mock_1234'})).object)
    .toBe('identity.verification_session');
  expect((await s.identity.verificationSessions.cancel('vs_FAKE1234',{},
    {idempotencyKey:'rmcp_identity_cancel_mock_1234'})).object)
    .toBe('identity.verification_session');
  expect((await s.identity.verificationSessions.redact('vs_FAKE1234',{},
    {idempotencyKey:'rmcp_identity_redact_mock_1234'})).object)
    .toBe('identity.verification_session');
});
