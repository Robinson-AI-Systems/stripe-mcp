// Guarded native TEST subscription mutations; Stripe is the sole billing authority.
import {defineWrite,gone} from './write.js';
import {client,ref,checkId,id,quantity,timestamp,proration,ownership,
  optionalMetadata,validateFields,ensureSubscription,safeRecurringPrice,
  positiveTotal,previewSafe,previewChange,writeProfiles}
  from './billing-shared.js';

const text=n=>({type:'string',minLength:1,maxLength:n});
const common={...ownership};
const sub={subscriptionId:id('sub')};
const defs=[
  {name:'billing_create_subscription',desc:'Start a verified TEST recurring USD subscription on an existing saved payment method.',
    props:{customerId:id('cus'),priceId:id('price'),quantity,
      billingMode:{type:'string',enum:['flexible','classic']},...common},
    required:['customerId','priceId','quantity','billingMode'],money:true},
  {name:'billing_update_subscription',desc:'Edit TEST subscription metadata, description, saved method or explicit billing anchor.',
    props:{...sub,description:text(500),metadata:optionalMetadata,
      defaultPaymentMethod:id('pm'),billingAnchor:{type:'string',enum:['now','unchanged']},
      prorationBehavior:proration,effectiveAt:timestamp,...common},
    required:['subscriptionId']},
  {name:'billing_change_plan',desc:'Change a TEST subscription item price or quantity after exact invoice preview.',
    props:{...sub,itemId:id('si'),priceId:id('price'),quantity,
      effectiveAt:timestamp,prorationBehavior:proration,...common},
    required:['subscriptionId','itemId','effectiveAt','prorationBehavior'],money:true},
  {name:'billing_cancel_subscription',desc:'Cancel a TEST subscription now or schedule cancellation at an item period end.',
    props:{...sub,timing:{type:'string',enum:['now','period_end']},
      invoiceNow:{type:'boolean'},prorate:{type:'boolean'},...common},
    required:['subscriptionId','timing'],destructive:true},
  {name:'billing_undo_cancel',desc:'Undo scheduled TEST period-end cancellation without resurrecting canceled subscriptions.',
    props:{...sub,...common},required:['subscriptionId']},
  {name:'billing_pause_collection',desc:'Pause TEST subscription collection with explicit invoice behavior.',
    props:{...sub,behavior:{type:'string',
      enum:['keep_as_draft','mark_uncollectible','void']},
      resumesAt:timestamp,...common},required:['subscriptionId','behavior'],destructive:true},
  {name:'billing_resume_collection',desc:'Resume TEST subscription invoice collection after confirmation.',
    props:{...sub,...common},required:['subscriptionId']}
];
const allowedStatuses=new Set(['active','trialing','past_due','unpaid']);
function validate(def,a){
  validateFields(a,def.props,def.required);
  if(def.name==='billing_update_subscription'){
    if(!['metadata','description','defaultPaymentMethod','billingAnchor'].some(k=>a[k]!==undefined))
      throw new TypeError('Provide a subscription change');
    if(a.billingAnchor==='now'&&(a.prorationBehavior===undefined||a.effectiveAt===undefined))
      throw new TypeError('Billing anchor change requires exact proration and effective date');
    if(a.billingAnchor!=='now'&&(a.prorationBehavior!==undefined||a.effectiveAt!==undefined))
      throw new TypeError('Proration settings require resetting the billing anchor');
  }
  if(def.name==='billing_change_plan'&&!a.priceId&&a.quantity===undefined)
    throw new TypeError('Supply a new price or quantity');
  if(def.name==='billing_cancel_subscription'&&a.timing==='period_end'&&
    (a.invoiceNow!==undefined||a.prorate!==undefined))
    throw new TypeError('Final-invoice and proration choices apply only to immediate cancellation');
  if(def.name==='billing_cancel_subscription'&&a.timing==='now'&&
    (a.invoiceNow===undefined||a.prorate===undefined))
    throw new TypeError('State immediate cancellation invoiceNow and prorate explicitly');
}
function currentItem(before,id){
  const item=before.items.data.find(x=>x.id===id);
  if(!item)throw new TypeError('Item not part of this subscription');
  return item;
}
async function preflight(def,a,s){
  const n=def.name;
  if(n==='billing_create_subscription'){
    const customer=await s.customers.retrieve(checkId(a.customerId,'cus'));
    if(customer.deleted)throw new TypeError('Customer was deleted');
    const saved=ref(customer.invoice_settings?.default_payment_method);
    if(!saved)throw new TypeError('Customer needs a default saved payment method');
    const method=await s.paymentMethods.retrieve(checkId(saved,'pm'));
    if(ref(method.customer)!==customer.id)
      throw new TypeError('Customer saved payment method ownership unverified');
    const price=safeRecurringPrice(await s.prices.retrieve(checkId(a.priceId,'price')));
    const invoice=await s.invoices.createPreview({
      customer:customer.id,currency:'usd',
      subscription_details:{items:[{price:price.id,quantity:a.quantity}],
        billing_mode:{type:a.billingMode},proration_behavior:'none'}
    });
    const total=positiveTotal(invoice);
    return {...customer,_price:price,_defaultMethod:saved,
      _preview:previewSafe(invoice,null,'none'),_previewTotal:total};
  }
  const before=ensureSubscription(await s.subscriptions.retrieve(checkId(a.subscriptionId,'sub')));
  if(n==='billing_change_plan'){
    const item=currentItem(before,checkId(a.itemId,'si'));
    if(a.priceId)await safeRecurringPrice(await s.prices.retrieve(checkId(a.priceId,'price')));
    const target={id:item.id,price:a.priceId??ref(item.price),
      quantity:a.quantity??item.quantity};
    before._proposal=target;
    before._preview=await previewChange(s,before,[target],a.effectiveAt,a.prorationBehavior);
  }
  if(n==='billing_update_subscription'&&a.defaultPaymentMethod){
    const method=await s.paymentMethods.retrieve(checkId(a.defaultPaymentMethod,'pm'));
    if(ref(method.customer)!==ref(before.customer))
      throw new TypeError('Method is not saved on subscription customer');
  }
  if(n==='billing_update_subscription'&&a.billingAnchor==='now'){
    before._preview=await previewChange(s,before,before.items.data.map(i=>({
      id:i.id,price:ref(i.price),quantity:i.quantity
    })),a.effectiveAt,a.prorationBehavior,{billingAnchor:'now'});
  }
  if(n==='billing_cancel_subscription'&&a.timing==='now'&&a.prorate){
    // Final invoice behavior can issue credits: fail closed if provider preview
    // cannot establish a safe USD amount. No guessed final amount.
    const invoice=await s.invoices.createPreview({subscription:before.id,
      customer:ref(before.customer),currency:'usd',
      subscription_details:{cancel_now:true,proration_behavior:'create_prorations'}});
    before._preview=previewSafe(invoice,null,'create_prorations');
  }
  return before;
}
export function previewMoney(p,what,target){
  if(!p||p.currency!=='usd')throw new TypeError('Verified financial preview unavailable');
  const credit=(p.prorationLines??[]).filter(l=>l.amountCents<0)
    .reduce((n,l)=>n-l.amountCents,0);
  if(credit>0)return {amountCents:credit,currency:'usd',direction:'out',
    targetId:target,description:'Owner approval for Stripe subscription proration credits'};
  if(p.invoiceTotalCents===0)return null; // provider-confirmed no money movement
  if(!Number.isSafeInteger(p.invoiceTotalCents)||p.invoiceTotalCents<0)
    throw new TypeError('Unclassified invoice credit: refuse Stripe write');
  return {amountCents:p.invoiceTotalCents,currency:'usd',direction:'in',
    targetId:target,description:what};
}
function targetGuard(def,a,b){
  if(b.deleted)return 'Deleted customer or subscription';
  const n=def.name;
  if(n==='billing_create_subscription')
    return b._previewTotal<0?'Negative initial invoice is not supported':true;
  if(!allowedStatuses.has(b.status)&&n!=='billing_undo_cancel')
    return 'Subscription not in a mutable status';
  if(n==='billing_undo_cancel'&&
    (b.cancel_at_period_end!==true||b.status==='canceled'))
    return 'Only pending period-end cancellation can be undone';
  if(n==='billing_cancel_subscription'&&b.cancel_at_period_end&&a.timing==='period_end')
    return 'Already scheduled for cancellation';
  if(n==='billing_resume_collection'&&!b.pause_collection)
    return 'Collection is not paused';
  if(n==='billing_pause_collection'&&b.pause_collection)
    return 'Collection is already paused';
  return true;
}
function build(def){
  let created=null;
  const op=defineWrite({
    name:def.name,allowZeroPreview:true,
    read:async(a,ctx)=>{
      validate(def,a);
      const s=await client(ctx);
      return preflight(def,a,s);
    },
    summarize:async(b,a)=>{
      const p=b._preview;
      const amount=p?' Provider invoice preview: '+p.invoiceTotalCents+
        ' cents USD; proration '+p.prorationBehavior+
        '; effective '+(p.effectiveAt??'current provider billing period')+'.':'';
      return 'TEST MODE. '+def.name+' target '+b.id+'; billing mode '+
        (a.billingMode??b.billing_mode?.type??'provider existing')+
        '; parameters '+Object.keys(a)
          .filter(k=>!['confirm','dryRun','requestKey','outsideApp'].includes(k)).join(', ')+'.'+
        amount+' Confirmed only after Stripe read-back.';
    },
    money:(def.money||def.name==='billing_update_subscription'||def.name==='billing_cancel_subscription')?
      async(a,_ctx,b)=>{
        if(def.name==='billing_create_subscription')
          return previewMoney(b._preview,'First recurring customer invoice',b.id);
        if(def.name==='billing_change_plan')
          return previewMoney(b._preview,'Subscription item proration invoice',b.id);
        if(!b._preview)return null;
        return previewMoney(b._preview,'Subscription billing change',b.id);
      }:undefined,
    targetGuard:(a,_ctx,b)=>targetGuard(def,a,b),
    apply:async(a,ctx,{idempotencyKey,before:b})=>{
      const s=await client(ctx),opts={idempotencyKey};
      switch(def.name){
        case 'billing_create_subscription':
          created=await s.subscriptions.create({customer:b.id,
            items:[{price:b._price.id,quantity:a.quantity}],currency:'usd',
            collection_method:'charge_automatically',
            default_payment_method:b._defaultMethod,payment_behavior:'error_if_incomplete',
            billing_mode:{type:a.billingMode},proration_behavior:'none'},opts);
          break;
        case 'billing_update_subscription':
          await s.subscriptions.update(b.id,{
            ...(a.description!==undefined?{description:a.description}:{}),
            ...(a.metadata?{metadata:a.metadata}:{}),
            ...(a.defaultPaymentMethod?{default_payment_method:a.defaultPaymentMethod}:{}),
            ...(a.billingAnchor?{billing_cycle_anchor:a.billingAnchor,
              proration_behavior:a.prorationBehavior,
              ...(a.prorationBehavior==='none'?{}:{proration_date:a.effectiveAt}),
              payment_behavior:'error_if_incomplete'}:{})
          },opts);break;
        case 'billing_change_plan':
          await s.subscriptions.update(b.id,{
            items:[b._proposal],proration_behavior:a.prorationBehavior,
            ...(a.prorationBehavior==='none'?{}:{proration_date:a.effectiveAt}),
            payment_behavior:'error_if_incomplete'
          },opts);break;
        case 'billing_cancel_subscription':
          if(a.timing==='period_end')
            await s.subscriptions.update(b.id,{cancel_at_period_end:true},opts);
          else await s.subscriptions.cancel(b.id,{invoice_now:a.invoiceNow,prorate:a.prorate},opts);
          break;
        case 'billing_undo_cancel':
          await s.subscriptions.update(b.id,{cancel_at_period_end:false},opts);break;
        case 'billing_pause_collection':
          await s.subscriptions.update(b.id,{pause_collection:{behavior:a.behavior,
            ...(a.resumesAt?{resumes_at:a.resumesAt}:{})}},opts);break;
        case 'billing_resume_collection':
          await s.subscriptions.update(b.id,{pause_collection:''},opts);break;
        default:throw new TypeError('Unknown subscription write');
      }
    },
    readAfter:async(a,ctx)=>{
      const s=await client(ctx);
      if(def.name==='billing_create_subscription'){
        if(!created?.id)return null;
        return s.subscriptions.retrieve(created.id);
      }
      return s.subscriptions.retrieve(a.subscriptionId);
    },
    inverse:async(b,after,a)=>{
      const entry=(tool,args,expected,restored)=>({
        version:1,tool,args,readTool:'billing_get_subscription',
        readArgs:{subscriptionId:a.subscriptionId},expected,restored});
      if(def.name==='billing_cancel_subscription'&&a.timing==='period_end'&&
        b.cancel_at_period_end===false&&after.cancel_at_period_end===true)
        return entry('billing_undo_cancel',{subscriptionId:a.subscriptionId},
          {cancelAtPeriodEnd:true},{cancelAtPeriodEnd:false});
      if(def.name==='billing_undo_cancel'&&b.cancel_at_period_end===true&&
        after.cancel_at_period_end===false)
        return entry('billing_cancel_subscription',
          {subscriptionId:a.subscriptionId,timing:'period_end'},
          {cancelAtPeriodEnd:false},{cancelAtPeriodEnd:true});
      if(def.name==='billing_pause_collection'&&b.pause_collection==null&&
        after.pause_collection)
        return entry('billing_resume_collection',{subscriptionId:a.subscriptionId},
          {pauseCollection:after.pause_collection.behavior},{pauseCollection:null});
      if(def.name==='billing_resume_collection'&&b.pause_collection?.behavior&&
        after.pause_collection==null)
        return entry('billing_pause_collection',{subscriptionId:a.subscriptionId,
          behavior:b.pause_collection.behavior,
          ...(b.pause_collection.resumes_at?
            {resumesAt:b.pause_collection.resumes_at}:{})},
          {pauseCollection:null},{pauseCollection:b.pause_collection.behavior});
      return null;
    },
    verify:(b,after,a)=>{
      if(!after||!Array.isArray(after.items?.data))return false;
      switch(def.name){
        case 'billing_create_subscription':
          return after.id===created?.id&&ref(after.customer)===b.id&&
            after.currency==='usd'&&after.billing_mode?.type===a.billingMode&&
            after.items.data.some(i=>ref(i.price)===a.priceId&&i.quantity===a.quantity);
        case 'billing_update_subscription':
          return (a.description===undefined||after.description===a.description)&&
            (a.defaultPaymentMethod===undefined||
              ref(after.default_payment_method)===a.defaultPaymentMethod)&&
            (a.metadata===undefined||Object.entries(a.metadata).every(([k,v])=>
              after.metadata?.[k]===v))&&
            (a.billingAnchor!=='now'||after.billing_cycle_anchor!==b.billing_cycle_anchor);
        case 'billing_change_plan':
          return after.items.data.some(i=>i.id===a.itemId&&
            ref(i.price)===b._proposal.price&&i.quantity===b._proposal.quantity);
        case 'billing_cancel_subscription':
          return a.timing==='period_end'?
            after.cancel_at_period_end===true&&
            Number.isSafeInteger(after.cancel_at)&&
            after.items.data.some(i=>i.current_period_end<=after.cancel_at):
            after.status==='canceled';
        case 'billing_undo_cancel':
          return after.cancel_at_period_end===false&&after.cancel_at==null;
        case 'billing_pause_collection':
          return after.pause_collection?.behavior===a.behavior&&
            (a.resumesAt===undefined||after.pause_collection?.resumes_at===a.resumesAt);
        case 'billing_resume_collection':return after.pause_collection==null;
        default:return false;
      }
    }
  });
  return {...op,handler:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('TEST-only subscription mutation');
    return op.handler(a,ctx);
  }};
}
export const tools=defs.map(def=>{
  const op=build(def);
  return {...op.tool,area:'billing',
    profiles:['billing_create_subscription','billing_change_plan'].includes(def.name)?
      writeProfiles:writeProfiles,
    description:def.desc,annotations:{destructiveHint:def.destructive===true},
    inputSchema:{type:'object',properties:{...def.props,
      dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:def.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(defs.map(def=>[def.name,async(a,ctx)=>{
  const s=await client(ctx);
  return build(def).handler(a,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
}]));
export function makeBillingWrite(name){
  const def=defs.find(d=>d.name===name);
  if(!def)throw new TypeError('Unknown subscription write');
  return build(def);
}
