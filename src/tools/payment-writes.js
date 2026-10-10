// Native TEST payment/refund writes. No raw payment methods or client secrets.
import {defineWrite,gone} from './write.js';
import {APP_METADATA_KEYS} from './app-guard.js';
const profiles=['everyday','full'], full=['full'];
const id=p=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'});
const text=n=>({type:'string',minLength:1,maxLength:n});
const cents={type:'integer',minimum:1,maximum:100000000};
const metadata={type:'object',additionalProperties:{type:'string'}};
const own={outsideApp:{type:'boolean'}};
const defs=[
  {name:'payment_charge_saved_method',desc:'Charge one verified default saved TEST method, after preview and confirmation.',
    props:{customerId:id('cus'),amountCents:cents,description:text(150),...own},
    required:['customerId','amountCents','description'],money:'in'},
  {name:'payment_capture',desc:'Capture a verified TEST authorization (full or partial).',
    props:{paymentId:id('pi'),amountCents:cents,...own},required:['paymentId'],money:'in'},
  {name:'payment_cancel',desc:'Cancel an eligible TEST payment intent.',
    props:{paymentId:id('pi'),...own},required:['paymentId']},
  {name:'payment_update',desc:'Update TEST payment description, receipt email or metadata.',
    props:{paymentId:id('pi'),description:text(500),receiptEmail:text(512),metadata,...own},
    required:['paymentId']},
  {name:'charge_update',desc:'Update TEST charge description, receipt email or metadata.',
    props:{chargeId:id('ch'),description:text(500),receiptEmail:text(512),metadata,...own},
    required:['chargeId']},
  {name:'payment_create_refund',desc:'Refund a verified remaining TEST charge amount; independent owner consent required.',
    props:{chargeId:id('ch'),paymentId:id('pi'),amountCents:cents,
      reason:{type:'string',enum:['duplicate','fraudulent','requested_by_customer']},...own},
    required:[],money:'out'},
  {name:'payment_update_refund',desc:'Update an existing TEST refund’s metadata.',
    props:{refundId:id('re'),metadata,...own},required:['refundId']},
  {name:'payment_cancel_refund',desc:'Cancel a TEST refund only in requires_action state.',
    props:{refundId:id('re'),...own},required:['refundId'],destructive:true},
  {name:'setup_cancel',desc:'Cancel an eligible TEST setup intent.',
    props:{setupId:id('seti'),...own},required:['setupId']}
];
const pattern=(value,prefix)=>typeof value==='string'&&
  new RegExp('^'+prefix+'_[A-Za-z0-9]{2,100}$').test(value);
const getStripe=ctx=>{
  if(ctx?.connection?.mode!=='test'||typeof ctx?.services?.stripeForConnection!=='function')
    throw new Error('TEST Stripe provider unavailable');
  return ctx.services.stripeForConnection(ctx.connection);
};
function validate(def,a){
  if(!a||typeof a!=='object'||Array.isArray(a))throw new TypeError('Write arguments required');
  for(const k of def.required)if(a[k]===undefined)throw new TypeError('Missing '+k);
  for(const [k,v] of Object.entries(a)){
    if(['confirm','dryRun','requestKey'].includes(k))continue;
    const prop=def.props[k];
    if(!prop)throw new TypeError('Unsupported write parameter '+k);
    if(prop.type==='string'&&(typeof v!=='string'||v.length>(prop.maxLength??110)||
      (prop.minLength&&v.length<prop.minLength)||
      (prop.pattern&&!new RegExp(prop.pattern).test(v))||
      (prop.enum&&!prop.enum.includes(v))))throw new TypeError('Invalid '+k);
    if(prop.type==='integer'&&(!Number.isSafeInteger(v)||v<1||v>100000000))
      throw new TypeError('Invalid amount cents');
    if(prop.type==='boolean'&&typeof v!=='boolean')throw new TypeError('Invalid '+k);
    if(prop.type==='object'&&(!v||Array.isArray(v)||typeof v!=='object'||
      Object.keys(v).length>20||Object.entries(v).some(([name,value])=>
        !/^[A-Za-z0-9_-]{1,40}$/.test(name)||APP_METADATA_KEYS.includes(name)||
        ['__proto__','constructor','prototype'].includes(name)||
        typeof value!=='string'||value.length>200)))
      throw new TypeError('Invalid or app-owned metadata');
  }
  if(def.name==='payment_create_refund'&&
    (!!a.chargeId===!!a.paymentId))throw new TypeError('Choose one charge or payment target');
  if(a.requestKey!==undefined&&(typeof a.requestKey!=='string'||!a.requestKey||
    a.requestKey.length>128))throw new TypeError('Invalid request key');
  if(def.name==='payment_update'||def.name==='charge_update'||
    def.name==='payment_update_refund'){
    if(!['description','receiptEmail','metadata'].some(k=>a[k]!==undefined))
      throw new TypeError('At least one update field required');
    if(def.name==='payment_update_refund'&&
      (a.description!==undefined||a.receiptEmail!==undefined))
      throw new TypeError('Only refund metadata is editable');
  }
}
const same=(after,args,props)=>props.every(k=>args[k]===undefined||
  (k==='metadata'?Object.entries(args.metadata).every(([name,v])=>after.metadata?.[name]===v)
    :k==='receiptEmail'?after.receipt_email===args[k]
      :after[k]===args[k]));
async function target(def,a,s){
  switch(def.name){
    case 'payment_charge_saved_method':{
      const c=await s.customers.retrieve(a.customerId);
      const pm=typeof c.invoice_settings?.default_payment_method==='string'?
        c.invoice_settings.default_payment_method:c.invoice_settings?.default_payment_method?.id;
      if(c.deleted||!pattern(pm,'pm'))
        throw new TypeError('Customer has no verified default saved payment method');
      const saved=await s.paymentMethods.retrieve(pm);
      if(saved.customer!==c.id)throw new TypeError('Default method is not attached to this customer');
      return {...c,_defaultMethod:pm};
    }
    case 'payment_capture':
    case 'payment_cancel':
    case 'payment_update':
      return s.paymentIntents.retrieve(a.paymentId);
    case 'charge_update':
      return s.charges.retrieve(a.chargeId);
    case 'payment_create_refund':{
      let chargeId=a.chargeId;
      if(a.paymentId){
        const pi=await s.paymentIntents.retrieve(a.paymentId);
        chargeId=typeof pi.latest_charge==='string'?pi.latest_charge:pi.latest_charge?.id;
        if(!pattern(chargeId,'ch'))throw new TypeError('Payment has no refundable charge');
      }
      const ch=await s.charges.retrieve(chargeId);
      const remaining=ch.amount-(ch.amount_refunded??0);
      if(ch.paid!==true||ch.refunded===true||ch.currency!=='usd'||
        !Number.isSafeInteger(remaining)||remaining<=0||remaining>100000000)
        throw new TypeError('Charge has no verified refundable USD remainder');
      if(a.amountCents!==undefined&&a.amountCents>remaining)
        throw new TypeError('Refund exceeds remaining refundable cents');
      return {...ch,_refundableCents:remaining};
    }
    case 'payment_update_refund':
    case 'payment_cancel_refund':
      return s.refunds.retrieve(a.refundId);
    case 'setup_cancel':
      return s.setupIntents.retrieve(a.setupId);
    default:throw new TypeError('Unknown payment operation');
  }
}
function build(def){
  let created=null;
  const op=defineWrite({
    name:def.name,
    read:async(a,ctx)=>{validate(def,a);return target(def,a,await getStripe(ctx));},
    summarize:async(before,a)=>'TEST MODE. '+def.name+' for '+(before.id||'payment')+
      '; fields: '+Object.keys(a).filter(k=>!['confirm','dryRun','requestKey','outsideApp'].includes(k))
        .join(', ')+'. Verify Stripe read-back before marking complete.'+
      (def.destructive?' This action may be irreversible.':''),
    money:def.money?async(a,_ctx,b)=>{
      const amount=def.name==='payment_capture'?
        a.amountCents??b.amount_capturable:
        def.name==='payment_create_refund'?
          a.amountCents??b._refundableCents:a.amountCents;
      return {amountCents:amount,currency:'usd',direction:def.money,
        targetId:b.id,description:def.name==='payment_create_refund'?
          'Refund verified remaining charge amount':def.name==='payment_capture'?
          'Capture authorized customer payment':'Charge default saved payment method'};
    }:undefined,
    appOwnedRefundAllowed:def.name==='payment_create_refund',
    targetGuard:(a,_ctx,b)=>{
      if(b.deleted)return 'Deleted Stripe target';
      if(def.name==='payment_capture'&&
        (b.status!=='requires_capture'||b.currency!=='usd'||!Number.isSafeInteger(b.amount_capturable)||
          b.amount_capturable<=0||a.amountCents>b.amount_capturable))
        return 'No verified capturable USD amount';
      if(def.name==='payment_cancel'&&b.status==='canceled')
        return 'Payment already canceled';
      if(def.name==='payment_cancel_refund'&&b.status!=='requires_action')
        return 'Refund cancellation allowed only for requires_action';
      if(def.name==='setup_cancel'&&['succeeded','canceled'].includes(b.status))
        return 'Completed setup cannot be canceled';
      return true;
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await getStripe(ctx),opts={idempotencyKey};
      const payload=Object.fromEntries(
        ['description','receiptEmail','metadata'].filter(k=>a[k]!==undefined)
          .map(k=>[k==='receiptEmail'?'receipt_email':k,a[k]]));
      switch(def.name){
        case 'payment_charge_saved_method':
          created=await s.paymentIntents.create({amount:a.amountCents,currency:'usd',
            customer:a.customerId,payment_method:(await s.customers.retrieve(a.customerId))
              .invoice_settings.default_payment_method,description:a.description,
            confirm:true,off_session:true},opts);break;
        case 'payment_capture':
          await s.paymentIntents.capture(a.paymentId,{
            ...(a.amountCents?{amount_to_capture:a.amountCents}:{})},opts);break;
        case 'payment_cancel':await s.paymentIntents.cancel(a.paymentId,{},opts);break;
        case 'payment_update':await s.paymentIntents.update(a.paymentId,payload,opts);break;
        case 'charge_update':await s.charges.update(a.chargeId,payload,opts);break;
        case 'payment_create_refund':
          created=await s.refunds.create({charge:a.chargeId||undefined,
            payment_intent:a.paymentId||undefined,
            ...(a.amountCents?{amount:a.amountCents}:{}),
            ...(a.reason?{reason:a.reason}:{})},opts);break;
        case 'payment_update_refund':await s.refunds.update(a.refundId,{metadata:a.metadata},opts);break;
        case 'payment_cancel_refund':await s.refunds.cancel(a.refundId,{},opts);break;
        case 'setup_cancel':await s.setupIntents.cancel(a.setupId,{},opts);break;
      }
    },
    readAfter:async(a,ctx)=>{
      const s=await getStripe(ctx);
      if(def.name==='payment_charge_saved_method')return created?.id?
        s.paymentIntents.retrieve(created.id):null;
      if(def.name==='payment_create_refund')return created?.id?
        s.refunds.retrieve(created.id):null;
      return target(def,a,s);
    },
    verify:async(_before,after,a)=>{
      if(!after)return false;
      switch(def.name){
        case 'payment_charge_saved_method':
          return after.id===created?.id&&['succeeded','processing'].includes(after.status)&&
            after.amount===a.amountCents;
        case 'payment_capture':
          return ['succeeded','processing'].includes(after.status);
        case 'payment_cancel':case 'setup_cancel':return after.status==='canceled';
        case 'payment_update':case 'charge_update':
          return same(after,a,['description','receiptEmail','metadata']);
        case 'payment_create_refund':
          return after.id===created?.id&&after.charge===_before.id&&
            after.amount===(a.amountCents??_before._refundableCents);
        case 'payment_update_refund':return same(after,a,['metadata']);
        case 'payment_cancel_refund':return after.status==='canceled';
        default:return false;
      }
    }
  });
  return {...op,handler:(a,ctx)=>ctx?.connection?.mode==='test'?
    op.handler(a,ctx):gone('TEST-only payment and refund operation')};
}
export const tools=defs.map(def=>{
  const op=build(def);
  return {...op.tool,area:'payments',profiles:def.name==='payment_cancel_refund'?full:profiles,
    description:def.desc,moneyOut:def.money==='out',
    inputSchema:{type:'object',properties:{...def.props,dryRun:{type:'boolean'},
      confirm:{type:'boolean'},requestKey:{type:'string',minLength:1,maxLength:128}},
      required:def.required,additionalProperties:false},
    annotations:{destructiveHint:def.destructive===true}};
});
export const handlers=Object.fromEntries(defs.map(def=>[def.name,async(a,ctx)=>{
  const s=await getStripe(ctx);
  return build(def).handler(a,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
}]));
export function makePaymentWrite(name){
  const def=defs.find(d=>d.name===name);
  if(!def)throw new TypeError('Unknown payment write');
  return build(def);
}
