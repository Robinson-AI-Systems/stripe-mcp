// H-1: guarded and audited TEST brand kit persistence and public image import.
import {defineWrite,gone} from './write.js';
import {client,allProfiles,writeProfiles,reply,fail,validateFields} from './billing-shared.js';
import {validateBrandKit,checkoutBranding} from '../brand/store.js';
import {readVerifiedTestAccount} from '../stripe/test-account.js';
import {makeCheckoutWrite} from './checkout-writes.js';
import {downloadEvidence,parseEvidenceUrl} from '../stripe/evidence-source.js';

const kitArgs={kit:{type:'object'},expectedVersion:{type:'integer',minimum:0}};
const uploadArgs={sourceUrl:{type:'string',minLength:12,maxLength:2048},
  filename:{type:'string',maxLength:110},kind:{type:'string',enum:['logo','icon']}};
const isFile=x=>typeof x==='string'&&/^file_[A-Za-z0-9]{2,100}$/.test(x);
const goodAccount=c=>c?.connection?.mode==='test'&&
  /^acct_[A-Za-z0-9]{2,100}$/.test(c?.connection?.stripeAccount??'');
async function verified(ctx){
  if(!goodAccount(ctx))throw new TypeError('Selected TEST account required');
  const s=await client(ctx);
  const account=await readVerifiedTestAccount(s,ctx.connection.stripeAccount);
  if(account?.id!==ctx.connection.stripeAccount||account.livemode!==false)
    throw new TypeError('Stripe TEST account identity unavailable');
  return s;
}
function dimensions(bytes){
  // Minimal headers only: never decode or render untrusted image contents.
  if(bytes.length>=24&&bytes.subarray(0,8).equals(
    Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR')
    return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(bytes.length>4&&bytes[0]===255&&bytes[1]===216){
    for(let i=2;i+8<bytes.length;){
      if(bytes[i]!==255)throw new TypeError('Corrupt JPEG frame');
      const marker=bytes[i+1];i+=2;
      if(marker===0xd9||marker===0xda)break;
      if(marker===0xff)continue;
      if(i+2>bytes.length)break;
      const size=bytes.readUInt16BE(i);
      if(size<2||i+size>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        if(size<7)break;
        return {height:bytes.readUInt16BE(i+3),width:bytes.readUInt16BE(i+5)};
      }
      i+=size;
    }
  }
  throw new TypeError('Image dimensions unavailable; upload refused');
}
export function makeBrandKitSave(){
  let next=null;
  return defineWrite({
    name:'brand_save_kit',
    read:async(a,ctx)=>{
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(k=>!['kit','expectedVersion','dryRun','confirm','requestKey'].includes(k))||
        !Number.isSafeInteger(a.expectedVersion)||a.expectedVersion<0||
        a.requestKey!==undefined&&(typeof a.requestKey!=='string'||
          a.requestKey.length<1||a.requestKey.length>128))
        throw new TypeError('Valid brand kit and revision required');
      next=validateBrandKit(a.kit);
      await verified(ctx);
      if(!ctx.db?.getBrandKit||!ctx.db?.saveBrandKit)
        throw new TypeError('Durable brand kit storage unavailable');
      const old=await ctx.db.getBrandKit({
        account:ctx.connection.stripeAccount,mode:'test'});
      if((old?.version??0)!==a.expectedVersion&&
        JSON.stringify(old?.settings??{})!==JSON.stringify(next))
        throw new TypeError('Brand kit has changed; read current revision');
      // Stripe files must exist for the exact selected account before a kit
      // can refer to them. A guessed or foreign file ID cannot become a default.
      const s=await client(ctx);
      for(const [key,purpose] of [['logoFileId','business_logo'],['iconFileId','business_icon']]){
        const id=next[key];
        if(id!==undefined&&id!==null){
          const file=await s.files.retrieve(id);
          if(file?.id!==id||file.purpose!==purpose||file.livemode===true)
            throw new TypeError('Brand asset is not a selected TEST business image');
        }
      }
      return {...old,metadata:{},id:ctx.connection.stripeAccount};
    },
    summarize:(old,a)=>'TEST MODE: save public Checkout brand kit revision '+
      String(a.expectedVersion)+' for '+old.id+
      '; changes affect only future MCP-created hosted pages, not app-owned pages or account settings.',
    apply:async(a,ctx)=>{
      await ctx.db.saveBrandKit({account:ctx.connection.stripeAccount,mode:'test',
        settings:next,expectedVersion:a.expectedVersion});
    },
    readAfter:async(_a,ctx)=>ctx.db.getBrandKit({
      account:ctx.connection.stripeAccount,mode:'test'}),
    verify:(_before,after)=>!!after&&after.version>=1&&
      JSON.stringify(after.settings)===JSON.stringify(next)
  });
}
export function makeBrandImageUpload({download=downloadEvidence}={}){
  let id=null,size=null;
  const op=defineWrite({
    name:'brand_upload_image',
    read:async(a,ctx)=>{
      validateFields(a,uploadArgs,['sourceUrl','filename','kind']);
      parseEvidenceUrl(a.sourceUrl);
      if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.(png|jpg|jpeg)$/.test(a.filename))
        throw new TypeError('Public PNG or JPEG filename required');
      await verified(ctx);
      return {id:ctx.connection.stripeAccount,metadata:{}};
    },
    summarize:(_old,a)=>'TEST MODE: import one public '+a.kind+
      ' image from '+parseEvidenceUrl(a.sourceUrl).hostname+
      ' to the selected Stripe account; no app-owned or account branding changes.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const loaded=await download(a.sourceUrl,{maxBytes:5*1024*1024});
      if(!Buffer.isBuffer(loaded.buffer)||loaded.size!==loaded.buffer.length||
        loaded.size>5*1024*1024||!['png','jpg'].includes(loaded.extension))
        throw new TypeError('Only bounded PNG/JPEG image content may be uploaded');
      const suffix=a.filename.split('.').at(-1),expected=suffix==='jpeg'?'jpg':suffix;
      if(loaded.extension!==expected)throw new TypeError('Filename does not match image bytes');
      const d=dimensions(loaded.buffer);
      if(d.width<128||d.height<128||d.width>4096||d.height>4096||
        (a.kind==='icon'&&d.width!==d.height))
        throw new TypeError('Image dimensions unsupported; icons must be square');
      size=loaded.size;
      const s=await client(ctx);
      const f=await s.files.create({purpose:a.kind==='icon'?'business_icon':'business_logo',
        file:{data:loaded.buffer,name:a.filename,type:loaded.mime}},{idempotencyKey});
      if(!isFile(f?.id)||f.livemode===true)
        throw new TypeError('Stripe business image identity unverified');
      id=f.id;
    },
    readAfter:async(_a,ctx)=>id?(await client(ctx)).files.retrieve(id):null,
    verify:(_before,after,a)=>after?.id===id&&after.object==='file'&&
      after.purpose===(a.kind==='icon'?'business_icon':'business_logo')&&
      after.size===size&&after.livemode!==true
  });
  return {...op,async handler(a,ctx){
    const result=await op.handler(a,ctx);
    if(result.isError)return result;
    const value=JSON.parse(result.content[0].text);
    return {...result,content:[{type:'text',text:JSON.stringify({
      ...value,...(value.confirmed===true?{fileId:id,kind:a.kind,sizeBytes:size}:{})
    })}]};
  }};
}
const preview=makeCheckoutWrite('checkout_create_payment_link_for_customer');
const string={type:'string'};
const brandFields=Object.fromEntries(['backgroundColor','buttonColor','borderStyle',
  'fontFamily','displayName','logoFileId','iconFileId','submitMessage',
  'termsMessage'].map(k=>[k,string]));
export const tools=[
  {...preview.tool,name:'brand_preview_checkout',area:'branding',profiles:writeProfiles,
    description:'Create a guarded TEST Checkout preview through the native hosted session flow.',
    inputSchema:{type:'object',properties:{
      customerId:{type:'string',pattern:'^cus_[A-Za-z0-9_]{3,190}$'},
      priceId:{type:'string',pattern:'^price_[A-Za-z0-9_]{3,190}$'},
      branding:{type:'object',properties:brandFields,additionalProperties:false},
      outsideApp:{type:'boolean'},dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:['customerId','priceId'],additionalProperties:false}},
  {name:'brand_get',area:'branding',writes:false,profiles:allProfiles,
    description:'Read the selected TEST account kit revision and provider-visible branding.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {...makeBrandImageUpload().tool,area:'branding',profiles:writeProfiles,
    description:'Import bounded, verified public TEST business logo or square icon.',
    inputSchema:{type:'object',properties:{...uploadArgs,dryRun:{type:'boolean'},
      confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
      required:['sourceUrl','filename','kind'],additionalProperties:false}},
  {...makeBrandKitSave().tool,area:'branding',profiles:writeProfiles,
    description:'Save versioned selected TEST brand kit for future MCP-created Checkout.',
    inputSchema:{type:'object',properties:{...kitArgs,dryRun:{type:'boolean'},
      confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
      required:['kit','expectedVersion'],additionalProperties:false}}
];
export const handlers={
  brand_preview_checkout:(a,ctx)=>goodAccount(ctx)&&typeof a?.priceId==='string'?
    makeCheckoutWrite('checkout_create_payment_link_for_customer').handler(a,ctx):
    gone('Verified TEST customer and existing price are required'),
  async brand_get(a,ctx){
    try{
      if(a&&Object.keys(a).length)throw new TypeError('Brand read takes no arguments');
      const s=await verified(ctx);
      const account=await readVerifiedTestAccount(s,ctx.connection.stripeAccount);
      const kit=await ctx.db.getBrandKit({account:ctx.connection.stripeAccount,mode:'test'});
      const branding=account.settings?.branding??{};
      const safe={primaryColor:branding.primary_color??null,
        secondaryColor:branding.secondary_color??null,
        logoPresent:!!branding.logo,iconPresent:!!branding.icon};
      return reply({account:ctx.connection.stripeAccount,mode:'test',
        kit:kit?.settings??null,version:kit?.version??0,
        checkoutDefaults:checkoutBranding(kit?.settings??{}),
        accountBranding:safe,
        accountBrandingReadOnly:true,
        paymentLinkBranding:'Account-wide Dashboard branding; Payment Link creation does not accept per-link branding_settings',
        appCreatedPagesAffected:false});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  brand_upload_image:(a,ctx)=>goodAccount(ctx)?makeBrandImageUpload().handler(a,ctx):
    gone('TEST account required for brand upload'),
  brand_save_kit:(a,ctx)=>goodAccount(ctx)?makeBrandKitSave().handler(a,ctx):
    gone('TEST account required for brand kit saving')
};
