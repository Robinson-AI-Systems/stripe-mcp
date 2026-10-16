// Native TEST hosted payment experiences. Return URLs are owner-configured
// server values; AI cannot choose redirect origins or receive a client_secret.
import {defineWrite,gone} from './write.js';
import {APP_METADATA_KEYS} from './app-guard.js';
import {checkoutBranding,validateBrandKit} from '../brand/store.js';
const p=['everyday','full'],full=['full'];
const id=prefix=>({type:'string',pattern:'^'+prefix+'_[A-Za-z0-9_]{3,190}$'});
const txt=n=>({type:'string',minLength:1,maxLength:n});
const money={type:'integer',minimum:1,maximum:100000000};
const metadata={type:'object',additionalProperties:{type:'string'}};
const common={outsideApp:{type:'boolean'}};
const brandProp={type:'object',additionalProperties:false,properties:Object.fromEntries(
  ['backgroundColor','buttonColor','borderStyle','fontFamily','displayName',
    'logoFileId','iconFileId','submitMessage','termsMessage'].map(k=>[k,{type:'string'}]))};
const defs=[
  {name:'checkout_create_payment_link_for_customer',desc:'Create a one-time hosted TEST payment page for an existing customer.',
    props:{customerId:id('cus'),priceId:id('price'),amountCents:money,productName:txt(120),branding:brandProp,...common},
    required:['customerId']},
  {name:'checkout_create_setup_link',desc:'Create a hosted TEST card and US bank setup page, never a client secret.',
    props:{customerId:id('cus'),branding:brandProp,...common},required:['customerId']},
  {name:'checkout_expire',desc:'Expire an open TEST Checkout session.',
    props:{sessionId:id('cs_test'),...common},required:['sessionId'],destructive:true},
  {name:'paylink_create',desc:'Create a reusable TEST payment link for a verified active price.',
    props:{priceId:id('price'),quantity:{type:'integer',minimum:1,maximum:100},metadata,...common},
    required:['priceId']},
  {name:'paylink_update',desc:'Update the safe metadata or promotion-code policy for a TEST payment link.',
    props:{linkId:id('plink'),metadata,allowPromotionCodes:{type:'boolean'},...common},
    required:['linkId']},
  {name:'paylink_deactivate',desc:'Deactivate a reusable TEST payment link after preview.',
    props:{linkId:id('plink'),...common},required:['linkId']},
  {name:'paylink_activate',desc:'Reactivate a reusable TEST payment link after preview.',
    props:{linkId:id('plink'),...common},required:['linkId']},
  {name:'portal_create_session',desc:'Create a short-lived hosted TEST customer-portal link.',
    props:{customerId:id('cus'),configId:id('bpc'),...common},required:['customerId']},
  {name:'portal_update_configuration',desc:'Set verified TEST portal policies including cancellation permissions.',
    props:{configId:id('bpc'),paymentMethodUpdate:{type:'boolean'},
      invoiceHistory:{type:'boolean'},subscriptionCancel:{type:'boolean'},
      subscriptionUpdate:{type:'boolean'},...common},
    required:['configId'],full:true}
];
const getStripe=ctx=>{
  if(ctx?.connection?.mode!=='test'||typeof ctx?.services?.stripeForConnection!=='function')
    throw new Error('TEST Stripe provider unavailable');
  return ctx.services.stripeForConnection(ctx.connection);
};
function valid(def,a){
  if(!a||typeof a!=='object'||Array.isArray(a))throw new TypeError('Hosted write arguments required');
  for(const key of def.required)if(a[key]===undefined)throw new TypeError('Missing '+key);
  for(const [key,value] of Object.entries(a)){
    if(['confirm','dryRun','requestKey'].includes(key))continue;
    const prop=def.props[key];if(!prop)throw new TypeError('Unsupported '+key);
    if(prop.type==='string'&&(typeof value!=='string'||!value||
      value.length>(prop.maxLength??200)||
      (prop.pattern&&!new RegExp(prop.pattern).test(value))))
      throw new TypeError('Invalid '+key);
    if(prop.type==='integer'&&(!Number.isSafeInteger(value)||
      value<(prop.minimum??1)||value>(prop.maximum??100000000)))
      throw new TypeError('Invalid amount or quantity');
    if(prop.type==='boolean'&&typeof value!=='boolean')throw new TypeError('Invalid '+key);
    if(key==='branding'){
      validateBrandKit(value);
      continue;
    }
    if(prop.type==='object'&&(!value||Array.isArray(value)||typeof value!=='object'||
      Object.keys(value).length>20||Object.entries(value).some(([name,v])=>
        !/^[A-Za-z0-9_-]{1,40}$/.test(name)||APP_METADATA_KEYS.includes(name)||
        ['__proto__','constructor','prototype'].includes(name)||
        typeof v!=='string'||v.length>200)))
      throw new TypeError('Invalid metadata');
  }
  if(def.name==='checkout_create_payment_link_for_customer'&&
    (!!a.priceId===!!a.amountCents))throw new TypeError('Choose exactly one price or amount');
  if(def.name==='checkout_create_payment_link_for_customer'&&a.amountCents&&!a.productName)
    throw new TypeError('Custom amount requires a product description');
  if(['paylink_update','portal_update_configuration'].includes(def.name)&&
    !Object.keys(a).some(k=>!['linkId','configId','outsideApp','confirm','dryRun','requestKey'].includes(k)))
    throw new TypeError('Provide at least one setting to change');
}
const safeHost=(url,hosts,{allowProviderFragment=false}={})=>{try{
  const u=new URL(url);
  return u.protocol==='https:'&&!u.username&&!u.password&&
    (!u.hash||allowProviderFragment)&&!u.port&&hosts.includes(u.hostname);
}catch{return false;}};
const ownerUrls=ctx=>{
  const a=ctx.services?.hostedReturnUrls;
  if(!a||!['success','cancel','portal'].every(k=>typeof a[k]==='string'&&
    /^https:\/\/[^/\s?#]+\/.+/.test(a[k])&&safeHost(a[k],[
      new URL(a.success).hostname,new URL(a.cancel).hostname,new URL(a.portal).hostname
    ])))throw new TypeError('Owner-configured HTTPS Checkout and portal return URLs required');
  const origins=['success','cancel','portal'].map(k=>new URL(a[k]).origin);
  if(new Set(origins).size!==1)throw new TypeError('Configured return URLs must share one approved origin');
  return a;
};
const hosted=x=>safeHost(x,['checkout.stripe.com','billing.stripe.com','buy.stripe.com'],
  {allowProviderFragment:true});
const safePrice=(price,{oneTime=false}={})=>{
  if((oneTime&&(price.type!=='one_time'||price.recurring!=null))||
    price.active!==true||price.currency!=='usd'||!Number.isSafeInteger(price.unit_amount)||
    price.unit_amount<=0)return false;
  return true;
};
async function beforeFor(def,a,s){
  switch(def.name){
    case 'checkout_create_payment_link_for_customer':{
      const customer=await s.customers.retrieve(a.customerId);
      if(customer.deleted)throw new TypeError('Customer unavailable');
      if(a.priceId){
        const price=await s.prices.retrieve(a.priceId);
        if(!safePrice(price,{oneTime:true}))
          throw new TypeError('One-time Checkout requires an active nonrecurring USD price');
        return {...customer,_price:price};
      }
      return customer;
    }
    case 'checkout_create_setup_link':
    case 'portal_create_session':{
      const customer=await s.customers.retrieve(a.customerId);
      if(customer.deleted)throw new TypeError('Customer unavailable');
      if(def.name==='portal_create_session'&&a.configId){
        const cfg=await s.billingPortal.configurations.retrieve(a.configId);
        if(cfg.active!==true)throw new TypeError('Portal configuration is inactive');
        return {...customer,_config:cfg};
      }
      return customer;
    }
    case 'checkout_expire':return s.checkout.sessions.retrieve(a.sessionId);
    case 'paylink_create':{
      const price=await s.prices.retrieve(a.priceId);
      if(!safePrice(price,a))throw new TypeError('Price is inactive, non-USD or app-owned');
      return price;
    }
    case 'paylink_update':
    case 'paylink_deactivate':
    case 'paylink_activate':return s.paymentLinks.retrieve(a.linkId);
    case 'portal_update_configuration':return s.billingPortal.configurations.retrieve(a.configId);
    default:throw new TypeError('Unknown hosted operation');
  }
}
const featureMap={
  paymentMethodUpdate:'payment_method_update',invoiceHistory:'invoice_history',
  subscriptionCancel:'subscription_cancel',subscriptionUpdate:'subscription_update'
};
async function checkoutPresentation(a,ctx,s){
  if(typeof ctx.db?.getBrandKit!=='function')
    throw new TypeError('Brand kit storage unavailable; Checkout refused');
  const saved=await ctx.db.getBrandKit({account:ctx.connection.stripeAccount,
    mode:'test'});
  const branding=checkoutBranding(saved?.settings??{},a.branding??{});
  const selected=branding.logo??branding.icon;
  if(selected){
    const file=await s.files.retrieve(selected.file);
    if(file?.id!==selected.file||file?.livemode===true||
      file?.purpose!==(branding.logo?'business_logo':'business_icon'))
      throw new TypeError('Checkout brand image no longer belongs to this TEST account');
  }
  const kit={...saved?.settings,...a.branding};
  const customText=kit.submitMessage?{submit:{message:kit.submitMessage}}:undefined;
  return {branding,customText};
}
function build(def){
  let created=null;
  const op=defineWrite({
    name:def.name,
    resultId:(_before,after)=>[
      'checkout_create_payment_link_for_customer',
      'checkout_create_setup_link','paylink_create','portal_create_session'
    ].includes(def.name)?after?.id??null:null,
    read:async(a,ctx)=>{
      valid(def,a);
      // Redirect configuration is a mandatory preflight, not an apply-time
      // failure. Fail closed before recording intent or contacting Stripe.
      if(def.name.startsWith('checkout_create_')||def.name==='portal_create_session')
        ownerUrls(ctx);
      const s=await getStripe(ctx),before=await beforeFor(def,a,s);
      if(def.name.startsWith('checkout_create_')){
        const visual=await checkoutPresentation(a,ctx,s);
        return {...before,_checkoutBrand:visual};
      }
      return before;
    },
    summarize:async(b,a)=>'TEST MODE. '+def.name+' for '+b.id+
      '; fields: '+Object.keys(a).filter(k=>!['confirm','dryRun','requestKey','outsideApp'].includes(k))
        .join(', ')+'. No client secrets or LIVE writes.'+
      (def.destructive?' This may invalidate customer-facing links.':'')+
      (def.name==='portal_update_configuration'?' WARNING: cancellation and plan policies may affect subscriptions.':''),
    targetGuard:(a,_ctx,b)=>{
      if(b.deleted)return 'Deleted target';
      if(b._price&&a.outsideApp!==true&&
        Object.keys(b._price.metadata??{}).some(k=>APP_METADATA_KEYS.includes(k)))
        return 'Price is managed by an application';
      if(def.name==='checkout_expire'&&b.status!=='open')return 'Only an open Checkout session can expire';
      if(def.name==='paylink_activate'&&b.active===true)return 'Link already active';
      if(def.name==='paylink_deactivate'&&b.active===false)return 'Link already disabled';
      if(def.name==='portal_update_configuration'&&b.active!==true)
        return 'Portal configuration inactive';
      return true;
    },
    apply:async(a,ctx,{idempotencyKey,before})=>{
      const s=await getStripe(ctx),opts={idempotencyKey},n=def.name;
      if(n==='checkout_create_payment_link_for_customer'||n==='checkout_create_setup_link'){
        const urls=ownerUrls(ctx);
        const line_items=a.priceId?[{price:a.priceId,quantity:1}]:
          [{price_data:{currency:'usd',unit_amount:a.amountCents,
            product_data:{name:a.productName}},quantity:1}];
        created=await s.checkout.sessions.create({
          customer:before.id,
          mode:n==='checkout_create_setup_link'?'setup':'payment',
          ...(n==='checkout_create_setup_link'?{
            payment_method_types:['card','us_bank_account']
          }:{line_items,payment_method_types:['card']}),
          success_url:urls.success,cancel_url:urls.cancel,
          ...(Object.keys(before._checkoutBrand.branding).length?{
            branding_settings:before._checkoutBrand.branding}:{}),
          ...(before._checkoutBrand.customText?{
            custom_text:before._checkoutBrand.customText}:{})
        },opts);
      }else if(n==='checkout_expire')await s.checkout.sessions.expire(a.sessionId,{},opts);
      else if(n==='paylink_create')created=await s.paymentLinks.create({
        line_items:[{price:before.id,quantity:a.quantity??1}],
        ...(a.metadata?{metadata:a.metadata}:{})},opts);
      else if(n==='paylink_update'||n==='paylink_deactivate'||n==='paylink_activate'){
        const payload=n==='paylink_update'?{
          ...(a.metadata?{metadata:a.metadata}:{}),
          ...(a.allowPromotionCodes!==undefined?{allow_promotion_codes:a.allowPromotionCodes}:{})
        }:{active:n==='paylink_activate'};
        await s.paymentLinks.update(a.linkId,payload,opts);
      }else if(n==='portal_create_session'){
        const urls=ownerUrls(ctx);
        created=await s.billingPortal.sessions.create({
          customer:before.id,return_url:urls.portal,
          ...(a.configId?{configuration:a.configId}:{})
        },opts);
      }else if(n==='portal_update_configuration'){
        const features=Object.fromEntries(Object.entries(featureMap)
          .filter(([key])=>a[key]!==undefined)
          .map(([key,prop])=>[prop,{enabled:a[key]}]));
        await s.billingPortal.configurations.update(a.configId,{features},opts);
      }
    },
    readAfter:async(a,ctx)=>{
      const s=await getStripe(ctx),n=def.name;
      if(n==='checkout_create_payment_link_for_customer'||n==='checkout_create_setup_link')
        return created?.id?s.checkout.sessions.retrieve(created.id):null;
      if(n==='paylink_create')return created?.id?s.paymentLinks.retrieve(created.id):null;
      if(n==='portal_create_session'){
        // Stripe has no portal-session GET. Independently verify the selected
        // customer-portal config and the provider-returned session's identity.
        const cfg=created?.configuration;
        if(!created||!cfg)return null;
        const checked=await s.billingPortal.configurations.retrieve(
          typeof cfg==='string'?cfg:cfg.id);
        return {...created,_configReadback:checked};
      }
      return beforeFor(def,a,s);
    },
    verify:async(b,after,a)=>{
      if(!after)return false;
      switch(def.name){
        case 'checkout_create_payment_link_for_customer':
        case 'checkout_create_setup_link':
          return after.id===created?.id&&after.customer===b.id&&
            after.mode===(def.name==='checkout_create_setup_link'?'setup':'payment')&&
            hosted(after.url)&&
            (!Object.keys(b._checkoutBrand?.branding??{}).length||
              Object.entries(b._checkoutBrand.branding).every(([k,v])=>
                JSON.stringify(after.branding_settings?.[k])===JSON.stringify(v)));
        case 'checkout_expire':return after.status==='expired';
        case 'paylink_create':return after.id===created?.id&&hosted(after.url)&&after.active===true;
        case 'paylink_update':return a.metadata?
          Object.entries(a.metadata).every(([k,v])=>
            v===''?!Object.hasOwn(after.metadata??{},k):after.metadata?.[k]===v)&&
            (a.allowPromotionCodes===undefined||after.allow_promotion_codes===a.allowPromotionCodes):
            after.allow_promotion_codes===a.allowPromotionCodes;
        case 'paylink_activate':return after.active===true;
        case 'paylink_deactivate':return after.active===false;
        case 'portal_create_session':
          return after.id===created?.id&&after.customer===b.id&&hosted(after.url)&&
            after._configReadback?.id===(typeof created.configuration==='string'?
              created.configuration:created.configuration?.id);
        case 'portal_update_configuration':
          return Object.entries(featureMap).every(([key,prop])=>a[key]===undefined||
            after.features?.[prop]?.enabled===a[key]);
        default:return false;
      }
    }
  });
  return {...op,handler:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('TEST-only hosted operation');
    const response=await op.handler(a,ctx),part=response.content?.[0];
    if(part?.type!=='text')return response;
    let result;try{result=JSON.parse(part.text);}catch{return response;}
    if(result.done===true&&created?.url&&hosted(created.url))
      result={...result,url:created.url};
    return {...response,content:[{type:'text',text:JSON.stringify(result)}]};
  }};
}
export const tools=defs.map(def=>{
  const op=build(def);
  return {...op.tool,description:def.desc,area:'checkout',
    profiles:def.full?full:p,annotations:{destructiveHint:def.destructive===true},
    inputSchema:{type:'object',properties:{...def.props,dryRun:{type:'boolean'},
      confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
      required:def.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(defs.map(def=>[def.name,async(a,ctx)=>{
  const s=await getStripe(ctx);
  return build(def).handler(a,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
}]));
export function makeCheckoutWrite(name){
  const def=defs.find(x=>x.name===name);
  if(!def)throw new TypeError('Unknown hosted write');
  return build(def);
}
