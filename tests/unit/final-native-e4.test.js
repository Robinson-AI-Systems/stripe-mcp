import {describe,it,expect,vi} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {isGuardedTestWrite,isGuardedLiveWrite} from '../../src/core/profiles.js';
const names=['tax_get_settings','tax_calculate','tax_list_registrations',
  'tax_list_transactions','tax_get_transaction','tax_list_codes','tax_get_code',
  'tax_update_settings','tax_add_registration','tax_end_registration',
  'tax_record_transaction','tax_reverse_transaction',
  'quote_list','quote_get','quote_get_pdf_link','quote_create','quote_update',
  'quote_finalize','quote_accept','quote_cancel'];
const account='acct_E4SAFE123',body=x=>JSON.parse(x.content[0].text);
function fixture({providerLive=false}={}){
  const taxSettings={id:null,object:'tax.settings',livemode:providerLive,
    defaults:{tax_behavior:'exclusive',tax_code:'txcd_ABC123'},
    head_office:{address:{country:'US'}}};
  const quote={id:'qt_ABC123',object:'quote',livemode:providerLive,status:'draft',
    customer:'cus_ABC123',amount_total:800,currency:'usd',
    description:null,metadata:{},line_items:{data:[{
      price:'price_ABC123',quantity:2}],has_more:false}};
  const sdk={
    tax:{
      settings:{retrieve:vi.fn(async()=>taxSettings),
        update:vi.fn(async p=>{Object.assign(taxSettings.defaults,p.defaults);return taxSettings;})},
      calculations:{create:vi.fn(async p=>({object:'tax.calculation',id:'taxcalc_ABC123',
        livemode:providerLive,currency:p.currency,amount_total:500}))},
      registrations:{list:vi.fn(async()=>({data:[],has_more:false})),
        retrieve:vi.fn(async()=>({object:'tax.registration',id:'taxreg_ABC123',
          livemode:providerLive,status:'active',country:'US'}))},
      transactions:{retrieve:vi.fn(async()=>({object:'tax.transaction',id:'tax_ABC123',
        livemode:providerLive,reference:'safe_ref'}))},
    },
    taxCodes:{list:vi.fn(async()=>({data:[],has_more:false})),
      retrieve:vi.fn(async()=>({object:'tax_code',id:'txcd_ABC123',name:'General'}))},
    quotes:{
      list:vi.fn(async()=>({data:[quote],has_more:false})),
      retrieve:vi.fn(async()=>quote),
      listLineItems:vi.fn(async()=>quote.line_items),
      create:vi.fn(async()=>quote),
      finalizeQuote:vi.fn(async()=>{quote.status='open';return quote;}),
      accept:vi.fn(async()=>{quote.status='accepted';return quote;}),
      cancel:vi.fn(async()=>{quote.status='canceled';return quote;})
    },
    customers:{retrieve:vi.fn(async id=>({object:'customer',id,
      livemode:providerLive,metadata:{}}))},
    prices:{retrieve:vi.fn(async id=>({object:'price',id,livemode:providerLive,
      active:true,product:'prod_ABC123',metadata:{}}))},
    products:{retrieve:vi.fn(async id=>({object:'product',id,livemode:providerLive,
      metadata:{}}))}
  };
  const db=createFakeDb({accounts:[{id:account,label:'Safe E4'}]});
  const ctx={db,connection:{stripeAccount:account,mode:'test',profile:'full'},
    connectionId:'e4-safe',getCustomer:id=>sdk.customers.retrieve(id),
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk,quote};
}
describe('E-4 native Tax and Quote provider boundary',()=>{
  it('registers all original Tax and Quote operations and classifies guarded writes',()=>{
    for(const name of names){
      const t=registry.tools.find(x=>x.name===name);
      expect(t?.name).toBe(name);
      expect(t?.inputSchema?.additionalProperties).toBe(false);
      if(t.writes)expect(t.writeContract).toBe('defineWrite-v1');
      if(t.writes)expect(isGuardedTestWrite(t,{mode:'test',profile:'full'})).toBe(true);
    }
    expect(names).toHaveLength(20);
    expect(isGuardedLiveWrite(registry.tools.find(x=>x.name==='quote_accept'),
      {mode:'live',profile:'full',rtcLiveOwnerApproved:true,moneyLimitCents:1000}))
      .toBe(true);
    expect(isGuardedTestWrite(registry.tools.find(x=>x.name==='quote_create'),
      {mode:'test',profile:'read_only'})).toBe(false);
  });
  it('rejects wrong provider mode and refuses tax calculation based on non-mode matching fixture',async()=>{
    const {ctx,sdk}=fixture({providerLive:true});
    const r=await registry.handlers.tax_get_settings({},ctx);
    expect(r.isError).toBe(true);
    const c=await registry.handlers.tax_calculate({currency:'usd',
      address:{country:'US'},lineItems:[{amount:100,reference:'A'}]},ctx);
    expect(c.isError).toBe(true);
    expect(sdk.tax.calculations.create).toHaveBeenCalledTimes(1);
  });
  it('Tax settings native reads and quote draft-only restrictions verified from selected TEST',async()=>{
    const {ctx,sdk}=fixture();
    const settings=body(await registry.handlers.tax_get_settings({},ctx));
    expect(settings.object).toBe('tax.settings');
    const quote=body(await registry.handlers.quote_get({quoteId:'qt_ABC123'},ctx));
    expect(quote.status).toBe('draft');
    const denied=await registry.handlers.quote_get_pdf_link({quoteId:'qt_ABC123'},ctx);
    expect(denied.isError).toBe(true);
    const preview=await registry.handlers.quote_accept({
      quoteId:'qt_ABC123',dryRun:true,requestKey:'safe'},ctx);
    expect(preview.isError).toBe(true);
    expect(sdk.quotes.accept).not.toHaveBeenCalled();
  });
  it('quote finalize demands explicit confirmation and verifies provider transition',async()=>{
    const {ctx,sdk}=fixture();
    const first=body(await registry.handlers.quote_finalize({quoteId:'qt_ABC123'},ctx));
    expect(first.needsConfirmation).toBe(true);
    expect(sdk.quotes.finalizeQuote).not.toHaveBeenCalled();
    const done=body(await registry.handlers.quote_finalize({
      quoteId:'qt_ABC123',confirm:true,requestKey:'safe-e4-finalize'},ctx));
    expect(done.done).toBe(true);
    expect(sdk.quotes.finalizeQuote).toHaveBeenCalledTimes(1);
    const location=body(await registry.handlers.quote_get_pdf_link({quoteId:'qt_ABC123'},ctx));
    expect(location.publicPdfUrl).toBeNull();
    expect(location.authenticatedPdfApiUrl).toBe(
      'https://files.stripe.com/v1/quotes/qt_ABC123/pdf');
  });
  it('isolates concurrent quote creation IDs across separate confirmed requests',async()=>{
    const {ctx,sdk,quote}=fixture();
    let count=0;
    const created=new Map();
    sdk.quotes.create.mockImplementation(async payload=>{
      const id='qt_THREAD'+(++count);
      const q={...quote,id,customer:payload.customer,
        line_items:{data:[{price:'price_ABC123',quantity:2}],has_more:false}};
      created.set(id,q);
      // Both requests can overlap without sharing a module closure.
      await Promise.resolve();
      return q;
    });
    sdk.quotes.retrieve.mockImplementation(async id=>created.get(id));
    sdk.quotes.listLineItems.mockImplementation(async id=>created.get(id)?.line_items);
    const lineItems=[{priceId:'price_ABC123',quantity:2}];
    const [first,second]=await Promise.all([
      registry.handlers.quote_create({customerId:'cus_THREADONE',
        lineItems,confirm:true,requestKey:'thread-one'},ctx),
      registry.handlers.quote_create({customerId:'cus_THREADTWO',
        lineItems,confirm:true,requestKey:'thread-two'},ctx)
    ]);
    expect(body(first)).toMatchObject({done:true,resourceId:'qt_THREAD1'});
    expect(body(second)).toMatchObject({done:true,resourceId:'qt_THREAD2'});
    expect(sdk.quotes.create).toHaveBeenCalledTimes(2);
  });
  it('isolates concurrent Tax registration creation IDs and selected-mode readback',async()=>{
    const {ctx,sdk}=fixture();
    let count=0;
    const rows=new Map();
    sdk.tax.registrations.create=vi.fn(async data=>{
      const id='taxreg_THREAD'+(++count);
      const value={object:'tax.registration',livemode:false,id,
        country:data.country,status:'active'};
      rows.set(id,value);
      await Promise.resolve();
      return value;
    });
    sdk.tax.registrations.retrieve.mockImplementation(async id=>rows.get(id));
    const args={country:'US',countryOptions:{us:{type:'standard'}},
      activeFrom:'now',confirm:true};
    const [a,b]=await Promise.all([
      registry.handlers.tax_add_registration({...args,requestKey:'first-reg'},ctx),
      registry.handlers.tax_add_registration({...args,requestKey:'second-reg'},ctx)
    ]);
    expect(body(a)).toMatchObject({done:true,resourceId:'taxreg_THREAD1'});
    expect(body(b)).toMatchObject({done:true,resourceId:'taxreg_THREAD2'});
  });

});
