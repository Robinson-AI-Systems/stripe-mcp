import {registry} from '../../src/tools/index.js';
import {describe,expect,it} from 'vitest';
import {isToolAllowed,visibleTools,profileCounts,publicToolInfo,
  isGuardedTestWrite,isGuardedLiveWrite,listingForConnection} from
  '../../src/core/profiles.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import home from '../../api/index.js';
const setup=()=>{
  let calls=0;
  return {
    registry:{tools:[
      {name:'r_all',writes:false,profiles:['read_only','everyday','full'],inputSchema:{type:'object'}},
      {name:'r_owner',writes:false,profiles:['full'],inputSchema:{type:'object'}},
      {name:'w_everyday',writes:true,profiles:['everyday','full'],inputSchema:{type:'object'}},
      {name:'w_admin',writes:true,profiles:['full'],inputSchema:{type:'object'}}
    ],handlers:{
      r_all:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      r_owner:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      w_everyday:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      w_admin:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};}
    }},
    count:()=>calls
  };
};
describe('B-6 profile metadata, name-call and homepage counts',()=>{
  it('read_only never sees money/destructive tools, even when enablement is requested',()=>{
    const {registry}=setup();
    expect(visibleTools(registry,'read_only',{allowWrites:true}).map(x=>x.name)).toEqual(['r_all']);
    expect(isToolAllowed(registry.tools[2],'read_only',{allowWrites:true})).toBe(false);
    expect(visibleTools(registry,'everyday',{allowWrites:true}).map(x=>x.name))
      .toEqual(['r_all','w_everyday']);
    expect(visibleTools(registry,'full',{allowWrites:true}).map(x=>x.name))
      .toEqual(['r_all','r_owner','w_everyday','w_admin']);
  });
  it('current MCP remains read-only even on an everyday or full connection',()=>{
    const {registry}=setup();
    expect(visibleTools(registry,'full').map(x=>x.name)).toEqual(['r_all','r_owner']);
    expect(visibleTools(registry,'everyday').map(x=>x.name)).toEqual(['r_all']);
    expect(profileCounts(registry)).toEqual({read_only:1,everyday:1,full:2});
  });
  it('refuses undeclared/invalid profiles and tools missing explicit writes metadata',()=>{
    expect(isToolAllowed({name:'unclassified',profiles:['full']},'full')).toBe(false);
    expect(isToolAllowed({name:'fake',writes:false,profiles:['full']},'admin')).toBe(false);
    expect(isToolAllowed({name:'fake',writes:false,profiles:'full'},'full')).toBe(false);
    expect(visibleTools(null,'full')).toEqual([]);
  });
  it('only TEST full owner can discover the original eight guarded composite writes',()=>{
    const names=['workflow_refund_customer','workflow_cancel_customer',
      'workflow_change_plan','workflow_dispute_kit_save',
      'workflow_webhook_health_fix','workflow_month_end_report',
      'workflow_set_up_catalog','workflow_brand_business'];
    for(const name of names){
      const t=(awaitedRegistry=>awaitedRegistry.tools.find(x=>x.name===name))(registry);
      expect(t?.writeContract).toBe('defineWrite-v1');
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'})).toBe(true);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'everyday'})).toBe(false);
      expect(isGuardedTestWrite(t,{mode:'live',profile:'full'})).toBe(false);
    }
    expect(listingForConnection(registry,{mode:'test',profile:'full',
      listing:'catalog'}).map(x=>x.name)).toEqual(expect.arrayContaining(names));
    expect(listingForConnection(registry,{mode:'test',profile:'everyday',
      listing:'catalog'}).some(x=>names.includes(x.name))).toBe(false);
    expect(isGuardedTestWrite({name:'workflow_unreviewed',
      area:'workflows',writes:true,writeContract:'defineWrite-v1',profiles:['full']},
      {mode:'test',profile:'full'})).toBe(false);
  });

  it('surfaces already-wrapped nonfinancial TEST families without delegating them to read-only or LIVE by accident',()=>{
    const areas=['money','webhooks','account','branding','catalog','reports'];
    for(const area of areas){
      const wrapped=registry.tools.filter(t=>t.area===area&&t.writes===true&&
        t.writeContract==='defineWrite-v1');
      expect(wrapped.length).toBeGreaterThan(0);
      for(const tool of wrapped){
        expect(isGuardedTestWrite(tool,{mode:'test',profile:'full'})).toBe(true);
        expect(isGuardedTestWrite(tool,{mode:'test',profile:'read_only'})).toBe(false);
        const liveAccount=new Set([
          'account_update_payment_method_settings','account_add_apple_pay_domain'
        ]);
        const liveWebhooks=new Set([
          'webhook_create','webhook_add_events','webhook_remove_events',
          'webhook_update','webhook_delete'
        ]);
        const liveCatalog=new Set([
          'product_create','product_update','product_archive','product_unarchive',
          'product_delete','price_create','price_update',
          'coupon_create','coupon_update','coupon_delete','promo_create','promo_update',
          'feature_create','feature_attach_to_product','feature_detach_from_product',
          'taxrate_create','taxrate_update',
          'meter_create','meter_update','meter_deactivate','meter_reactivate',
          'meter_record_usage','alert_create','alert_activate','alert_deactivate',
          'alert_archive','credit_create_grant','credit_void_grant',
          'tax_update_settings','tax_add_registration','tax_end_registration',
          'tax_record_transaction','tax_reverse_transaction',
          'quote_create','quote_update','quote_finalize','quote_accept','quote_cancel'
        ]);
        // Owner-obedience V2 family 1 (Money): the payout operations and
        // the payout schedule are LIVE-admitted for a funded connection;
        // the synthetic top-up fixture is not (ruling 2).
        const liveMoney=new Set([
          'money_create_payout','money_update_payout','money_cancel_payout',
          'money_reverse_payout','money_set_payout_schedule'
        ]);
        const approved=area==='account'&&liveAccount.has(tool.name)||
          area==='webhooks'&&liveWebhooks.has(tool.name)||
          area==='catalog'&&liveCatalog.has(tool.name)||
          area==='money'&&liveMoney.has(tool.name)||
          // Branding: the payout schedule's exposure converted with the
          // Money family (ruling 6); the rest of the area converted with
          // owner-obedience V2 family 11 (Branding), so every wrapped
          // branding write is now LIVE-admitted for the owner-approved
          // connection.
          area==='branding'||
          // Owner-obedience V2 family 10 (Reports): the single
          // report-run write is LIVE-admitted for an owner-approved
          // connection; the report reads are not writes and stay
          // TEST-only under CAP-4.
          (area==='reports'&&tool.name==='report_run');
        expect(isGuardedLiveWrite(tool,{mode:'live',profile:'full',
          rtcLiveOwnerApproved:true,moneyLimitCents:10000})).toBe(approved);
      }
    }
    const names=listingForConnection(registry,{mode:'test',profile:'full',
      listing:'catalog'}).map(t=>t.name);
    expect(names).toContain('webhook_add_events');
    expect(names).toContain('account_update_payment_method_settings');
  });
  it('shows a guarded LIVE operation only after separate owner LIVE delegation',()=>{
    const tool=registry.tools.find(t=>t.name==='api_write');
    const permitted={mode:'live',profile:'full',rtcLiveOwnerApproved:true,
      moneyLimitCents:0,listing:'catalog'};
    expect(isGuardedLiveWrite(tool,permitted)).toBe(true);
    expect(listingForConnection(registry,permitted).some(t=>t.name==='api_write')).toBe(true);
    expect(isGuardedLiveWrite(tool,{...permitted,rtcLiveOwnerApproved:false})).toBe(false);
    expect(listingForConnection(registry,{...permitted,rtcLiveOwnerApproved:false})
      .some(t=>t.name==='api_write')).toBe(false);
  });
  it('owner-obedience V2 Money: owner identity funds the owner connection; a zero-limit pass stays unfunded (ruling 1(b))',()=>{
    const payout=registry.tools.find(t=>t.name==='money_create_payout');
    const reversal=registry.tools.find(t=>t.name==='money_reverse_payout');
    const schedule=registry.tools.find(t=>t.name==='money_set_payout_schedule');
    const topup=registry.tools.find(t=>t.name==='money_create_topup');
    const cancelTopup=registry.tools.find(t=>t.name==='money_cancel_topup');
    // The owner's own OAuth connection, exactly as src/core/mcp-auth.js
    // builds it: grant context resolved server-side, delegated ceiling 0.
    const owner={mode:'live',profile:'full',listing:'catalog',context:'customer',
      rtcLiveOwnerApproved:true,moneyLimitCents:0};
    expect(isGuardedLiveWrite(payout,owner)).toBe(true);
    expect(isGuardedLiveWrite(reversal,owner)).toBe(true);
    expect(isGuardedLiveWrite(schedule,owner)).toBe(true);
    expect(listingForConnection(registry,owner).some(t=>t.name==='money_create_payout'))
      .toBe(true);
    // Without the owner's LIVE write consent the same connection admits nothing.
    expect(isGuardedLiveWrite(payout,{...owner,rtcLiveOwnerApproved:false})).toBe(false);
    // A delegated RTC pass, exactly as src/core/rtc-http.js builds it:
    // no grant context, its own ceiling. Zero ceiling: no money moves.
    const pass={mode:'live',profile:'full',listing:'compact',
      rtcLiveOwnerApproved:true,allowWrites:true,areas:['money'],
      moneyLimitCents:0,resultScope:null};
    expect(isGuardedLiveWrite(payout,pass)).toBe(false);
    expect(isGuardedLiveWrite(reversal,pass)).toBe(false);
    expect(listingForConnection(registry,pass).some(t=>t.name==='money_create_payout'))
      .toBe(false);
    // A funded pass keeps exactly its previous admission — nothing gained,
    // nothing lost — and nonfinancial schedule admission is unchanged.
    expect(isGuardedLiveWrite(payout,{...pass,moneyLimitCents:10000})).toBe(true);
    expect(isGuardedLiveWrite(schedule,pass)).toBe(true);
    // The synthetic top-up fixture is refused for every LIVE connection
    // shape (ruling 2): owner, funded pass, unfunded pass alike.
    for(const connection of [owner,pass,{...pass,moneyLimitCents:10000}]){
      expect(isGuardedLiveWrite(topup,connection)).toBe(false);
      expect(isGuardedLiveWrite(cancelTopup,connection)).toBe(false);
    }
    // TEST admission is unchanged by the ruling.
    expect(isGuardedTestWrite(payout,{mode:'test',profile:'full'})).toBe(true);
    expect(isGuardedTestWrite(topup,{mode:'test',profile:'full'})).toBe(true);
  });
  it('owner-obedience V2 family 13 (Projects): only the provider-write half is admitted, in both modes (ruling 4)',()=>{
    const provider=['project_portal_create','workflow_project_setup',
      'workflow_app_readiness_fix'];
    const binding=['project_bind_profile_account',
      'project_enable_scoped_ownership'];
    const owner={mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0};
    for(const name of provider){
      const t=registry.tools.find(x=>x.name===name);
      expect(t?.writeContract,name).toBe('defineWrite-v1');
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'}),name).toBe(true);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'read_only'}),name).toBe(false);
      expect(isGuardedLiveWrite(t,owner),name).toBe(true);
      expect(isGuardedLiveWrite(t,{...owner,rtcLiveOwnerApproved:false}),name)
        .toBe(false);
    }
    // The binding half changes server-side state and is referred to
    // the owner-surface migration: it gains no admission here.
    for(const name of binding){
      const t=registry.tools.find(x=>x.name===name);
      expect(isGuardedTestWrite(t,{mode:'test',profile:'full'}),name).toBe(false);
      expect(isGuardedLiveWrite(t,owner),name).toBe(false);
    }
    const testNames=listingForConnection(registry,
      {mode:'test',profile:'full',listing:'catalog'}).map(t=>t.name);
    const liveNames=listingForConnection(registry,owner).map(t=>t.name);
    for(const name of provider){
      expect(testNames).toContain(name);
      expect(liveNames).toContain(name);
    }
    for(const name of binding){
      expect(testNames).not.toContain(name);
      expect(liveNames).not.toContain(name);
    }
  });
  it('never publishes internal capability metadata with listed tools',()=>{
    const tool={name:'read',writes:false,profiles:['read_only'],description:'safe'};
    expect(publicToolInfo(tool)).toMatchObject({name:'read',description:'safe',
      annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}});
    expect(publicToolInfo(tool)).not.toHaveProperty('writes');
    expect(tool.writes).toBe(false);
  });
  it('hidden tools cannot be invoked by guessing their exact registered names',async()=>{
    const fixture=setup(),db={};
    const tryCall=(name,profile)=>dispatchReadOnlyTool({
      registry:fixture.registry,name,connection:{mode:'test',profile},db,args:{confirm:true}
    });
    expect((await tryCall('r_owner','read_only')).isError).toBe(true);
    expect((await tryCall('w_admin','full')).isError).toBe(true);
    expect((await tryCall('w_everyday','everyday')).isError).toBe(true);
    expect(fixture.count()).toBe(0);
    const response=await tryCall('r_owner','full');
    expect(response.isError).toBeUndefined();
    expect(fixture.count()).toBe(1);
  });
  it('home endpoint publishes true currently usable counts for each profile',async()=>{
    let body;
    const res={setHeader:()=>{},status:(code)=>{expect(code).toBe(200);return res;},
      json:value=>{body=value;return res;}};
    await home({},res);
    // The home endpoint must report EXACTLY the active registry's visible tools.
    // Under the isolated K-3 core-adoption adapter, the portable profile policy
    // intentionally differs by one owner-only tool; do not hardcode a stale count.
    const counts=Object.fromEntries(['read_only','everyday','full'].map(profile=>
      [profile,visibleTools(registry,profile).length]));
    expect(body.profileToolCounts).toEqual(counts);
    expect(body.tools).toBe(329);
  });
});
