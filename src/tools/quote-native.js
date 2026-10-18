// E-4: authenticated native Quote reads and guarded quote lifecycle.
// A quote can lead to invoice/subscription/automatic collection; never infer payment.
import {defineWrite,gone} from './write.js';
import {allProfiles,fullProfiles,paging,pageResult,reply,fail,ref} from './billing-shared.js';
import {catalogClient,catalogMode} from './catalog-mode.js';
import {findAppOwnership} from './app-guard.js';

const txt=(max=180)=>({type:'string',minLength:1,maxLength:max});
const id=p=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'});
const bool={type:'boolean'},timer={type:'integer',minimum:946684800,maximum:4102444800};
const params={dryRun:bool,confirm:bool,requestKey:txt(128)};
const pg={limit:{type:'integer',minimum:1,maximum:100},starting_after:txt(110)};
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const metadata={type:'object',additionalProperties:{type:'string'}};
const lineItems={type:'array',minItems:1,maxItems:20,items:object({
  priceId:id('price'),quantity:{type:'integer',minimum:1,maximum:100000}},['priceId','quantity'])};
const args={
  quote_list:{...pg,customerId:id('cus'),status:{type:'string',enum:['draft','open','accepted','canceled']}},
  quote_get:{quoteId:id('qt')},
  quote_get_pdf_link:{quoteId:id('qt')},
  quote_create:{customerId:id('cus'),lineItems,description:txt(500),expiresAt:timer,metadata},
  quote_update:{quoteId:id('qt'),lineItems,description:txt(500),expiresAt:timer,metadata},
  quote_finalize:{quoteId:id('qt'),expiresAt:timer},
  quote_accept:{quoteId:id('qt')},
  quote_cancel:{quoteId:id('qt')}
};
const required={
  quote_get:['quoteId'],quote_get_pdf_link:['quoteId'],
  quote_create:['customerId','lineItems'],quote_update:['quoteId'],
  quote_finalize:['quoteId'],quote_accept:['quoteId'],quote_cancel:['quoteId']
};
const writes=new Set(['quote_create','quote_update','quote_finalize','quote_accept','quote_cancel']);
export const tools=Object.keys(args).map(name=>{
  const write=writes.has(name);
  return {...(write?defineWrite({name,read:async()=>({}),summarize:()=>name,
    apply:async()=>{},readAfter:async()=>({}),verify:()=>false}).tool:{}),
    name,area:'catalog',profiles:write?fullProfiles:allProfiles,writes:write,
    detailFieldsSupported:false,
    annotations:write?{destructiveHint:['quote_accept','quote_cancel'].includes(name)}:
      {readOnlyHint:true},
    description:({
      quote_get_pdf_link:'Return authenticated Quote Dashboard location for verified finalized quote; PDF requires authorized Stripe download, not a public URL.',
      quote_accept:'Accept exact open quote: may create an invoice/subscription or attempt incoming collection. Guarded and verified.',
      quote_cancel:'Cancel draft/open quote (not an invoice refund).'
    }[name]??name.replaceAll('_',' ')),
    inputSchema:object({...args[name],...(write?params:{})},required[name]??[])};
});
const err=m=>{throw new TypeError(m);};
const valid=(value,p)=>typeof value==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(value);
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const live=ctx=>ctx.connection.mode==='live';
function assert(a,name){
  if(!isObj(a)||(required[name]??[]).some(k=>a[k]===undefined)||
    Object.keys(a).some(k=>!Object.hasOwn({...args[name],...params},k)))
    err('Invalid quote fields');
  for(const [key,value] of Object.entries(a)){
    if(key==='quoteId'&&!valid(value,'qt')||
      key==='customerId'&&!valid(value,'cus'))err('Invalid quote/customer ID');
    if(key==='status'&&!['draft','open','accepted','canceled'].includes(value))
      err('Invalid quote status');
    if(['dryRun','confirm'].includes(key)&&typeof value!=='boolean')
      err('Invalid confirmation flag');
    if(['description','requestKey'].includes(key)&&
      (typeof value!=='string'||value.length<1||value.length>500||
        /[\x00-\x1f]/.test(value)))err('Invalid text');
    if(key==='expiresAt'&&(!Number.isSafeInteger(value)||value<=Date.now()/1000))
      err('Quote expiration must be a future timestamp');
    if(key==='metadata'&&(!isObj(value)||Object.keys(value).length>20||
      Object.entries(value).some(([k,v])=>!/^[A-Za-z0-9_-]{1,40}$/.test(k)||
        typeof v!=='string'||v.length>250||['__proto__','constructor','prototype'].includes(k))))
      err('Invalid or unsafe quote metadata');
    if(key==='lineItems'&&(!Array.isArray(value)||value.length<1||
      value.length>20||value.some(item=>!isObj(item)||
        Object.keys(item).some(k=>!['priceId','quantity'].includes(k))||
        !valid(item.priceId,'price')||!Number.isSafeInteger(item.quantity)||
        item.quantity<1||item.quantity>100000)))err('Only bounded existing price/quantity line items');
  }
  if(name==='quote_update'&&!['lineItems','description','expiresAt','metadata'].some(k=>a[k]!==undefined))
    err('Specify an actual mutable quote field');
}
function safe(q,ctx){
  if(!q||q.object!=='quote'||!valid(q.id,'qt')||q.livemode!==live(ctx))
    err('Stripe did not verify selected-mode quote');
  const customer=ref(q.customer);
  if(customer!==null&&!valid(customer,'cus'))err('Unexpected quote customer');
  if(!['draft','open','accepted','canceled'].includes(q.status))
    err('Unrecognized quote lifecycle state');
  return {id:q.id,status:q.status,customer,amountTotal:q.amount_total??null,
    amountSubtotal:q.amount_subtotal??null,currency:q.currency??null,
    description:q.description??null,expiresAt:q.expires_at??null,
    invoice:ref(q.invoice),subscription:ref(q.subscription),
    automaticTax:q.automatic_tax?.enabled===true,metadata:q.metadata??{},
    created:q.created??null,livemode:q.livemode};
}
async function customer(s,customerId,ctx){
  const c=await s.customers.retrieve(customerId);
  if(c?.object!=='customer'||c.deleted===true||c.livemode!==live(ctx)||
    c.id!==customerId)err('Customer not verifiable in selected mode');
  if(await findAppOwnership(c,ctx))err('App-owned or uncertain customer cannot be changed by quote tool');
  return c;
}
async function scope(ctx,source){
  if(!ctx.db?.listKnownAppsForAccount||!ctx.db?.getAppGuardScope)
    err('Application ownership registry unavailable');
  const [apps,status]=await Promise.all([
    ctx.db.listKnownAppsForAccount(ctx.connection.stripeAccount),
    ctx.db.getAppGuardScope(ctx.connection.stripeAccount)]);
  if(!Array.isArray(apps)||!['legacy','scoped'].includes(status))
    err('Application ownership scope unavailable');
  if(source){
    const s=await catalogClient(ctx);
    if(await findAppOwnership(source,{...ctx,getCustomer:id=>s.customers.retrieve(id)}))
      err('Application-owned or uncertain quote cannot be changed');
  }
}
async function checkedLines(a,s,ctx){
  if(!a.lineItems)return;
  for(const item of a.lineItems){
    const price=await s.prices.retrieve(item.priceId);
    if(price?.object!=='price'||price.id!==item.priceId||
      price.livemode!==live(ctx)||price.active!==true)
      err('Quote price is not verifiably active in selected mode');
    if(await findAppOwnership(price,ctx))err('Application-owned price refused');
    const productId=ref(price.product);
    if(!valid(productId,'prod'))err('Cannot resolve price product');
    const product=await s.products.retrieve(productId);
    if(product?.object!=='product'||product.livemode!==live(ctx)||
      await findAppOwnership(product,ctx))err('Application-owned or unverifiable product refused');
  }
}
const line=x=>({price:x.priceId,quantity:x.quantity});
const reads={
  quote_list:async(a,s,ctx)=>pageResult(await s.quotes.list({
    ...paging(a),...(a.customerId?{customer:a.customerId}:{}),
    ...(a.status?{status:a.status}:{})}),q=>safe(q,ctx)),
  quote_get:async(a,s,ctx)=>safe(await s.quotes.retrieve(a.quoteId),ctx),
  quote_get_pdf_link:async(a,s,ctx)=>{
    const q=safe(await s.quotes.retrieve(a.quoteId),ctx);
    if(!['open','accepted'].includes(q.status))
      err('Quote must be finalized before authenticated PDF retrieval');
    // Stripe's PDF endpoint returns a private binary stream, not a shareable URL.
    const path=(live(ctx)?'':'test/')+'quotes/'+encodeURIComponent(q.id);
    return {quoteId:q.id,status:q.status,
      dashboardUrl:'https://dashboard.stripe.com/'+path,
      download:'Stripe-authorized Dashboard PDF download required',
      publicPdfUrl:null,verifiedProvider:true};
  }
};
export const handlers=Object.fromEntries(Object.keys(reads).map(name=>[name,
  async(a={},ctx)=>{
    try{if(!catalogMode(ctx))return gone('Selected Stripe mode required');
      assert(a,name);return reply(await reads[name](a,await catalogClient(ctx),ctx));
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }]));
function makeWrite(name){
  let createdId=null;
  const op=defineWrite({
    name,resultId:(_b,v)=>v?.id??null,
    read:async(a,ctx)=>{
      createdId=null;assert(a,name);
      await scope(ctx);
      const s=await catalogClient(ctx);
      if(name==='quote_create'){
        await customer(s,a.customerId,ctx);
        await checkedLines(a,s,ctx);
        return {object:'quote',id:null,status:'draft',customer:a.customerId};
      }
      const q=await s.quotes.retrieve(a.quoteId);
      safe(q,ctx);await scope(ctx,q);
      if(q.customer)await customer(s,ref(q.customer),ctx);
      if(name==='quote_update'){
        if(q.status!=='draft')err('Only draft quotes are editable');
        await checkedLines(a,s,ctx);
      }else if(name==='quote_finalize'&&q.status!=='draft')
        err('Only draft quotes can be finalized');
      else if(name==='quote_accept'&&q.status!=='open')
        err('Only finalized open quotes can be accepted');
      else if(name==='quote_cancel'&&!['draft','open'].includes(q.status))
        err('Only draft/open quotes can be canceled');
      if(name==='quote_accept'&&(!Number.isSafeInteger(q.amount_total)||
        q.amount_total<0||typeof q.currency!=='string'||
        !/^[a-z]{3}$/.test(q.currency)))
        err('Quote acceptance requires exact provider totals and currency');
      return q;
    },
    summarize:(before,a,ctx)=>ctx.connection.mode.toUpperCase()+' MODE: '+name+
      '. Provider quote total '+(Number.isSafeInteger(before.amount_total)?
        before.amount_total+' minor units '+before.currency:'not yet finalized')+
      '. Quote total, tax and payment terms can change.'+
      (name==='quote_accept'?' Acceptance can create an invoice or subscription and initiate INCOMING collection.':'')+
      ' Verify exact quote/customer, preview with confirm:true and stable requestKey.'+
      ' This action never asserts that payment succeeded.',
    targetGuard:async()=>true,
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await catalogClient(ctx),opts={idempotencyKey};
      const payload=()=>({
        ...(a.lineItems?{line_items:a.lineItems.map(line)}:{}),
        ...(a.description!==undefined?{description:a.description}:{}),
        ...(a.expiresAt?{expires_at:a.expiresAt}:{}),
        ...(a.metadata?{metadata:a.metadata}:{})});
      let result;
      if(name==='quote_create')result=await s.quotes.create({
        customer:a.customerId,...payload()},opts);
      if(name==='quote_update')result=await s.quotes.update(a.quoteId,payload(),opts);
      if(name==='quote_finalize')result=await s.quotes.finalizeQuote(a.quoteId,
        ...(a.expiresAt?[{expires_at:a.expiresAt},opts]:[{},opts]));
      if(name==='quote_accept')result=await s.quotes.accept(a.quoteId,{},opts);
      if(name==='quote_cancel')result=await s.quotes.cancel(a.quoteId,{},opts);
      createdId=result?.id??null;
    },
    readAfter:async(a,ctx)=>{
      const s=await catalogClient(ctx);
      const quoteId=name==='quote_create'?createdId:a.quoteId;
      if(!valid(quoteId,'qt'))return null;
      const q=await s.quotes.retrieve(quoteId);
      if(['quote_create','quote_update'].includes(name)&&a.lineItems){
        const lines=await s.quotes.listLineItems(quoteId,{limit:100});
        return {...q,line_items:lines};
      }
      return q;
    },
    verify:async(before,after,a,ctx)=>{
      const q=safe(after,ctx);
      if(name==='quote_create'&&(q.id!==createdId||q.customer!==a.customerId||
        q.status!=='draft'))return false;
      if(name!=='quote_create'&&q.id!==a.quoteId)return false;
      if(name==='quote_finalize'&&q.status!=='open'||name==='quote_accept'&&
        (q.status!=='accepted'||q.amountTotal!==before.amount_total||
          q.currency!==before.currency||q.customer!==ref(before.customer))||
        name==='quote_cancel'&&q.status!=='canceled')return false;
      if(['quote_create','quote_update'].includes(name)){
        if(a.description!==undefined&&q.description!==a.description||
          a.expiresAt!==undefined&&q.expiresAt!==a.expiresAt||
          a.metadata!==undefined&&Object.entries(a.metadata).some(([k,v])=>
            q.metadata?.[k]!==v))return false;
        // Verify provider line-item count and exact selected prices instead of
        // claiming a total from local arithmetic (tax/discounts may vary).
        if(a.lineItems){
          if(!Array.isArray(after.line_items?.data)||
            after.line_items.has_more===true||
            after.line_items.data.length!==a.lineItems.length)return false;
          for(const item of a.lineItems){
            if(!after.line_items.data.some(row=>
              ref(row.price)===item.priceId&&row.quantity===item.quantity))
              return false;
          }
        }
      }
      return true;
    }
  });
  return async(a,ctx)=>{
    try{if(!catalogMode(ctx))return gone('Selected mode required');
      return await op.handler(a,ctx);
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  };
}
for(const name of writes)handlers[name]=makeWrite(name);
