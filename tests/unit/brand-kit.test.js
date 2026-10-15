import {describe,it,expect} from 'vitest';
import {validateBrandKit,checkoutBranding} from '../../src/brand/store.js';
import {makeBrandKitSave,makeBrandImageUpload,handlers}
  from '../../src/tools/brand-kit.js';
import {makeCheckoutWrite} from '../../src/tools/checkout-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {registry} from '../../src/tools/index.js';
const account='acct_BRAND123',customer='cus_CUSTOM123',price='price_PRICE123';
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const db=createFakeDb({accounts:[{id:account,label:'Brand fixture'}]});
  const writes=[],sessions=new Map(),files=new Map();
  const s={
    accounts:{retrieve:async()=>({id:account,object:'account',livemode:false,
      settings:{branding:{primary_color:'#112233'}}})},
    customers:{retrieve:async()=>({id:customer,object:'customer',metadata:{}})},
    prices:{retrieve:async()=>({id:price,type:'one_time',active:true,recurring:null,
      currency:'usd',unit_amount:3600,metadata:{}})},
    files:{
      retrieve:async id=>files.get(id)??{id,object:'file',purpose:'business_logo',
        livemode:false,size:24},
      create:async (args,opts)=>{
        writes.push({kind:'file',args,opts});
        const f={id:'file_BRAND123',object:'file',purpose:args.purpose,
          livemode:false,filename:args.file.name,size:args.file.data.length};
        files.set(f.id,f);return f;
      }
    },
    checkout:{sessions:{
      create:async (args,opts)=>{
        writes.push({kind:'checkout',args,opts});
        const session={id:'cs_test_BRAND123',mode:args.mode,customer:args.customer,
          object:'checkout.session',url:'https://checkout.stripe.com/test_brand',
          branding_settings:args.branding_settings??null};
        sessions.set(session.id,session);return session;
      },
      retrieve:async id=>sessions.get(id)
    }}
  };
  const connection={stripeAccount:account,mode:'test',profile:'full'};
  const ctx={db,connection,connectionId:'brand-test',getCustomer:async()=>({
    id:customer,metadata:{}}),
    services:{stripeForConnection:async()=>s,hostedReturnUrls:{
      success:'https://example.test/success',
      cancel:'https://example.test/cancel',
      portal:'https://example.test/portal'
    }}};
  return {db,s,writes,ctx};
}
describe('H-1 brand kit validation and scoped versioning',()=>{
  it('refuses unknown fields, wrong colors, unsafe descriptors and guessed files',()=>{
    expect(()=>validateBrandKit({unsupported:true})).toThrow();
    expect(()=>validateBrandKit({backgroundColor:'red'})).toThrow();
    expect(()=>validateBrandKit({iconFileId:'https://private.example'})).toThrow();
    expect(()=>validateBrandKit({displayName:'<secret>'})).toThrow();
    expect(checkoutBranding({logoFileId:'file_LOGO123',iconFileId:'file_ICON123'}))
      .toMatchObject({logo:{type:'file',file:'file_LOGO123'}});
    expect(checkoutBranding({logoFileId:'file_LOGO123'},
      {iconFileId:'file_ICON123'})).toMatchObject({
      icon:{type:'file',file:'file_ICON123'}});
    expect(Object.keys(checkoutBranding({logoFileId:'file_LOGO123'},
      {iconFileId:'file_ICON123'}))).not.toContain('logo');
  });
  it('previews without changing kits, saves once and detects stale revision',async()=>{
    const f=fixture(),kit={backgroundColor:'#112233',buttonColor:'#ffffff'};
    const op=makeBrandKitSave();
    const dry=parse(await op.handler({kit,expectedVersion:0,dryRun:true},f.ctx));
    expect(dry.done).toBe(false);
    expect(await f.db.getBrandKit({account,mode:'test'})).toBeNull();
    const done=parse(await op.handler({
      kit,expectedVersion:0,confirm:true,requestKey:'brand-once'
    },f.ctx));
    expect(done.done).toBe(true);
    expect((await f.db.getBrandKit({account,mode:'test'})).version).toBe(1);
    const duplicate=await f.db.saveBrandKit({account,mode:'test',settings:kit,
      expectedVersion:0});
    expect(duplicate.version).toBe(1);
    const stale=await op.handler({kit:{buttonColor:'#000000'},
      expectedVersion:0,confirm:true,requestKey:'brand-stale'},f.ctx);
    expect(stale.isError).toBe(true);
    expect((await f.db.getBrandKit({account,mode:'test'})).version).toBe(1);
    expect(f.writes).toHaveLength(0);
  });
  it('rejects LIVE and read-only dispatch before kit writes',async()=>{
    const f=fixture();
    for(const connection of [{...f.ctx.connection,mode:'live'},
      {...f.ctx.connection,profile:'read_only'}]){
      const r=await dispatchReadOnlyTool({registry,name:'brand_save_kit',
        args:{kit:{displayName:'Read Only'},expectedVersion:0,confirm:true},
        db:f.db,connection,services:f.ctx.services});
      expect(r.isError).toBe(true);
    }
    expect(await f.db.getBrandKit({account,mode:'test'})).toBeNull();
  });
  it('preserves the difference between account branding and future session defaults',async()=>{
    const f=fixture();
    const r=await handlers.brand_get({},f.ctx);
    expect(parse(r)).toMatchObject({account,version:0,
      accountBranding:{primaryColor:'#112233'},appCreatedPagesAffected:false});
  });
});
describe('H-1 supported Checkout and validated public brand image',()=>{
  it('applies stored brand defaults to MCP-created Checkout, then verifies readback',async()=>{
    const f=fixture();
    await f.db.saveBrandKit({account,mode:'test',
      settings:{backgroundColor:'#123456',displayName:'Checkout fixture'},
      expectedVersion:0});
    const out=parse(await makeCheckoutWrite(
      'checkout_create_payment_link_for_customer').handler({
      customerId:customer,priceId:price,confirm:true,requestKey:'hosted-kit-test'
    },f.ctx));
    expect(out.done).toBe(true);
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].args.branding_settings).toEqual({
      background_color:'#123456',display_name:'Checkout fixture'});
    expect(f.writes[0].args.custom_text).toBeUndefined();
  });
  it('an explicit per-call override wins and missing brand storage fails closed',async()=>{
    const f=fixture();
    await f.db.saveBrandKit({account,mode:'test',
      settings:{backgroundColor:'#123456'},expectedVersion:0});
    const done=parse(await makeCheckoutWrite('checkout_create_setup_link').handler({
      customerId:customer,branding:{backgroundColor:'#abcdef'},
      confirm:true,requestKey:'hosted-overridden'
    },f.ctx));
    expect(done.done).toBe(true);
    expect(f.writes[0].args.branding_settings.background_color).toBe('#abcdef');
    const badCtx={...f.ctx,db:{recordChange:f.db.recordChange}};
    await expect(makeCheckoutWrite('checkout_create_setup_link').handler({
      customerId:customer,confirm:true,requestKey:'missing-kit-store'
    },badCtx)).rejects.toThrow(/storage unavailable/);
  });
  it('uploads only checked square icons and never submits provider actions in preview',async()=>{
    const f=fixture();
    const png=Buffer.alloc(30);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
    png.write('IHDR',12);png.writeUInt32BE(256,16);png.writeUInt32BE(256,20);
    const download=async()=>({buffer:png,size:png.length,extension:'png',
      mime:'image/png'});
    const op=makeBrandImageUpload({download});
    const args={kind:'icon',filename:'square.png',
      sourceUrl:'https://public.example/square.png'};
    expect(parse(await op.handler({...args,dryRun:true},f.ctx)).done).toBe(false);
    expect(f.writes).toHaveLength(0);
    const done=parse(await op.handler({...args,confirm:true,
      requestKey:'image-test'},f.ctx));
    expect(done.done).toBe(true);
    expect(done.fileId).toBe('file_BRAND123');
    expect(f.writes[0].args.purpose).toBe('business_icon');
    png.writeUInt32BE(128,20);
    const refused=await makeBrandImageUpload({download}).handler({...args,
      confirm:true,requestKey:'image-not-square'},f.ctx);
    expect(refused.isError??false).toBe(true);
    expect(f.writes).toHaveLength(1);
  });
});
