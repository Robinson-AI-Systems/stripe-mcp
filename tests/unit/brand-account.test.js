import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const acct='acct_OWNER123',templateId='inr_FAKE1234',portalId='bpc_FAKE1234';
const data=r=>JSON.parse(r.content[0].text);
function fixture(){
  const writes=[],db=createFakeDb({accounts:[{id:acct,label:'Brand owner'}]});
  let archived=false,headline='Original',wrongOwner=false;
  const sdk={
    accounts:{async retrieve(){return {id:acct,object:'account',livemode:false,
      settings:{branding:{primary_color:'#abcdef'},
        card_payments:{decline_on:{avs_failure:true,cvc_failure:false}},
        payments:{statement_descriptor:'BRAND TEST'},
        dashboard:{timezone:'America/Denver'}},
      business_profile:{name:'Shop',support_email:'hi@example.test'}}}},
    invoiceRenderingTemplates:{
      async list(args){
        return {object:'list',data:[{id:templateId,
          object:'invoice_rendering_template',status:archived?'archived':'active'}],
        has_more:!!args.starting_after};
      },
      async retrieve(id){
        if(id!==templateId)throw new TypeError('Wrong template');
        return {id,object:'invoice_rendering_template',
          status:archived?'archived':'active',livemode:false,metadata:
          wrongOwner?{agreementId:'owned'}:{}};
      },
      async archive(id,_unused,opts){
        writes.push({name:'archive',id,opts});archived=true;
        return {id,status:'archived'};
      },
      async unarchive(id,_unused,opts){
        writes.push({name:'unarchive',id,opts});archived=false;
        return {id,status:'active'};
      }
    },
    billingPortal:{configurations:{
      async retrieve(id){return {id,active:true,object:'billing_portal.configuration',
        business_profile:{headline},metadata:wrongOwner?{agreementId:'app'}:{}};},
      async update(id,args,opts){
        writes.push({name:'portal',id,args,opts});
        if(args.business_profile?.headline!==undefined)headline=args.business_profile.headline;
        return {id,active:true};
      }
    }}
  };
  const connection={stripeAccount:acct,mode:'test',profile:'full'};
  const ctx={db,connection,connectionId:'brand-account',services:{
    stripeForConnection:async()=>sdk}};
  const call=(name,args={},overrides={})=>dispatchReadOnlyTool({registry,name,args,
    connection:{...connection,...overrides},db,services:ctx.services});
  return {sdk,writes,ctx,call,wrongOwner:()=>{wrongOwner=true}};
}
describe('H-1 guided owner account settings never claim a Stripe write',()=>{
  it.each([
    ['brand_set_account_branding',{primaryColor:'#123456'}],
    ['brand_set_statement_descriptor',{descriptor:'BRAND SHOP TEST'}],
    ['brand_set_public_details',{businessName:'Example service'}],
    ['brand_set_invoice_defaults',{footer:'Thanks for your purchase'}],
    ['setup_set_card_safety',{declineWrongZip:true}],
    ['setup_set_dashboard_timezone',{timezone:'America/Denver'}]
  ])('%s preserves observed state and gives exact owner steps',async(name,args)=>{
    const f=fixture(),result=data(await f.call(name,args));
    expect(result).toMatchObject({done:false,account:acct,
      changeMade:false,requiresOwnerAction:true,ownerConfirmed:false,
      manualSettingsUrl:'https://dashboard.stripe.com/test/settings'});
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.verifyWith).toBe(name);
    expect(f.writes).toHaveLength(0);
  });
  it('rejects unsupported colors, descriptor and URL without provider change',async()=>{
    const f=fixture();
    for(const [name,args] of [
      ['brand_set_account_branding',{primaryColor:'red'}],
      ['brand_set_statement_descriptor',{descriptor:'???'}],
      ['brand_set_public_details',{website:'https://localhost/private'}],
      ['setup_set_dashboard_timezone',{timezone:'Etc/UTC'}]
    ])expect((await f.call(name,args)).isError).toBe(true);
    expect(f.writes).toHaveLength(0);
  });
  it('refuses cross-mode and read-only direct access to sensitive guided input',async()=>{
    const f=fixture();
    expect((await f.call('brand_set_account_branding',{primaryColor:'#123456'},
      {mode:'live'})).isError).toBe(true);
    expect((await f.call('brand_set_account_branding',{primaryColor:'#123456'},
      {profile:'read_only'})).isError).toBe(true);
    expect(f.writes).toHaveLength(0);
  });
});
describe('H-1 real TEST invoice rendering and portal appearance workflows',()=>{
  it('lists provider templates with explicit pagination and safe projection',async()=>{
    const f=fixture();
    expect(data(await f.call('brand_list_invoice_templates',{limit:1})))
      .toMatchObject({hasMore:false,data:[{id:templateId,status:'active'}]});
    const two=data(await f.call('brand_list_invoice_templates',{
      limit:1,starting_after:templateId}));
    expect(two.hasMore).toBe(true);
    expect(two.next).toBe(templateId);
    expect(data(await f.call('brand_get_invoice_template',{templateId})))
      .toMatchObject({account:acct,template:{id:templateId,status:'active'}});
    expect(f.writes).toHaveLength(0);
  });
  it('archives and restores with guard, preview, idempotency and native state readback',async()=>{
    const f=fixture();
    const preview=data(await f.call('brand_archive_invoice_template',
      {templateId,dryRun:true}));
    expect(preview.needsConfirmation).toBe(true);
    expect(f.writes).toHaveLength(0);
    const archived=data(await f.call('brand_archive_invoice_template',
      {templateId,confirm:true,requestKey:'template-archive'}));
    expect(archived.done).toBe(true);
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].opts.idempotencyKey).toMatch(/^rmcp_/);
    expect(data(await f.call('brand_get_invoice_template',{templateId}))
      .template.status).toBe('archived');
    expect(data(await f.call('brand_unarchive_invoice_template',
      {templateId,confirm:true,requestKey:'template-unarchive'})).done).toBe(true);
    expect(f.writes).toHaveLength(2);
  });
  it('denies app-owned templates unless explicit override and no writes on read-only',async()=>{
    const f=fixture();f.wrongOwner();
    const denied=await f.call('brand_archive_invoice_template',{
      templateId,confirm:true,requestKey:'app-template'});
    expect(data(denied).done).toBe(false);
    expect(f.writes).toHaveLength(0);
    expect((await f.call('brand_archive_invoice_template',{
      templateId,confirm:true},{profile:'read_only'})).isError).toBe(true);
  });
  it('updates only approved public HTTPS portal presentation, re-reads exact config',async()=>{
    const f=fixture();
    const bad=await f.call('brand_set_portal_look',{
      configId:portalId,headline:'New look',
      privacyUrl:'http://insecure.example/privacy',
      confirm:true,requestKey:'bad-portal'});
    expect(bad.isError).toBe(true);
    expect(f.writes).toHaveLength(0);
    const result=data(await f.call('brand_set_portal_look',{
      configId:portalId,headline:'New look',
      confirm:true,requestKey:'good-portal'}));
    expect(result.done).toBe(true);
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].args.business_profile).toEqual({headline:'New look'});
  });
});
