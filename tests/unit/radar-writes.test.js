import {describe,it,expect,vi,afterEach} from 'vitest';
import {makeRadarApprove,makeRadarListCreate,tools,handlers}
  from '../../src/tools/radar-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
const reviewId='prv_FAKE1234',paymentId='pi_FAKE1234',listId='rsl_FAKE1234';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,uncertain=false}={}){
  let review={id:reviewId,object:'review',livemode:false,open:true,created:1695680197,
    reason:'rule',charge:null,payment_intent:paymentId};
  let lists=[];
  const provider={
    reviews:{retrieve:vi.fn(async()=>({...review})),
      approve:vi.fn(async()=>{if(!uncertain)review={...review,open:false,
        reason:'approved'};return review;})},
    paymentIntents:{retrieve:vi.fn(async()=>({id:paymentId,object:'payment_intent',
      livemode:false,metadata:appOwned?{agreementId:'private'}:{},customer:null}))},
    charges:{retrieve:vi.fn()},customers:{retrieve:vi.fn()},
    radar:{valueLists:{
      list:vi.fn(async()=>({data:lists.filter(l=>l.alias==='test_alias'),has_more:false})),
      create:vi.fn(async(_args)=>{const value={id:listId,object:'radar.value_list',
        livemode:false,created:1695680197,name:_args.name,alias:_args.alias,
        item_type:_args.item_type,list_items:{total_count:0}};
        if(!uncertain)lists.push(value);return value;}),
      retrieve:vi.fn(async()=>lists[0]??null)}}};
  const db=createFakeDb();
  const ctx={db,connectionId:'risk-writer',connection:{stripeAccount:'acct_FAKE1234',
    mode:'test',profile:'full',resultScope:'risk-scope'},
    services:{stripeForConnection:async()=>provider}};
  return {db,provider,ctx,approve:a=>makeRadarApprove().handler(a,ctx),
    create:a=>makeRadarListCreate().handler(a,ctx)};
}
const createArgs={name:'Potential Fraud',alias:'test_alias',itemType:'email',requestKey:'create-one'};
describe('G-3b guarded native TEST Radar writes',()=>{
  it('two full-only write contracts are registered and never direct read_only',()=>{
    expect(tools).toHaveLength(2);
    expect(tools.every(x=>x.writes&&x.writeContract==='defineWrite-v1'&&
      x.profiles.join(',')==='full')).toBe(true);
    for(const t of tools)expect(registry.tools.find(x=>x.name===t.name)).toBeTruthy();
  });
  it('review: preview, missing confirm, then provider write and independent final readback',async()=>{
    const f=fixture(),a={reviewId,requestKey:'review-one'};
    expect(parse(await f.approve({...a,dryRun:true})).preview).toContain('may allow');
    expect(parse(await f.approve(a)).needsConfirmation).toBe(true);
    expect(f.provider.reviews.approve).not.toHaveBeenCalled();
    expect(parse(await f.approve({...a,confirm:true}))).toMatchObject({done:true,confirmed:true});
    expect(f.provider.reviews.approve).toHaveBeenCalledWith(reviewId,{},
      {idempotencyKey:expect.stringMatching(/^rmcp_radar_approve_review_/)});
    expect(f.provider.reviews.retrieve).toHaveBeenCalledTimes(4);
  });
  it('review: uncertain provider state, closed review and app-owned PI fail closed',async()=>{
    const uncertain=fixture({uncertain:true});
    const bad=parse(await uncertain.approve({reviewId,confirm:true}));
    expect(bad).toMatchObject({done:false,confirmed:false});
    const owned=fixture({appOwned:true});
    expect(parse(await owned.approve({reviewId,confirm:true})).done).toBe(false);
    expect(owned.provider.reviews.approve).not.toHaveBeenCalled();
    const explicit=parse(await owned.approve({reviewId,outsideApp:true,dryRun:true}));
    expect(explicit.preview).toContain('TEST MODE');
  });
  it('list: create only after empty exact alias preflight and safe preview',async()=>{
    const f=fixture(),preview=parse(await f.create({...createArgs,dryRun:true}));
    expect(preview.preview).toContain('test_alias');
    expect(preview.preview).not.toContain('Potential Fraud');
    expect(f.provider.radar.valueLists.create).not.toHaveBeenCalled();
    expect(parse(await f.create(createArgs)).needsConfirmation).toBe(true);
    const done=parse(await f.create({...createArgs,confirm:true}));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.provider.radar.valueLists.create).toHaveBeenCalledWith({
      name:'Potential Fraud',alias:'test_alias',item_type:'email'},
      {idempotencyKey:expect.any(String)});
    await expect(f.create({...createArgs,confirm:true,requestKey:'new'}))
      .rejects.toThrow(/alias is unused/);
  });
  it('list: unknown fields and unverified readback cannot claim success',async()=>{
    const f=fixture({uncertain:true});
    expect(parse(await f.create({...createArgs,confirm:true})).confirmed).toBe(false);
    expect(f.provider.radar.valueLists.create).toHaveBeenCalledTimes(1);
    await expect(f.create({...createArgs,privateCard:'secret',confirm:true}))
      .rejects.toThrow();
  });
  it('profile and LIVE guards refuse both actions, including confirm',async()=>{
    const f=fixture();
    for(const [name,args] of [['radar_approve_review',{reviewId}],
      ['radar_create_value_list',createArgs]]){
      const ro=await handlers[name]({...args,confirm:true},
        {...f.ctx,connection:{...f.ctx.connection,profile:'read_only'}});
      const live=await handlers[name]({...args,confirm:true},
        {...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
      expect(ro.isError).toBe(true);expect(live.isError).toBe(true);
    }
    expect(f.provider.reviews.approve).not.toHaveBeenCalled();
    expect(f.provider.radar.valueLists.create).not.toHaveBeenCalled();
  });
});
function liveFixture({livemode=true}={}){
  const account='acct_FAKE1234';
  let review={id:reviewId,object:'review',livemode,open:true,created:1695680197,
    reason:'rule',charge:null,payment_intent:paymentId};
  let pi={id:paymentId,object:'payment_intent',livemode,metadata:{},customer:null};
  let lists=[];
  const provider={
    accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',livemode:true}))},
    balance:{retrieve:vi.fn(async()=>({object:'balance',livemode:true}))},
    reviews:{retrieve:vi.fn(async()=>({...review})),
      approve:vi.fn(async()=>{review={...review,open:false,reason:'approved'};
        return review;})},
    paymentIntents:{retrieve:vi.fn(async()=>({...pi}))},
    charges:{retrieve:vi.fn()},
    customers:{retrieve:vi.fn(async()=>({id:'cus_FAKE1234',object:'customer',
      metadata:{}}))},
    radar:{valueLists:{
      list:vi.fn(async()=>({data:lists.filter(l=>l.alias==='test_alias'),
        has_more:false})),
      create:vi.fn(async(_args)=>{const value={id:listId,object:'radar.value_list',
        livemode,created:1695680197,name:_args.name,alias:_args.alias,
        item_type:_args.item_type,list_items:{total_count:0}};
        lists.push(value);return value;}),
      retrieve:vi.fn(async()=>lists[0]??null)}}};
  const db=createFakeDb({accounts:[{id:account,live_enabled:true,
    live_connected:true}]});
  const ctx={db,connectionId:'risk-writer-live',liveAccessGranted:true,
    connection:{stripeAccount:account,mode:'live',profile:'full',
      context:'customer',rtcLiveOwnerApproved:true},
    services:{stripeForConnection:async()=>provider}};
  return {db,provider,ctx,
    approve:a=>makeRadarApprove().handler(a,ctx),
    create:a=>makeRadarListCreate().handler(a,ctx),
    drift:()=>{pi={...pi,metadata:{note:'changed'}};}};
}
describe('G-3b LIVE Radar writes (owner-obedience V2, family 7)',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it('review: LIVE preview discloses the release, fingerprint confirm approves exactly once',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveFixture(),a={reviewId,requestKey:'live-review'};
    const preview=parse(await handlers.radar_approve_review({...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('releases the held payment');
    expect(preview.preview).toContain('captured and settled');
    expect(preview.previewFingerprint)
      .toMatch(/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    expect(f.provider.reviews.approve).not.toHaveBeenCalled();
    const done=parse(await handlers.radar_approve_review(
      {...a,confirm:true,previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.provider.reviews.approve).toHaveBeenCalledTimes(1);
    expect(f.provider.reviews.approve).toHaveBeenCalledWith(reviewId,{},
      {idempotencyKey:expect.stringMatching(/^rmcp_radar_approve_review_/)});
  });
  it('review: a drifted LIVE confirmation refuses with the fresh fingerprint and executes nothing',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveFixture(),a={reviewId,requestKey:'live-drift'};
    const preview=parse(await f.approve({...a,dryRun:true}));
    f.drift();
    const refused=parse(await f.approve({...a,confirm:true,
      previewFingerprint:preview.previewFingerprint}));
    expect(refused.done).toBe(false);
    expect(refused.error).toMatch(/state has changed/);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(f.provider.reviews.approve).not.toHaveBeenCalled();
    const done=parse(await f.approve({...a,confirm:true,
      previewFingerprint:refused.previewFingerprint}));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.provider.reviews.approve).toHaveBeenCalledTimes(1);
  });
  it('list: LIVE create previews the alias and real-payment effect, then creates exactly once',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const f=liveFixture();
    const preview=parse(await handlers.radar_create_value_list(
      {...createArgs,dryRun:true},f.ctx));
    expect(preview.preview).toContain('LIVE MODE');
    expect(preview.preview).toContain('test_alias');
    expect(preview.preview).toContain('refuses real customers');
    expect(preview.preview).not.toContain('Potential Fraud');
    expect(f.provider.radar.valueLists.create).not.toHaveBeenCalled();
    const done=parse(await handlers.radar_create_value_list(
      {...createArgs,confirm:true,
        previewFingerprint:preview.previewFingerprint},f.ctx));
    expect(done).toMatchObject({done:true,confirmed:true});
    expect(f.provider.radar.valueLists.create).toHaveBeenCalledTimes(1);
    expect(f.provider.radar.valueLists.create).toHaveBeenCalledWith({
      name:'Potential Fraud',alias:'test_alias',item_type:'email'},
      {idempotencyKey:expect.any(String)});
  });
  it('wrong-mode provider objects are refused in both directions',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const liveSide=liveFixture({livemode:false});
    await expect(liveSide.approve({reviewId,confirm:true}))
      .rejects.toThrow(/Cannot verify exact LIVE Radar record/);
    expect(liveSide.provider.reviews.approve).not.toHaveBeenCalled();
    const created=parse(await liveSide.create({...createArgs,confirm:true}));
    expect(created.confirmed).toBe(false);
    const testSide=liveFixture({livemode:true});
    const testCtx={db:testSide.db,connectionId:'risk-writer-test',
      connection:{stripeAccount:'acct_FAKE1234',mode:'test',profile:'full'},
      services:testSide.ctx.services};
    await expect(makeRadarApprove().handler({reviewId,confirm:true},testCtx))
      .rejects.toThrow(/Cannot verify exact TEST Radar record/);
    const createdTest=parse(await makeRadarListCreate().handler(
      {...createArgs,confirm:true},testCtx));
    expect(createdTest.confirmed).toBe(false);
  });
});
