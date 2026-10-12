import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/admin-security.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='acct_SECURITYFIXTURE',privateValue='PRIVATE_TOKEN_AND_URL';
const parse=v=>JSON.parse(v.content[0].text);
function fixture({permissions=true,webhook=true,db=true,accountReadable=true}={}){
  const sdk={accounts:{retrieve:vi.fn(async()=>{
    if(!accountReadable)throw {statusCode:403,code:'permission_denied'};
    return {object:'account',id,livemode:false,charges_enabled:true,
      payouts_enabled:false,details_submitted:true,
      requirements:{currently_due:[],past_due:[]}};
  })},webhookEndpoints:{list:vi.fn(async()=>{
    if(!webhook)throw {statusCode:403,code:'permission_denied'};
    return {object:'list',has_more:false,data:[{object:'webhook_endpoint',
      id:'we_SEC123',status:'enabled',livemode:false,created:1790000000,
      enabled_events:['invoice.paid'],url:'https://example.com/'+privateValue}]};
  })}};
  const store={getStripeAccount:vi.fn(async()=>db?{id,
    test_key_kind:'restricted',test_key_last4:'1234',money_limit_cents:50000}:null),
    listConnectionsForAccount:vi.fn(async()=>db?[{client_id:privateValue}]:[])};
  const ctx={connection:{mode:'test',stripeAccount:id,profile:'read_only'},
    db:store,services:{stripeForConnection:async()=>sdk,
      stripePermissionReprobe:permissions?async()=>({
        account:id,mode:'test',checkedAt:1790000000,
        permissions:{charges:'read',refunds:'none',secret:privateValue}}):undefined}};
  return {sdk,store,ctx};
}
describe('G-6c TEST owner security review',()=>{
  it('registers one safe reader available to all profiles',()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0].writes).toBe(false);
    expect(registry.tools.filter(t=>t.name==='admin_review_security')).toHaveLength(1);
  });
  it('only shows masked keys, counts, safe webhook states and manual checks',async()=>{
    const f=fixture(),response=parse(await handlers.admin_review_security({},f.ctx));
    expect(response.sections.key).toMatchObject({status:'stored_metadata',
      keyLast4:'••••1234',keyAge:'not_readable'});
    expect(response.sections.connections).toMatchObject({countOnPage:1,complete:true});
    expect(response.sections.webhooks.endpoints).toEqual([{
      id:'we_SEC123',status:'enabled',enabledEventCount:1}]);
    expect(response.sections.keyPermissions.status).toBe('observed');
    expect(response.sections.twoStepLogin.status).toBe('not_readable');
    expect(response.sections.teamRoles.status).toBe('not_readable');
    expect(response.ownerChecks).toContain('apiKeyRotation');
    expect(JSON.stringify(response)).not.toContain(privateValue);
    expect(JSON.stringify(response)).not.toContain('charges');
  });
  it('does not call any write operation or infer healthy state on refused readers',async()=>{
    const f=fixture({permissions:false,webhook:false,db:false});
    const result=parse(await handlers.admin_review_security({},f.ctx));
    expect(result.sections.key.status).toBe('not_readable');
    expect(result.sections.keyPermissions.status).toBe('not_readable');
    expect(result.sections.webhooks.status).toBe('not_readable');
    expect(result.sections.twoStepLogin.observed).toBe(false);
  });
  it('does not observe webhook health if independent owner TEST identity is unreadable',async()=>{
    const f=fixture({accountReadable:false});
    const out=parse(await handlers.admin_review_security({},f.ctx));
    expect(out.sections.webhooks).toMatchObject({status:'not_readable',observed:false});
    expect(f.sdk.webhookEndpoints.list).not.toHaveBeenCalled();
    expect(out.sections.key.status).toBe('stored_metadata');
  });
  it('rejects LIVE and incorrect parameters; indirect dispatch remains read-only',async()=>{
    const f=fixture();
    expect((await handlers.admin_review_security({x:1},f.ctx)).isError).toBe(true);
    expect((await handlers.admin_review_security({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    const out=await dispatchReadOnlyTool({registry,name:'admin_review_security',
      args:{},connection:f.ctx.connection,db:f.ctx.db,services:f.ctx.services});
    expect(out.isError).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain(privateValue);
  });
});
