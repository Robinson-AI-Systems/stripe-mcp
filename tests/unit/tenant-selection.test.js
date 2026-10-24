import {describe,it,expect,vi} from 'vitest';
import {inspectOwnedGrant} from '../../src/tenancy/selection.js';

const identity={issuer:'https://identity.example',subject:'subject-1'};
const tenantId='tenant_11111111-1111-1111-1111-111111111111';
const principalId='person_abc';
const grant='grant_11111111-1111-1111-1111-111111111111';
const args={identity,tenantId,context:'production',revision:3,
  clientId:'chatgpt',grant,account:'acct_ABCDE',mode:'test',profile:'full',
  operation:{method:'GET',path:'/v1/customers'}};
const membership={tenant_id:tenantId,principal_id:principalId,
  context:'production',role:'owner',revision:3};
const owned={id:grant,tenant_id:tenantId,principal_id:principalId,
  context:'production',stripe_account:'acct_ABCDE',mode:'test',
  kind:'stripe_app_oauth',status:'pending_verification',membership_revision:3};
function store({member=membership,rows=[owned]}={}){
  return {getMembership:vi.fn(async()=>member),listGrants:vi.fn(async()=>rows)};
}
describe('CAP-3 offline exact tenant-owned grant choice',()=>{
  it('returns actionable provider-pending evidence without executable credentials',async()=>{
    const tenancy=store();
    const result=await inspectOwnedGrant({...args,tenancy});
    expect(result).toMatchObject({status:'needs-provider-proof',canExecute:false,
      providerPermission:'unverified',kind:'stripe_app_oauth',
      account:'acct_ABCDE',mode:'test',documentedRequirement:'unknown'});
    expect(result).not.toHaveProperty('key');
    expect(result).not.toHaveProperty('token');
    expect(tenancy.getMembership).toHaveBeenCalledOnce();
    expect(tenancy.listGrants).toHaveBeenCalledWith({
      tenantId,identity,context:'production',revision:3,
      account:'acct_ABCDE',mode:'test'});
  });
  it('does not automatically choose a broader or first matching grant',async()=>{
    const t=store({rows:[{...owned,id:'grant_22222222-2222-2222-2222-222222222222',
      kind:'account_secret',status:'verified'}]});
    const got=await inspectOwnedGrant({...args,tenancy:t});
    expect(got).toMatchObject({status:'denied',canExecute:false});
  });
  it('denies stale, foreign or inactive principal before any grant lookup',async()=>{
    for(const member of [null,{...membership,revision:4},
      {...membership,role:'untrusted'}]){
      const t=store({member});
      expect((await inspectOwnedGrant({...args,tenancy:t})).status).toBe('denied');
      expect(t.listGrants).not.toHaveBeenCalled();
    }
  });
  it('rejects wrong account, principal, mode and context even from a misbehaving store',async()=>{
    for(const row of [{...owned,tenant_id:'tenant_OTHER'},
      {...owned,principal_id:'person_OTHER'},
      {...owned,mode:'live'}, {...owned,stripe_account:'acct_OTHER'},
      {...owned,context:'development'},{...owned,membership_revision:2}]){
      const outcome=await inspectOwnedGrant({...args,tenancy:store({rows:[row]})});
      expect(outcome).toMatchObject({status:'denied',canExecute:false});
    }
  });
  it('refuses mutation under read-only profile without provider permission inference',async()=>{
    const t=store();
    const denied=await inspectOwnedGrant({...args,tenancy:t,profile:'read_only',
      operation:{method:'POST',path:'/v1/customers'}});
    expect(denied.reason).toBe('read-only-policy-refuses-mutation');
    expect(denied.canExecute).toBe(false);
  });
  it('never treats a source-proven metadata grant as an executable credential',async()=>{
    const t=store({rows:[{...owned,status:'verified',kind:'organization_secret'}]});
    const result=await inspectOwnedGrant({...args,tenancy:t});
    expect(result).toMatchObject({status:'needs-provider-proof',canExecute:false,
      providerEntitlement:'unknown',documentedRequirement:'unknown'});
  });
  it('refuses malformed operation, missing exact selection and impersonation payloads',async()=>{
    const t=store();
    for(const variant of [
      {...args,grant:null}, {...args,account:'acct_OTHER!'},
      {...args,profile:'god_mode'}, {...args,revision:0},
      {...args,operation:{method:'GET',path:'https://bad.test/foo'}}
    ]) {
      expect((await inspectOwnedGrant({...variant,tenancy:t})).canExecute).toBe(false);
    }
  });
});
