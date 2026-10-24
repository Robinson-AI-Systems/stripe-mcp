import {describe,it,expect} from 'vitest';
import {CREDENTIAL_TYPES,CREDENTIAL_TYPE_SOURCES,
  documentedCredentialRequirements,assessCredentialContext}
  from '../../src/stripe/credential-context.js';

const op={method:'GET',path:'/v2/core/accounts'};
const principal={tenantId:'tenant_1',identityId:'person_1',
  membershipRevision:4,membershipActive:true};
const selected={account:'acct_Example',mode:'test'};
const grant={kind:'account_restricted',tenantId:'tenant_1',
  identityId:'person_1',membershipRevision:4,host:'api.stripe.com',
  providerAccount:'acct_Example',mode:'test',
  fingerprint:'ciphertext-fingerprint',identityVerified:true,
  accountVerified:true,providerGrantVerified:true};
const check=(g=grant,s=selected,p=principal)=>
  assessCredentialContext({operation:op,principal:p,selection:s,grant:g,now:1000});

describe('provider credential context source evidence',()=>{
  it('provides provider-linked, operation-by-operation UNKNOWN requirements',()=>{
    const r=documentedCredentialRequirements(op);
    expect(Object.keys(r)).toEqual(CREDENTIAL_TYPES);
    for(const [kind,v] of Object.entries(r)){
      expect(v.disposition).toBe('unknown');
      expect(v.providerExecution).toBe('not-observed');
      expect(v.providerSource).toBe(CREDENTIAL_TYPE_SOURCES[kind].source);
    }
    expect(r.organization_secret.requiredHeader).toContain('Stripe-Context');
    expect(r.connect_oauth.requiredHeader).toContain('OAuth access token deprecated');
    expect(()=>documentedCredentialRequirements({method:'GET',path:'/internal'})).toThrow();
  });
  it('allows only context candidates, never provider execution',()=>{
    expect(check()).toMatchObject({status:'context-candidate-only',
      canExecute:false,providerPermission:'not-verified'});
    for(const kind of ['account_secret','stripe_app_oauth']){
      expect(check({...grant,kind}).canExecute).toBe(false);
    }
  });
  it('rejects every unverified or foreign user, tenant, key and mode',()=>{
    const cases=[
      [grant,selected,{...principal,membershipActive:false}],
      [grant,selected,{...principal,identityId:'other'}],
      [{...grant,tenantId:'other'},selected,principal],
      [{...grant,membershipRevision:3},selected,principal],
      [grant,{...selected,account:'acct_Foreign'},principal],
      [grant,{...selected,mode:'live'},principal],
      [{...grant,host:'other.host'},selected,principal],
      [{...grant,revoked:true},selected,principal],
      [{...grant,expiresAt:'1970-01-01T00:00:00.000Z'},selected,principal],
      [{...grant,providerGrantVerified:false},selected,principal],
      [{...grant,fingerprint:''},selected,principal],
      [{...grant,rawToken:'private'},selected,principal],
      [grant,{...selected,connectedAccount:'acct_Other'},principal],
    ];
    for(const [g,s,p] of cases){
      expect(check(g,s,p)).toMatchObject({status:'denied-context',canExecute:false});
    }
  });
  it('requires server-verified Connect platform and exact selected target',()=>{
    const g={...grant,kind:'connect_oauth',providerAccount:'acct_Connected',
      platformAccount:'acct_Platform',connectedAccount:'acct_Connected',
      approvedResources:['acct_Platform/acct_Connected']};
    const s={account:'acct_Connected',mode:'test',
      platformAccount:'acct_Platform',connectedAccount:'acct_Connected'};
    expect(check(g,s).status).toBe('context-candidate-only');
    expect(check(g,{...s,platformAccount:'acct_Other'}).status).toBe('denied-context');
    expect(check({...g,approvedResources:[]},s).status).toBe('denied-context');
  });
  it('requires exact organization Stripe-Context and provider account',()=>{
    const g={...grant,kind:'organization_secret',orgId:'org_Example',
      verifiedContexts:['acct_Example','acct_Platform/acct_Example']};
    const s={...selected,organizationContext:'acct_Example'};
    expect(check(g,s).status).toBe('context-candidate-only');
    expect(check(g,{...s,organizationContext:'acct_Another'}).status).toBe('denied-context');
    expect(check(g,{...s,platformAccount:'acct_Platform',
      organizationContext:'acct_Platform/acct_Example'}).status).toBe('context-candidate-only');
    expect(check({...g,verifiedContexts:[]},s).status).toBe('denied-context');
  });
  it('does not process unknown operations or credential kinds',()=>{
    expect(assessCredentialContext({operation:{method:'GET',path:'https://example.org'},
      principal,selection:selected,grant}).status).toBe('denied-context');
    expect(check({...grant,kind:'unknown'}).status).toBe('denied-context');
  });
});
