import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {APP_SEED,APPLIANCE_DESK_SOURCE,validateProfile,resolveAppRecordLink}
  from '../../src/apps/profiles.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {findAppOwnership,annotateAppRead,protectAppOwnedTarget}
  from '../../src/tools/app-guard.js';
const account='acct_PROFILE123',other='acct_OTHERAPP123';
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const db=createFakeDb({accounts:[{id:account,label:'App fixture'},
    {id:other,label:'Other app fixture'}]});
  const sdk={accounts:{async retrieve(id){return {id,object:'account',livemode:false}}}};
  const connection={stripeAccount:account,profile:'full',mode:'test'};
  const ctx={db,connection,connectionId:'app-profile-test',
    services:{stripeForConnection:async()=>sdk}};
  const call=(name,a={})=>registry.handlers[name](a,ctx);
  return {db,ctx,call};
}
describe('P-1 seeded profile and checked application contract',()=>{
  it('traces every seed metadata key and all seven events to the approved app-needs doc',()=>{
    const doc=readFileSync(APPLIANCE_DESK_SOURCE,'utf8');
    for(const key of APP_SEED.metadata_keys)expect(doc).toContain(key);
    for(const event of APP_SEED.webhook_events)expect(doc).toContain(event);
    expect(APP_SEED.metadata_keys).toHaveLength(14);
    expect(APP_SEED.webhook_events).toHaveLength(7);
    expect(APP_SEED.stripe_accounts).toEqual([]);
    expect(APP_SEED.owns_catalog).toBe(true);
    expect(APP_SEED.owns_tax_rates).toBe(true);
    expect(APP_SEED.portal_rules.allow_cancel).toBe(false);
    expect(APP_SEED.portal_rules.allow_plan_switch).toBe(false);
    expect(APP_SEED.needs_rows).toHaveLength(21);
    expect(APP_SEED.record_links.agreementId.detail).toBe('/desk/agreements/{value}');
    expect(APP_SEED.record_links.customerId.detail).toBe('/desk/customers/{value}');
  });
  it('refuses unknown metadata fields, unsafe origins, dangerous record paths or duplicate bindings',()=>{
    expect(()=>validateProfile({...APP_SEED,unknownField:42})).toThrow();
    expect(()=>validateProfile({...APP_SEED,base_url:'http://insecure.example'})).toThrow();
    expect(()=>validateProfile({...APP_SEED,stripe_accounts:[account,account]})).toThrow();
    expect(()=>validateProfile({...APP_SEED,record_links:{
      ...APP_SEED.record_links,agreementId:{landing:'//evil.example'}}})).toThrow();
    expect(()=>validateProfile({...APP_SEED,webhook_events:['made.up','made.up']})).toThrow();
  });
  it('preserves prior global B-3 denial before scope migration',async()=>{
    const f=fixture();
    const legacy=await findAppOwnership({id:'sub_rental',
      metadata:{agreementId:'agr_123'}},f.ctx);
    expect(legacy).toMatchObject({app:APP_SEED.name,
      recordLink:{url:'https://robinsonappliancerentals.com/desk/agreements/agr_123'}});
    expect(await f.db.getAppGuardScope(account)).toBe('legacy');
  });
  it('only claims apps explicitly bound on a switched account',async()=>{
    const f=fixture();
    expect(await f.db.listKnownAppsForAccount(account)).toEqual([]);
    const unbound=await f.db.enableScopedAppGuard({account});
    expect(unbound).toBe('scoped');
    expect(await findAppOwnership({id:'sub_unknown',
      metadata:{agreementId:'agr_456'}},f.ctx)).toBeNull();
    await f.db.bindKnownAppAccount({id:APP_SEED.id,account,
      expectedVersion:1,attach:true});
    const marker=await findAppOwnership({id:'sub_owned',
      metadata:{agreementId:'agr_456'}},f.ctx);
    expect(marker).toMatchObject({appId:APP_SEED.id,recordId:'sub_owned',
      value:'agr_456',via:'object'});
    const unrelated={...f.ctx,connection:{...f.ctx.connection,stripeAccount:other}};
    expect((await findAppOwnership({id:'sub_other',
      metadata:{agreementId:'agr_456'}},unrelated)).app).toBe(APP_SEED.name);
    await f.db.enableScopedAppGuard({account:other});
    expect(await findAppOwnership({id:'sub_other',
      metadata:{agreementId:'agr_456'}},unrelated)).toBeNull();
  });
  it('reports exact owning app for two profiles and refuses ambiguous markers',async()=>{
    const f=fixture();
    const another={...APP_SEED,id:'second-app',name:'Second Business',
      metadata_keys:['externalAppOrder'],record_links:{externalAppOrder:{
        landing:'/desk/orders'}},stripe_accounts:[account]};
    await f.db.seedTestAppProfile(another);
    await f.db.bindKnownAppAccount({id:'appliance-desk',account,
      expectedVersion:1,attach:true});
    await f.db.enableScopedAppGuard({account});
    const otherMarker=await findAppOwnership({id:'pi_other',
      metadata:{externalAppOrder:'order_22'}},f.ctx);
    expect(otherMarker.app).toBe('Second Business');
    const ambiguous=await findAppOwnership({id:'pi_both',
      metadata:{externalAppOrder:'order_22',agreementId:'agr_2'}},f.ctx);
    expect(ambiguous.unknown).toBe(true);
    expect(await protectAppOwnedTarget({outsideApp:true},f.ctx,{
      id:'pi_both',metadata:{externalAppOrder:'order_22',agreementId:'agr_2'}}))
      .toMatch(/must be reconciled/);
  });
  it('fails closed when profile lookup is unavailable or corrupt',async()=>{
    const f=fixture();
    f.ctx.db.listKnownAppsForAccount=async()=>{throw Error('offline')};
    const uncertain=await findAppOwnership({id:'pi_maybe',metadata:{}},f.ctx);
    expect(uncertain.unknown).toBe(true);
    expect(uncertain.reason).toMatch(/registry unavailable/);
  });
});
describe('P-2 usable owner app links, not unverified authority',()=>{
  it('creates only verified app route patterns and encodes safe detail identifiers',()=>{
    const marker={key:'agreementId',value:'agr_19'};
    expect(resolveAppRecordLink(APP_SEED,marker)).toEqual({
      app:APP_SEED.name,
      url:'https://robinsonappliancerentals.com/desk/agreements/agr_19',
      route:'/desk/agreements/agr_19',deepLink:true,
      metadataKey:'agreementId',source:'profile_route',verifiedAppRecord:false
    });
    expect(resolveAppRecordLink(APP_SEED,{
      key:'agreementId',value:'../../admin'})).toMatchObject({
      route:'/desk/agreements',deepLink:false});
    expect(resolveAppRecordLink(APP_SEED,{
      key:'rdf_record_id',value:'record_22'})).toMatchObject({
      route:'/desk/sales-tax/delivery-fees',deepLink:false});
    expect(resolveAppRecordLink(APP_SEED,{
      key:'unknownKey',value:'abc'})).toBeNull();
  });
  it('adds links only to records actually matching an application marker',async()=>{
    const f=fixture();
    await f.db.bindKnownAppAccount({id:APP_SEED.id,account,
      expectedVersion:1,attach:true});
    await f.db.enableScopedAppGuard({account});
    const original={id:'sub_app',metadata:{agreementId:'agr_99'}};
    const annotated=await annotateAppRead(original,f.ctx);
    expect(annotated.appRecord.recordLink).toMatchObject({
      route:'/desk/agreements/agr_99',source:'profile_route',
      verifiedAppRecord:false});
    expect(original).not.toHaveProperty('appRecord');
    expect(await annotateAppRead({id:'sub_plain',metadata:{}},f.ctx))
      .toEqual({id:'sub_plain',metadata:{}});
  });
  it('exposes owner views and exact guarded TEST assignment, not silent scope activation',async()=>{
    const f=fixture();
    const before=parse(await f.call('project_list_profiles'));
    expect(before.scope).toBe('legacy');
    expect(before.profiles.find(x=>x.id==='appliance-desk')).toMatchObject({
      version:1,boundToSelected:false,metadataKeys:14,webhookEvents:7});
    const dry=parse(await f.call('project_bind_profile_account',{
      app:'appliance-desk',expectedVersion:1,attach:true,dryRun:true}));
    expect(dry.done).toBe(false);
    expect((await f.db.getKnownApp('appliance-desk')).version).toBe(1);
    const assigned=parse(await f.call('project_bind_profile_account',{
      app:'appliance-desk',expectedVersion:1,attach:true,
      confirm:true,requestKey:'bind-app-profile'}));
    expect(assigned.done).toBe(true);
    expect((await f.db.getKnownApp('appliance-desk')).version).toBe(2);
    expect(await f.db.getAppGuardScope(account)).toBe('legacy');
    const link=parse(await f.call('project_record_link',{
      app:'appliance-desk',metadataKey:'agreementId',value:'agr_123'}));
    expect(link.url).toBe('https://robinsonappliancerentals.com/desk/agreements/agr_123');
    expect(link.verifiedAppRecord).toBe(false);
    const scope=parse(await f.call('project_enable_scoped_ownership',{
      acknowledgeScope:true,confirm:true,requestKey:'enable-scoped-guard'}));
    expect(scope.done).toBe(true);
    expect(await f.db.getAppGuardScope(account)).toBe('scoped');
  });
  it('refuses LIVE, invalid scope approval and unbound record links',async()=>{
    const f=fixture();
    const noLink=await f.call('project_record_link',{
      app:'appliance-desk',metadataKey:'agreementId',value:'agr_21'});
    expect(noLink.isError).toBe(true);
    const failScope=await f.call('project_enable_scoped_ownership',{
      acknowledgeScope:false,confirm:true});
    expect(failScope.isError).toBe(true);
    await expect(registry.handlers.project_bind_profile_account({
      app:'appliance-desk',expectedVersion:1,attach:true,confirm:true
    },{...f.ctx,connection:{...f.ctx.connection,mode:'live'}}))
      .resolves.toMatchObject({isError:true});
    expect(await f.db.getAppGuardScope(account)).toBe('legacy');
  });
});
