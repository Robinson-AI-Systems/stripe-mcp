import {describe,it,expect} from 'vitest';
import Stripe from 'stripe';
import {isGlobalForwardAddress,parseForwardUrl,resolveForwardTarget,
  signTestStripeEvent} from '../../src/dev/forwarder-security.js';

const safe='https://hooks.example.org/stripe/events';
const answer=(...ips)=>async()=>ips.map(ip=>({
  address:ip,family:ip.includes(':')?6:4
}));
describe('V-4a SSRF-safe TEST webhook prereqs',()=>{
  it.each([
    'https://127.0.0.1/events','https://169.254.169.254/latest',
    'https://[::1]/events','https://2130706433/events',
    'https://internal.local/stripe','https://localhost/events',
    'https://router.internal/events','https://api.example.test/events',
    'http://hooks.example.org/events',
    'https://user:password@hooks.example.org/events',
    'https://hooks.example.org:8443/events',
    'https://hooks.example.org/events?api_key=secret',
    'https://hooks.example.org/events#secret',
    'https://hooks.example.org\\@127.0.0.1/events'
  ])('rejects unsafe URL %s before DNS lookup',bad=>{
    expect(()=>parseForwardUrl(bad)).toThrow();
  });
  it('canonicalizes safe hostname and accepts an ordinary webhook path',()=>{
    expect(parseForwardUrl('https://Hooks.Example.Org/stripe/events')).toEqual({
      url:safe,hostname:'hooks.example.org'
    });
  });
  it.each([
    '0.0.0.1','10.2.3.4','100.64.22.1','127.0.0.1',
    '169.254.169.254','172.16.1.1','192.168.3.2','192.0.2.2',
    '198.18.0.1','198.51.100.4','203.0.113.2','224.0.0.1',
    '255.255.255.255','::1','fe80::1','fc00::1',
    '2001:db8::1','2002:c0a8:101::1','::ffff:127.0.0.1'
  ])('refuses non-global resolved IP %s',ip=>{
    expect(isGlobalForwardAddress(ip)).toBe(false);
  });
  it.each(['8.8.8.8','1.1.1.1','2606:4700:4700::1111',
    '2001:4860:4860::8888'])('accepts genuinely global IP %s',ip=>{
    expect(isGlobalForwardAddress(ip)).toBe(true);
  });
  it('rejects mixed DNS answers even if first address is public',async()=>{
    await expect(resolveForwardTarget(safe,{
      lookup:answer('8.8.8.8','10.1.2.3')
    })).rejects.toThrow(/private|reserved/);
    await expect(resolveForwardTarget(safe,{
      lookup:answer('2606:4700:4700::1111','::ffff:192.168.0.1')
    })).rejects.toThrow(/private|reserved/);
  });
  it('pins only a verified global IP and never sends an HTTP request',async()=>{
    let calls=0;
    const pinned=await resolveForwardTarget(safe,{lookup:async(host,opts)=>{
      calls++;expect(host).toBe('hooks.example.org');
      expect(opts).toMatchObject({all:true});
      return [{address:'2606:4700:4700::1111',family:6}];
    }});
    expect(calls).toBe(1);
    expect(pinned).toMatchObject({url:safe,hostname:'hooks.example.org',
      address:'2606:4700:4700::1111',family:6,port:443});
    expect(Object.isFrozen(pinned)).toBe(true);
  });
  it('rejects missing or invalid DNS resolution instead of guessing',async()=>{
    for(const lookup of [
      async()=>[],async()=>[{address:'garbage',family:4}],
      async()=>[{address:'8.8.8.8',family:6}],
      async()=>{throw Error('DNS unavailable');}
    ])await expect(resolveForwardTarget(safe,{lookup})).rejects.toThrow();
  });
});

describe('V-4a authentic Stripe TEST webhook signature',()=>{
  const event={object:'event',id:'evt_FAKE123',
    livemode:false,type:'customer.created',
    data:{object:{object:'customer',id:'cus_FAKE123'}}};
  const secret='whsec_test_webhook_signing_secret_FAKE123';
  it('signs exact JSON bytes, verified by pinned official Stripe constructEvent',()=>{
    const signed=signTestStripeEvent(event,secret);
    const stripe=new Stripe(['sk','test','FAKEFAKEFAKEFAKE'].join('_'));
    const parsed=stripe.webhooks.constructEvent(signed.body,signed.signature,secret);
    expect(parsed).toMatchObject({id:'evt_FAKE123',type:'customer.created',
      livemode:false});
    expect(signed.contentType).toBe('application/json');
    expect(signed).not.toHaveProperty('secret');
    expect(signed.signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });
  it('detects payload or signature tampering, not silently treating delivery as Stripe',()=>{
    const signed=signTestStripeEvent(event,secret);
    const stripe=new Stripe(['sk','test','FAKEFAKEFAKEFAKE'].join('_'));
    expect(()=>stripe.webhooks.constructEvent(
      signed.body.replace('customer.created','charge.refunded'),
      signed.signature,secret)).toThrow();
    expect(()=>stripe.webhooks.constructEvent(signed.body,signed.signature,
      'whsec_another_test_webhook_signing_secret_FAKE')).toThrow();
  });
  it('refuses LIVE, invalid secret, oversized or malformed TEST events',()=>{
    expect(()=>signTestStripeEvent({...event,livemode:true},secret)).toThrow();
    expect(()=>signTestStripeEvent(event,'not-a-secret')).toThrow();
    expect(()=>signTestStripeEvent({...event,data:{object:{
      value:'x'.repeat(300000)}}},secret)).toThrow();
    expect(()=>signTestStripeEvent({...event,id:'bad'},secret)).toThrow();
    expect(()=>signTestStripeEvent(event,secret,Infinity)).toThrow();
  });
});
