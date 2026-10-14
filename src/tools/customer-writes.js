// Customer TEST writes: all calls are through the shared owner-safe defineWrite contract.
import {defineWrite,gone} from './write.js';
import {APP_METADATA_KEYS} from './app-guard.js';
const profiles=['everyday','full'],full=['full'];
const id={type:'string',pattern:'^cus_[A-Za-z0-9]{2,100}$'};
const txt=(max=200)=>({type:'string',minLength:1,maxLength:max});
const common={customerId:id,outsideApp:{type:'boolean'}};
const addressFields=['line1','line2','city','state','postal_code','country'];
const address={type:'object',properties:Object.fromEntries(addressFields.map(k=>[
  k,txt(k==='country'?2:k==='postal_code'?40:200)])),additionalProperties:false};
const balanceCents={type:'integer',minimum:1,maximum:100000000};
const plans=[
  {name:'customer_create',description:'Create a TEST customer with verified fields and read-back.',
    props:{name:txt(),email:txt(512),phone:txt(),description:txt(500),
      metadata:{type:'object',additionalProperties:{type:'string'}}},required:[]},
  {name:'customer_update',description:'Update an existing TEST customer after ownership and field checks.',
    props:{...common,name:txt(),email:txt(512),phone:txt(),description:txt(500),address,
      metadata:{type:'object',additionalProperties:{type:'string'}}},required:['customerId']},
  {name:'customer_delete',description:'Delete a TEST customer after final confirmation; irreversible.',
    props:common,required:['customerId'],full:true,destructive:true},
  {name:'customer_remove_payment_method',description:'Detach a TEST customer payment method after checking ownership.',
    props:{...common,paymentMethodId:{type:'string',pattern:'^pm_[A-Za-z0-9]{2,100}$'}},
    required:['customerId','paymentMethodId'],destructive:true},
  {name:'customer_set_default_payment_method',description:'Set a saved TEST method as invoice default for one customer.',
    props:{...common,paymentMethodId:{type:'string',pattern:'^pm_[A-Za-z0-9]{2,100}$'}},
    required:['customerId','paymentMethodId']},
  {name:'customer_add_balance_credit',description:'Credit a TEST customer balance with an independently owner-approved USD amount.',
    props:{...common,creditCents:balanceCents,debitCents:balanceCents,
      description:txt(150)},required:['customerId','description'],money:true},
  {name:'customer_add_tax_id',description:'Add a TEST customer tax ID after reviewing its tax type.',
    props:{...common,type:txt(30),value:txt(100)},required:['customerId','type','value']},
  {name:'customer_delete_tax_id',description:'Delete a TEST customer tax ID after review.',
    props:{...common,taxId:{type:'string',pattern:'^txi_[A-Za-z0-9]{2,100}$'}},
    required:['customerId','taxId'],destructive:true},
  {name:'customer_remove_discount',description:'Remove a TEST customer-level coupon after ownership check.',
    props:common,required:['customerId'],destructive:true}
];
const safeId=(v,kind)=>typeof v==='string'&&new RegExp('^'+kind+'_[A-Za-z0-9]{2,100}$').test(v);
const getClient=async ctx=>{
  if(ctx?.connection?.mode!=='test'||typeof ctx?.services?.stripeForConnection!=='function')
    throw new Error('TEST Stripe customer write provider unavailable');
  return ctx.services.stripeForConnection(ctx.connection);
};
function permittedArgs(def,args){
  if(!args||typeof args!=='object'||Array.isArray(args))
    throw new TypeError('Expected customer arguments');
  for(const name of def.required)if(args[name]===undefined||args[name]===null)
    throw new TypeError('Missing '+name);
  const fields=Object.keys(def.props);
  for(const [k,v] of Object.entries(args)){
    if(['dryRun','confirm','requestKey'].includes(k))continue;
    if(!fields.includes(k))throw new TypeError('Unsupported customer field '+k);
    const rule=def.props[k];
    if(rule.type==='string'&&(typeof v!=='string'||!v||v.length>(rule.maxLength??110)||
       (rule.pattern&&!new RegExp(rule.pattern).test(v))))
      throw new TypeError('Invalid customer field '+k);
    if(rule.type==='integer'&&(!Number.isSafeInteger(v)||v<(rule.minimum??0)||
      v>(rule.maximum??Number.MAX_SAFE_INTEGER)))
      throw new TypeError('Invalid customer cents');
    if(rule.type==='boolean'&&typeof v!=='boolean')throw new TypeError('Invalid outsideApp');
    if(rule.type==='object'&&(!v||Array.isArray(v)||typeof v!=='object'||
      Object.keys(v).length>20||Object.keys(v).some(key=>!/^[A-Za-z0-9_-]{1,40}$/.test(key)||
        ['__proto__','prototype','constructor'].includes(key)||
        typeof v[key]!=='string'||v[key].length>200)))
      throw new TypeError('Invalid customer metadata');
  }
  if(args.address){
    if(Object.keys(args.address).length===0||
      Object.keys(args.address).some(k=>!addressFields.includes(k))||
      (args.address.country!==undefined&&!/^[A-Z]{2}$/.test(args.address.country)))
      throw new TypeError('Invalid bounded Stripe customer address');
  }
  if(def.money&&(!!args.creditCents===!!args.debitCents))
    throw new TypeError('Choose exactly one creditCents or debitCents amount');
  if(args.requestKey!==undefined&&(typeof args.requestKey!=='string'||
    args.requestKey.length<1||args.requestKey.length>128))
    throw new TypeError('Invalid idempotency request key');
  if(args.metadata&&Object.keys(args.metadata).some(k=>APP_METADATA_KEYS.includes(k)))
    throw new TypeError('App-owned metadata cannot be created or overwritten by the general connector');
  if(def.name==='customer_create'&&!['name','email','phone'].some(k=>args[k]))
    throw new TypeError('At least one customer identifier required');
  if(args.customerId&&!safeId(args.customerId,'cus'))throw new TypeError('Valid customer ID required');
}
const changed=(obj,args,keys)=>keys.every(k=>args[k]===undefined||
  (['metadata','address'].includes(k)
    ? Object.entries(args[k]).every(([p,v])=>obj[k]?.[p]===v)
    :obj[k]===args[k]));
function build(def){
  let created=null;
  const operation=defineWrite({
    name:def.name,
    // Every customer write returns the customer ID for customer_get follow-up.
    // Related payment method, balance transaction and tax IDs must never
    // masquerade as customer IDs in the common receipt field.
    resultId:(_before,observed,args)=>def.name==='customer_create'?observed?.id:args.customerId,
    read:async(a,ctx)=>{
      permittedArgs(def,a);
      if(def.name==='customer_create')return {id:null,metadata:{}};
      const s=await getClient(ctx);
      if(def.name==='customer_remove_payment_method'){
        const pm=await s.paymentMethods.retrieve(a.paymentMethodId);
        if(pm.customer!==a.customerId)throw new TypeError('Payment method belongs to another customer');
      }
      if(def.name==='customer_set_default_payment_method'){
        const pm=await s.paymentMethods.retrieve(a.paymentMethodId);
        if(pm.customer!==a.customerId)throw new TypeError('Method is not attached to selected customer');
      }
      if(def.name==='customer_delete_tax_id')return {...await s.customers.retrieve(a.customerId),
        _taxId:await s.customers.retrieveTaxId(a.customerId,a.taxId)};
      return s.customers.retrieve(a.customerId);
    },
    summarize:async(_b,a)=>'TEST MODE. '+def.name+' on '+
      (a.customerId||'a new customer')+'; proposed fields: '+
      Object.keys(a).filter(k=>!['dryRun','confirm','requestKey','outsideApp'].includes(k))
        .join(', ')+'. Independently verify the provider read-back.'+
      (def.destructive?' WARNING: destructive action may not be reversible.':''),
    money:def.money?async(a,_ctx,b)=>({
      amountCents:a.creditCents??a.debitCents,currency:'usd',direction:'out',targetId:b.id,
      description:(a.creditCents?'Customer credit: ':'Customer debit: ')+a.description}):undefined,
    targetGuard:(a,_ctx,b)=>{
      if(b.deleted)return 'Deleted customer cannot be modified';
      if(def.name==='customer_delete_tax_id'&&b._taxId?.deleted)return 'Tax ID already deleted';
      return true;
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await getClient(ctx),opts={idempotencyKey};
      const n=def.name;
      const payload=Object.fromEntries(['name','email','phone','description','metadata','address']
        .filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
      if(n==='customer_create')created=await s.customers.create(payload,opts);
      if(n==='customer_update')await s.customers.update(a.customerId,payload,opts);
      if(n==='customer_delete')await s.customers.del(a.customerId,undefined,opts);
      if(n==='customer_remove_payment_method')
        await s.paymentMethods.detach(a.paymentMethodId,{},opts);
      if(n==='customer_set_default_payment_method')
        await s.customers.update(a.customerId,{
          invoice_settings:{default_payment_method:a.paymentMethodId}},opts);
      if(n==='customer_add_balance_credit')
        created=await s.customers.createBalanceTransaction(a.customerId,{
          amount:a.creditCents?-a.creditCents:a.debitCents,currency:'usd',description:a.description},opts);
      if(n==='customer_add_tax_id')
        created=await s.customers.createTaxId(a.customerId,{type:a.type,value:a.value},opts);
      if(n==='customer_delete_tax_id')
        await s.customers.deleteTaxId(a.customerId,a.taxId,undefined,opts);
      if(n==='customer_remove_discount')
        await s.customers.deleteDiscount(a.customerId,undefined,opts);
    },
    readAfter:async(a,ctx)=>{
      const s=await getClient(ctx),n=def.name;
      if(n==='customer_create')return created?.id?
        s.customers.retrieve(created.id):null;
      if(n==='customer_remove_payment_method')return s.paymentMethods.retrieve(a.paymentMethodId);
      if(n==='customer_add_balance_credit')return created?.id?
        s.customers.retrieveBalanceTransaction(a.customerId,created.id):null;
      if(n==='customer_add_tax_id'||n==='customer_delete_tax_id')return s.customers.retrieveTaxId(
        a.customerId,n==='customer_add_tax_id'?created?.id:a.taxId);
      return s.customers.retrieve(a.customerId);
    },
    verify:async(_before,after,a)=>{
      if(!after)return false;
      const n=def.name;
      if(n==='customer_create')return after.id===created?.id&&
        changed(after,a,['name','email','phone','description','metadata','address']);
      if(n==='customer_update')return after.id===a.customerId&&
        changed(after,a,['name','email','phone','description','metadata','address']);
      if(n==='customer_delete')return after.id===a.customerId&&after.deleted===true;
      if(n==='customer_delete_tax_id')return after.id===a.taxId&&after.deleted===true;
      if(n==='customer_remove_payment_method')return after.id===a.paymentMethodId&&after.customer===null;
      if(n==='customer_set_default_payment_method')
        return after.id===a.customerId&&
          after.invoice_settings?.default_payment_method===a.paymentMethodId;
      if(n==='customer_add_balance_credit')
        return after.id===created?.id&&after.amount===(a.creditCents?-a.creditCents:a.debitCents);
      if(n==='customer_add_tax_id')return after.id===created?.id&&
        after.type===a.type&&after.value===a.value;
      if(n==='customer_remove_discount')return after.id===a.customerId&&after.discount==null;
      return false;
    }
  });
  // TEST is an invariant on the concrete operation itself, not just its MCP door.
  return {...operation,handler:(args,ctx)=>
    ctx?.connection?.mode==='test'?operation.handler(args,ctx):
      gone('This customer mutation is available in TEST mode only')};
}
export function makeCustomerWrite(name){
  const def=plans.find(x=>x.name===name);
  if(!def)throw new TypeError('Unknown customer write');
  return build(def);
}
export const tools=plans.map(def=>{
  const op=build(def);
  return {...op.tool,description:def.description,area:'customers',
    profiles:def.full?full:profiles,
    ...(def.money?{moneyOut:true}:{}),
    inputSchema:{type:'object',properties:{...def.props,
      dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:def.required,additionalProperties:false},
    annotations:{destructiveHint:def.destructive===true}};
});
export const handlers=Object.fromEntries(plans.map(def=>[def.name,async(args,ctx)=>{
  // All mutable state is per invocation, never module-global.
  const s=await getClient(ctx);
  return build(def).handler(args,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
}]));
