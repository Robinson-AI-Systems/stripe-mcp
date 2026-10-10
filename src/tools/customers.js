// Stripe customer reads. No secret, payment-method token or raw provider object is returned.
import {annotateAppRead} from './app-guard.js';
import {denverLocalTime} from './util.js';
const profiles=['read_only','everyday','full'];
const schema=(props,required=[])=>({type:'object',properties:props,required,additionalProperties:false});
const str={type:'string',minLength:1,maxLength:200},id={...str,maxLength:110};
const paging={limit:{type:'integer',minimum:1,maximum:100},starting_after:id};
const customerId={customerId:id};
const read=(name,description,props,required=[])=>({name,description,profiles,
  writes:false,area:'customers',inputSchema:schema(props,required),annotations:{readOnlyHint:true}});
export const tools=[
  read('customer_list','List TEST customers with email/date filters and 20-item paging.',
    {...paging,email:{...str,maxLength:512},createdFrom:{type:'integer',minimum:0},
      createdTo:{type:'integer',minimum:0}}),
  read('customer_get','Read a TEST customer, default payment-method ID and app ownership.',customerId,['customerId']),
  read('customer_search','Search TEST customers with a bounded Stripe search expression.',
    {query:{...str,maxLength:400},limit:paging.limit,page:id},['query']),
  read('customer_find','Find TEST customers by name, email, phone or app customer ID.',
    {term:str,limit:paging.limit,page:id},['term']),
  read('customer_list_payment_methods','List a customer’s saved cards or banks, masked to brand and last four.',
    {...customerId,...paging,type:{type:'string',enum:['card','us_bank_account']}},['customerId']),
  read('customer_get_payment_method','Retrieve a TEST customer’s masked saved payment method.',
    {...customerId,paymentMethodId:id},['customerId','paymentMethodId']),
  read('customer_list_balance_transactions','List customer credit/debit history as signed integer cents.',
    {...customerId,...paging},['customerId']),
  read('customer_list_tax_ids','List a TEST customer’s saved tax IDs.',
    {...customerId,...paging},['customerId'])
];
const match=(v,r)=>typeof v==='string'&&r.test(v);
const validCustomer=v=>match(v,/^cus_[A-Za-z0-9]{2,100}$/);
const validPm=v=>match(v,/^pm_[A-Za-z0-9]{2,100}$/);
const page=args=>{
  const n=args?.limit??20;
  if(!Number.isInteger(n)||n<1||n>100||
    (args?.starting_after!==undefined&&!match(args.starting_after,/^[A-Za-z_0-9]{3,110}$/)))
    throw new TypeError('Specify a page size 1 to 100 and a valid cursor');
  return {limit:n,...(args?.starting_after?{starting_after:args.starting_after}:{})};
};
const getStripe=ctx=>{
  if(ctx?.connection?.mode!=='test'||typeof ctx.services?.stripeForConnection!=='function')
    throw new Error('Server-side TEST Stripe access unavailable');
  return ctx.services.stripeForConnection(ctx.connection);
};
const ok=v=>({content:[{type:'text',text:JSON.stringify(v)}]});
const fail=v=>({isError:true,content:[{type:'text',text:v}]});
const perform=async(ctx,fn)=>{
  try{return ok(await fn(await getStripe(ctx)));}
  catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
};
const safeCustomer=(v,ctx)=>annotateAppRead({
  id:v.id,object:'customer',name:v.name??null,email:v.email??null,phone:v.phone??null,
  description:v.description??null,currency:v.currency??null,balance:v.balance??0,
  created_local:v.created?denverLocalTime(v.created):null,
  defaultPaymentMethod:typeof v.invoice_settings?.default_payment_method==='string'?
    v.invoice_settings.default_payment_method:v.invoice_settings?.default_payment_method?.id??null,
  metadata:v.metadata??{}
},{getCustomer:ctx.getCustomer});
const safeMethod=m=>({id:m.id,object:'payment_method',type:m.type,
  customer:typeof m.customer==='string'?m.customer:null,
  brand:m.card?.brand??null,last4:m.card?.last4??m.us_bank_account?.last4??null,
  expires:m.card?{month:m.card.exp_month,year:m.card.exp_year}:null,
  bankName:m.us_bank_account?.bank_name??null});
const list=async(p,format)=>({data:await Promise.all((p.data||[]).map(format)),
  has_more:p.has_more===true,next:p.next_page??(p.has_more?p.data?.at(-1)?.id:null),
  nextHelp:p.has_more?'Use next as page for search, otherwise starting_after for listing':null});
const safeSearch=v=>{
  if(typeof v!=='string'||!v.trim()||v.length>400||
    !/^[a-zA-Z0-9_@\-\s.\[\]:'"~+*]+$/.test(v))
    throw new TypeError('Use a bounded Stripe customer search expression');
  return v;
};
const escapeQuery=v=>v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export const handlers={
  customer_list:(a,c)=>perform(c,async s=>{
    const p=page(a);
    if(a?.email!==undefined){
      if(typeof a.email!=='string'||a.email.length>512||!a.email.includes('@'))
        throw new TypeError('A valid email is required');
      p.email=a.email;
    }
    if(a?.createdFrom!==undefined||a?.createdTo!==undefined){
      if(![a.createdFrom??0,a.createdTo??0].every(x=>Number.isSafeInteger(x)&&x>=0))
        throw new TypeError('Creation dates must be integer UNIX seconds');
      p.created={...(a.createdFrom!==undefined?{gte:a.createdFrom}:{}),
        ...(a.createdTo!==undefined?{lte:a.createdTo}:{})};
    }
    return list(await s.customers.list(p),v=>safeCustomer(v,c));
  }),
  customer_get:(a,c)=>perform(c,async s=>{
    if(!validCustomer(a?.customerId))throw new TypeError('Valid customer ID required');
    const v=await s.customers.retrieve(a.customerId);
    return v.deleted?{id:v.id,deleted:true}:safeCustomer(v,c);
  }),
  customer_search:(a,c)=>perform(c,async s=>{
    const query=safeSearch(a?.query),p=page(a);
    if(a?.page!==undefined&&!match(a.page,/^[A-Za-z0-9_-]{1,200}$/))
      throw new TypeError('Invalid Stripe search page cursor');
    return list(await s.customers.search({query,limit:p.limit,
      ...(a?.page?{page:a.page}:{})}),v=>safeCustomer(v,c));
  }),
  customer_find:(a,c)=>perform(c,async s=>{
    const v=a?.term?.trim();
    if(typeof v!=='string'||!v||v.length>150||/[\r\n\\]/.test(v))
      throw new TypeError('Valid plain customer search required');
    if(validCustomer(v)){
      const item=await s.customers.retrieve(v);
      return {data:item.deleted?[]:[await safeCustomer(item,c)],has_more:false,next:null};
    }
    const escaped=escapeQuery(v);
    const query=v.includes('@')?"email:'"+escaped+"'":
      /^app:[A-Za-z0-9_-]+$/.test(v)?"metadata['customerId']:'"+escapeQuery(v.slice(4))+"'":
      /^\+?[0-9() -]{7,20}$/.test(v)?"phone:'"+escaped+"'":
      "name~'"+escaped+"'";
    return list(await s.customers.search({query,limit:page(a).limit,
      ...(a?.page?{page:a.page}:{})}),item=>safeCustomer(item,c));
  }),
  customer_list_payment_methods:(a,c)=>perform(c,async s=>{
    if(!validCustomer(a?.customerId))throw new TypeError('Valid customer ID required');
    if(a?.type!==undefined&&!['card','us_bank_account'].includes(a.type))
      throw new TypeError('Invalid saved payment method type');
    return list(await s.customers.listPaymentMethods(a.customerId,{
      ...page(a),...(a?.type?{type:a.type}:{})}),safeMethod);
  }),
  customer_get_payment_method:(a,c)=>perform(c,async s=>{
    if(!validCustomer(a?.customerId)||!validPm(a?.paymentMethodId))
      throw new TypeError('Valid customer and payment method IDs required');
    return safeMethod(await s.customers.retrievePaymentMethod(a.customerId,a.paymentMethodId));
  }),
  customer_list_balance_transactions:(a,c)=>perform(c,async s=>{
    if(!validCustomer(a?.customerId))throw new TypeError('Valid customer ID required');
    return list(await s.customers.listBalanceTransactions(a.customerId,page(a)),
      v=>({id:v.id,object:'customer_balance_transaction',
        amount:v.amount,currency:v.currency,type:v.type,description:v.description??null,
        created_local:v.created?denverLocalTime(v.created):null}));
  }),
  customer_list_tax_ids:(a,c)=>perform(c,async s=>{
    if(!validCustomer(a?.customerId))throw new TypeError('Valid customer ID required');
    return list(await s.customers.listTaxIds(a.customerId,page(a)),
      v=>({id:v.id,object:'tax_id',type:v.type,value:v.value,
        verification:v.verification?.status??null}));
  })
};
