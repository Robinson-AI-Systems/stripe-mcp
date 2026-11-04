import {describe,it,expect,vi,afterEach} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {isGuardedLiveWrite,isGuardedTestWrite,listingForConnection}
  from '../../src/core/profiles.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {APP_SEED} from '../../src/apps/profiles.js';
import {handlers as accountHandlers} from '../../src/tools/brand-account.js';
import {handlers as kitHandlers,makeBrandImageUpload}
  from '../../src/tools/brand-kit.js';
const acct='acct_BRANDLIVE',templateId='inr_LIVE1234',portalId='bpc_LIVE1234';
const customer='cus_LIVE1234',price='price_LIVE1234';
const parse=r=>JSON.parse(r.content[0].text);
// One fixture family for both modes: provider objects carry the
// fixture's livemode so wrong-mode objects can be served on purpose.
function brandFixture({mode='live',templateLivemode=mode==='live',
  accountLivemode=mode==='live',balanceLivemode=mode==='live'}={}){
  const live=mode==='live';
  const writes=[];
  const db=createFakeDb({accounts:[{id:acct,label:'Brand live',
    live_enabled:true,live_connected:true}]});
  let archived=false,headline='Original',nickname='Main',portalReturn=null;
  const files=new Map();
  const sdk={
    accounts:{retrieve:async()=>({id:acct,object:'account',
      ...(accountLivemode===undefined?{}:{livemode:accountLivemode}),
      settings:{branding:{primary_color:'#112233'}},
      business_profile:{name:'Live Shop'}})},
    balance:{retrieve:async()=>({object:'balance',livemode:balanceLivemode})},
    invoiceRenderingTemplates:{
      retrieve:async id=>{
        if(id!==templateId)throw new TypeError('Wrong template');
        return {id,object:'invoice_rendering_template',nickname,
          status:archived?'archived':'active',livemode:templateLivemode,
          metadata:{}};
      },
      archive:async(id,_unused,opts)=>{
        writes.push({name:'archive',id,opts});archived=true;
        return {id,status:'archived'};
      },
      unarchive:async(id,_unused,opts)=>{
        writes.push({name:'unarchive',id,opts});archived=false;
        return {id,status:'active'};
      }
    },
    billingPortal:{configurations:{
      retrieve:async id=>({id,object:'billing_portal.configuration',
        active:true,livemode:live,
        business_profile:{headline},metadata:{},
        ...(portalReturn?{default_return_url:portalReturn}:{})}),
      update:async(id,args,opts)=>{
        writes.push({name:'portal',id,args,opts});
        if(args.business_profile?.headline!==undefined)
          headline=args.business_profile.headline;
        if(args.default_return_url!==undefined)portalReturn=args.default_return_url;
        return {id,active:true};
      }
    }},
    files:{
      retrieve:async id=>files.get(id)??{id,object:'file',
        purpose:'business_logo',livemode:live,size:24},
      create:async(args,opts)=>{
        writes.push({kind:'file',args,opts});
        const f={id:'file_LIVE123',object:'file',purpose:args.purpose,
          livemode:live,filename:args.file.name,size:args.file.data.length};
        files.set(f.id,f);return f;
      }
    },
    customers:{retrieve:async()=>({id:customer,object:'customer',
      livemode:live,metadata:{}})},
    prices:{retrieve:async()=>({id:price,object:'price',type:'one_time',
      active:true,recurring:null,currency:'usd',unit_amount:3600,
      livemode:live,metadata:{}})},
    checkout:{sessions:{
      create:async(args,opts)=>{
        writes.push({kind:'checkout',args,opts});
        return {id:'cs_live_BRAND123',object:'checkout.session',
          mode:args.mode,customer:args.customer,livemode:true,
          url:'https://checkout.stripe.com/live_brand',
          branding_settings:args.branding_settings??null};
      },
      retrieve:async id=>writes.find(w=>w.kind==='checkout')?
        {id,object:'checkout.session',mode:'payment',customer,livemode:true,
          url:'https://checkout.stripe.com/live_brand',
          branding_settings:writes.find(w=>w.kind==='checkout').args
            .branding_settings??null}:null
    }}
  };
  const connection={stripeAccount:acct,mode,profile:'full',
    ...(live?{context:'customer',rtcLiveOwnerApproved:true}:{})};
  const ctx={db,connection,connectionId:'brand-live',
    ...(live?{liveAccessGranted:true}:{}),
    services:{stripeForConnection:async()=>sdk,hostedReturnUrls:{
      success:'https://example.test/success',
      cancel:'https://example.test/cancel',
      portal:'https://example.test/portal'}}};
  return {db,sdk,writes,ctx,files,
    setNickname:v=>{nickname=v},archived:()=>archived};
}
const sixOps=['brand_preview_checkout','brand_upload_image','brand_save_kit',
  'brand_archive_invoice_template','brand_unarchive_invoice_template',
  'brand_set_portal_look'];
describe('owner-obedience V2 family 11 (Branding): dispatcher admission',()=>{
  it('admits exactly the six branding writes in LIVE for the owner-approved connection only',()=>{
    const owner={mode:'live',profile:'full',listing:'catalog',
      context:'customer',rtcLiveOwnerApproved:true,moneyLimitCents:0};
    for(const name of sixOps){
      const tool=registry.tools.find(t=>t.name===name);
      expect(tool?.writes).toBe(true);
      expect(isGuardedLiveWrite(tool,owner)).toBe(true);
      expect(isGuardedLiveWrite(tool,{...owner,rtcLiveOwnerApproved:false}))
        .toBe(false);
      expect(isGuardedLiveWrite(tool,{...owner,profile:'read_only'}))
        .toBe(false);
      expect(isGuardedTestWrite(tool,{mode:'test',profile:'full'})).toBe(true);
    }
    // The payout schedule's branding exposure stays admitted (ruling 6).
    const schedule=registry.tools.find(t=>t.name==='setup_set_payout_schedule');
    expect(isGuardedLiveWrite(schedule,owner)).toBe(true);
    const liveNames=listingForConnection(registry,owner).map(t=>t.name);
    for(const name of sixOps)expect(liveNames).toContain(name);
    const testNames=listingForConnection(registry,
      {mode:'test',profile:'full',listing:'catalog'}).map(t=>t.name);
    for(const name of sixOps)expect(testNames).toContain(name);
  });
});
describe('owner-obedience V2 family 11 (Branding): LIVE writes',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it('invoice templates: LIVE preview discloses, fingerprint confirm archives and restores by read-back',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture(),a={templateId,requestKey:'tpl-live'};
    const preview=parse(await accountHandlers.brand_archive_invoice_template(
      {...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('new real invoices');
    expect(preview.previewFingerprint)
      .toMatch(/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    expect(f.writes).toHaveLength(0);
    const done=parse(await accountHandlers.brand_archive_invoice_template(
      {...a,confirm:true,previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].opts.idempotencyKey).toMatch(/^rmcp_/);
    expect(f.archived()).toBe(true);
    const restored=parse(await accountHandlers.brand_unarchive_invoice_template(
      {templateId,confirm:true,requestKey:'tpl-live-back'},f.ctx));
    expect(restored.done).toBe(true);
    expect(f.archived()).toBe(false);
  });
  it('invoice templates: a drifted LIVE confirmation refuses with the fresh fingerprint and executes nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture(),a={templateId,requestKey:'tpl-drift'};
    const preview=parse(await accountHandlers.brand_archive_invoice_template(
      {...a,dryRun:true},f.ctx));
    f.setNickname('Changed');
    const refused=parse(await accountHandlers.brand_archive_invoice_template(
      {...a,confirm:true,previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(refused.done).toBe(false);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(f.writes).toHaveLength(0);
    const done=parse(await accountHandlers.brand_archive_invoice_template(
      {...a,confirm:true,previewFingerprint:refused.previewFingerprint},f.ctx));
    expect(done.done).toBe(true);
    expect(f.writes).toHaveLength(1);
  });
  it('wrong-mode provider objects are refused in both directions',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const liveSide=brandFixture({templateLivemode:false});
    await expect(accountHandlers.brand_archive_invoice_template(
      {templateId,confirm:true},liveSide.ctx))
      .rejects.toThrow(/mode mismatch/);
    expect(liveSide.writes).toHaveLength(0);
    // Account verified TEST from independent balance evidence, but the
    // template itself is a LIVE object: the object invariant refuses.
    const testSide=brandFixture({mode:'test',accountLivemode:undefined,
      balanceLivemode:false,templateLivemode:true});
    await expect(accountHandlers.brand_archive_invoice_template(
      {templateId,confirm:true},testSide.ctx))
      .rejects.toThrow(/mode mismatch/);
    expect(testSide.writes).toHaveLength(0);
    // And LIVE provider evidence served to a TEST connection refuses whole.
    const wrongAccount=brandFixture({mode:'test',accountLivemode:true,
      balanceLivemode:true,templateLivemode:true});
    await expect(accountHandlers.brand_archive_invoice_template(
      {templateId,confirm:true},wrongAccount.ctx))
      .rejects.toThrow(/Non-TEST|TEST-mode evidence/);
    expect(wrongAccount.writes).toHaveLength(0);
  });
  it('portal look: LIVE preview names the publicly visible fields, confirm re-reads exact config',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture(),a={configId:portalId,headline:'New look',
      requestKey:'portal-live'};
    const preview=parse(await accountHandlers.brand_set_portal_look(
      {...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('publicly visible to real customers');
    expect(preview.preview).toContain('headline');
    const done=parse(await accountHandlers.brand_set_portal_look(
      {...a,confirm:true,previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].args.business_profile).toEqual({headline:'New look'});
  });
  it('portal look: row 32 refuses in BOTH modes even with outsideApp, and writes nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    for(const mode of ['live','test']){
      const f=brandFixture({mode});
      await f.db.seedTestAppProfile({...APP_SEED,stripe_accounts:[acct]});
      await expect(accountHandlers.brand_set_portal_look({
        configId:portalId,headline:'Takeover',outsideApp:true,confirm:true,
        requestKey:'row32-'+mode},f.ctx))
        .rejects.toThrow(/App-bound TEST Portal ownership cannot be proven/);
      expect(f.writes).toHaveLength(0);
    }
  });
  it('portal look: public-HTTPS and owner-configured return-destination checks still fire in LIVE',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture();
    await expect(accountHandlers.brand_set_portal_look({
      configId:portalId,privacyUrl:'http://insecure.example/privacy',
      confirm:true,requestKey:'portal-http'},f.ctx))
      .rejects.toThrow(/Only safe public HTTPS/);
    await expect(accountHandlers.brand_set_portal_look({
      configId:portalId,defaultReturnUrl:'https://other.example/portal',
      confirm:true,requestKey:'portal-return'},f.ctx))
      .rejects.toThrow(/must match owner-configured HTTPS redirect/);
    expect(f.writes).toHaveLength(0);
    const ok=parse(await accountHandlers.brand_set_portal_look({
      configId:portalId,defaultReturnUrl:'https://example.test/portal',
      confirm:true,requestKey:'portal-return-ok'},f.ctx));
    expect(ok.done).toBe(true);
  });
  it('brand kit: LIVE save discloses separate records, stores under LIVE only, fingerprint binds',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture(),kit={displayName:'Live Brand'};
    const a={kit,expectedVersion:0,requestKey:'kit-live'};
    const preview=parse(await kitHandlers.brand_save_kit({...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('separate records');
    expect(await f.db.getBrandKit({account:acct,mode:'live'})).toBeNull();
    const fake=parse(await kitHandlers.brand_save_kit({...a,confirm:true,
      previewFingerprint:'WRITE-AAAAA-AAAAA-AAAAA-AAAAA'},f.ctx));
    expect(fake.done).toBe(false);
    expect(await f.db.getBrandKit({account:acct,mode:'live'})).toBeNull();
    const done=parse(await kitHandlers.brand_save_kit({...a,confirm:true,
      previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect((await f.db.getBrandKit({account:acct,mode:'live'})).version).toBe(1);
    expect(await f.db.getBrandKit({account:acct,mode:'test'})).toBeNull();
  });
  it('brand kit: the asset scope/mode guard still fires in LIVE (wrong purpose, wrong mode)',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture();
    f.files.set('file_EVIDENCE',{id:'file_EVIDENCE',object:'file',
      purpose:'dispute_evidence',livemode:true,size:24});
    await expect(kitHandlers.brand_save_kit({kit:{logoFileId:'file_EVIDENCE'},
      expectedVersion:0,confirm:true,requestKey:'kit-scope'},f.ctx))
      .rejects.toThrow(/not a selected LIVE business image/);
    f.files.set('file_TESTMODE',{id:'file_TESTMODE',object:'file',
      purpose:'business_logo',livemode:false,size:24});
    await expect(kitHandlers.brand_save_kit({kit:{logoFileId:'file_TESTMODE'},
      expectedVersion:0,confirm:true,requestKey:'kit-mode'},f.ctx))
      .rejects.toThrow(/not a selected LIVE business image/);
    expect(await f.db.getBrandKit({account:acct,mode:'live'})).toBeNull();
  });
  it('image upload: LIVE import completes with verified read-back and returns the file ID',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture();
    const png=Buffer.alloc(30);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
    png.write('IHDR',12);png.writeUInt32BE(256,16);png.writeUInt32BE(256,20);
    const download=async()=>({buffer:png,size:png.length,extension:'png',
      mime:'image/png'});
    const op=makeBrandImageUpload({download});
    const args={kind:'logo',filename:'logo.png',
      sourceUrl:'https://public.example/logo.png'};
    const preview=parse(await op.handler({...args,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('real business image');
    expect(f.writes).toHaveLength(0);
    const done=parse(await op.handler({...args,confirm:true,
      requestKey:'img-live'},f.ctx));
    expect(done.done).toBe(true);
    expect(done.fileId).toBe('file_LIVE123');
    expect(f.writes[0].args.purpose).toBe('business_logo');
  });
  it('checkout preview: LIVE creates a verified hosted session with the LIVE kit, never the TEST kit',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=brandFixture();
    await f.db.saveBrandKit({account:acct,mode:'test',
      settings:{backgroundColor:'#999999'},expectedVersion:0});
    await f.db.saveBrandKit({account:acct,mode:'live',
      settings:{backgroundColor:'#123456'},expectedVersion:0});
    const a={customerId:customer,priceId:price,requestKey:'brand-live-checkout'};
    const preview=parse(await kitHandlers.brand_preview_checkout(
      {...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('real card');
    const done=parse(await kitHandlers.brand_preview_checkout(
      {...a,confirm:true,previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done.done).toBe(true);
    expect(done.url).toBe('https://checkout.stripe.com/live_brand');
    const created=f.writes.find(w=>w.kind==='checkout');
    expect(created.args.branding_settings).toEqual({background_color:'#123456'});
  });
});
