import {describe,it,expect} from 'vitest';
import {explainEffectiveAccess,sourceAccessForProfile}
  from '../../src/core/effective-access.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';

const account={id:'acct_Example',label:'Verified test account',
  live_enabled:false,live_connected:false,test_key_kind:'restricted'};
const selected={stripeAccount:'acct_Example',mode:'test',profile:'full',
  listing:'catalog',rtcLiveOwnerApproved:false,moneyLimitCents:0};
const inspect=(toolName,connection=selected,compare=true)=>
  explainEffectiveAccess({registry,connection,account,toolName,
    includeProfiles:compare});
const db={getStripeAccount:async id=>id===account.id?account:null};
const run=(name,args={},connection=selected)=>
  dispatchReadOnlyTool({registry,name,args,connection,db});

describe('CAP-2 effective current-authority and recovery',()=>{
  it('exposes ordinary Full TEST guarded writes without requiring God Mode',()=>{
    const full=inspect('product_create');
    expect(full).toMatchObject({status:'explained',selectedProfile:'full',
      source:{state:'source-candidate-only',sourceEligible:true},
      changedGrants:false,ranProviderCall:false});
    expect(full.source.providerPermission).toBe('not-verified');
    expect(full.comparison.find(x=>x.profile==='read_only').sourceCandidate).toBe(false);
    expect(full.comparison.find(x=>x.profile==='full').sourceCandidate).toBe(true);
    expect(full.recovery.some(x=>x.layer==='provider-grant-not-proven')).toBe(true);
  });
  it('reports actual refusal for read-only, never widens an existing grant',()=>{
    const read={...selected,profile:'read_only'};
    const status=inspect('product_create',read);
    expect(status.source.sourceEligible).toBe(false);
    expect(status.source.sourceReasons).toContain('user-read-only');
    expect(status.recovery.some(x=>x.layer==='chosen-profile')).toBe(true);
    expect(status.comparison.find(x=>x.profile==='full').sourceCandidate).toBe(true);
    expect(read.profile).toBe('read_only');
    expect(status.issuedProviderCredential).toBe(false);
  });
  it('does not claim LIVE write access from Full profile, matching key or toggle',()=>{
    const live={...selected,mode:'live',rtcLiveOwnerApproved:false};
    const status=inspect('product_create',live);
    expect(status.source.sourceEligible).toBe(false);
    expect(status.source.sourceReasons).toContain('independent-live-write-consent-missing');
    expect(status.source.providerPermission).toBe('not-verified');
    expect(status.comparison.every(x=>!x.sourceCandidate)).toBe(true);
    const right={...account,live_enabled:true,live_connected:true};
    const widened=sourceAccessForProfile({registry,connection:{...live,rtcLiveOwnerApproved:true},
      account:right,toolName:'product_create',profile:'full'});
    expect(widened.source.providerPermission).toBe('not-verified');
    expect(widened.ownerApproval).toBe(undefined);
  });
  it('refuses missing/foreign account, bad profile, nonexistent handler and arbitrary tools',()=>{
    expect(explainEffectiveAccess({registry,connection:selected,account:{id:'acct_Other'},
      toolName:'product_create'}).status).toBe('denied');
    expect(inspect('some_nonexistent_tool').status).toBe('unavailable');
    expect(sourceAccessForProfile({registry,connection:selected,account,
      toolName:'product_create',profile:'bogus'}).sourceEligible).toBe(false);
    const broken={tools:[...registry.tools],handlers:{...registry.handlers}};
    delete broken.handlers.product_create;
    expect(explainEffectiveAccess({registry:broken,connection:selected,account,
      toolName:'product_create'}).status).toBe('unavailable');
  });
  it('direct MCP call returns bounded verified-account-only explanation',async()=>{
    const response=await run('stripe_explain_access',{tool:'product_create',compareProfiles:true});
    expect(response.isError).not.toBe(true);
    const out=JSON.parse(response.content[0].text);
    expect(out.status).toBe('explained');
    expect(out.selectedStripeAccount).toBe(account.id);
    expect(out.source.providerExecution).toBe('not-performed');
    expect(Buffer.byteLength(response.content[0].text)).toBeLessThan(8192);
    expect(JSON.stringify(out)).not.toMatch(/sk_test_|rk_test_|access_token/);
  });
  it('indirect stripe_call keeps the exact same permission and read-only behavior',async()=>{
    const read={...selected,profile:'read_only'};
    const direct=await run('stripe_explain_access',{tool:'product_create'},read);
    const indirect=await run('stripe_call',{
      name:'stripe_explain_access',args:{tool:'product_create'}},read);
    expect(indirect.isError).not.toBe(true);
    expect(JSON.parse(indirect.content[0].text).source).toEqual(
      JSON.parse(direct.content[0].text).source);
    const write=await run('product_create',{},read);
    expect(write.isError).toBe(true);
  });
  it('does not allow account selection, injection or adding a mode through args',async()=>{
    expect((await run('stripe_explain_access',{
      tool:'product_create',account:'acct_Foreign'})).isError).toBe(true);
    expect((await run('stripe_explain_access',{tool:'a.b'})).isError).toBe(true);
    const missing=await dispatchReadOnlyTool({registry,
      name:'stripe_explain_access',args:{tool:'product_create'},
      connection:selected,db:{getStripeAccount:async()=>null}});
    expect(missing.isError).toBe(true);
  });
});
