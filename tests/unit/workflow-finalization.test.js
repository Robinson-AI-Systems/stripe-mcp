import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const A='acct_WORK910',C='cus_WORK910',P='prod_WORK910',PRICE='price_WORK910';
const MONTH='2026-09',TYPE='balance.summary.1';
const data=r=>{try{return JSON.parse(r.content[0].text);}catch{return r.content[0].text;}};
function fixture(){
  const db=createFakeDb({accounts:[{id:A,label:'TEST final workflow'}]}),calls=[];
  let product=null,price=null,report=null,session=null;
  const customer={object:'customer',id:C,name:'TEST Merchant',
    livemode:false,metadata:{},invoice_settings:{}};
  const tx=[
    {id:'txn_TESTA',object:'balance_transaction',created:1790950000,
      currency:'usd',amount:3000,fee:100,net:2900},
    {id:'txn_TESTB',object:'balance_transaction',created:1790950001,
      currency:'eur',amount:-900,fee:0,net:-900}
  ];
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:A,livemode:false,
      settings:{branding:{primary_color:'#123456'},payments:{}},
      business_profile:{},metadata:{}})},
    balance:{retrieve:async()=>({object:'balance',livemode:false,
      available:[],pending:[]})},
    balanceTransactions:{list:async()=>({data:tx,has_more:false})},
    subscriptions:{list:async()=>({data:[],has_more:false})},
    customers:{retrieve:async()=>customer},
    products:{
      search:async()=>({data:product?[product]:[],has_more:false}),
      list:async()=>({data:product?[product]:[],has_more:false}),
      retrieve:async()=>product,
      create:async(args,opts)=>{calls.push({kind:'product.create',args,opts});
        product={object:'product',id:P,livemode:false,active:true,name:args.name,
          description:args.description??null,metadata:{},created:1790950000};
        return product;}
    },
    prices:{
      list:async()=>({data:price?[price]:[],has_more:false}),
      retrieve:async()=>price??{id:PRICE,object:'price',livemode:false,active:true,
        product:P,currency:'usd',unit_amount:2500,type:'one_time',metadata:{}},
      create:async(args,opts)=>{calls.push({kind:'price.create',args,opts});
        price={id:PRICE,object:'price',livemode:false,active:true,product:P,
          currency:args.currency,unit_amount:args.unit_amount,
          lookup_key:args.lookup_key,type:'one_time',metadata:{}};
        return price;}
    },
    reporting:{
      reportTypes:{
        list:async()=>({data:[{object:'reporting.report_type',id:TYPE,
          livemode:false,name:'Balance Summary',version:'1',
          data_available_start:1767225600,data_available_end:1798761600,
          default_columns:[]}],has_more:false}),
        retrieve:async()=>({object:'reporting.report_type',id:TYPE,
          livemode:false,data_available_start:1767225600,data_available_end:1798761600})
      },
      reportRuns:{
        list:async()=>({data:report?[report]:[],has_more:false}),
        create:async(args,opts)=>{calls.push({kind:'report.create',args,opts});
          report={id:'frr_WORK910',object:'reporting.report_run',
            livemode:false,report_type:TYPE,created:1790950000,
            status:'pending',parameters:args.parameters,result:null};return report;},
        retrieve:async()=>report
      }
    },
    checkout:{sessions:{
      create:async(args,opts)=>{calls.push({kind:'checkout.create',args,opts});
        session={id:'cs_test_WORK910',object:'checkout.session',customer:C,
          mode:'payment',status:'open',payment_status:'unpaid',
          url:'https://checkout.stripe.com/c/pay/verified',currency:'usd'};
        return session;},
      retrieve:async()=>session,
      listLineItems:async()=>({data:[{id:'li_WORK910',object:'item',
        price:PRICE,currency:'usd',quantity:1,amount_total:2500,
        amount_subtotal:2500}],has_more:false})
    }}
  };
  const ctx={connection:{mode:'test',profile:'full',stripeAccount:A},
    connectionId:'w9w10-synthetic',db,services:{
      stripeForConnection:async()=>sdk,
      hostedReturnUrls:{success:'https://example.org/success',
        cancel:'https://example.org/cancel',portal:'https://example.org/portal'}
    }};
  return {ctx,sdk,db,calls,call:(name,args)=>registry.handlers[name](args,ctx),
    get product(){return product;},get price(){return price;},
    get report(){return report;},get session(){return session;}};
}
describe('W-9 provider-shaped month-end close, reports, find and staged catalog',()=>{
  it('computes civil dates and preserves EUR and USD without mixing totals',async()=>{
    const f=fixture(),result=data(await f.call('workflow_month_end_close',{month:MONTH}));
    expect(result).toMatchObject({mode:'test',month:MONTH,
      noCurrencyConversion:true,reportReady:false,
      complete:true,moneyFlowsComplete:true});
    expect(result.flowsByCurrency.usd).toMatchObject({
      moneyInMinor:3000,feesMinor:100,netMinor:2900});
    expect(result.flowsByCurrency.eur).toMatchObject({
      moneyOutMinor:900,netMinor:-900});
    expect(f.calls).toHaveLength(0);
  });
  it('requests a TEST report only after guarded confirm, preserving pending and private file',async()=>{
    const f=fixture(),args={month:MONTH,reportType:TYPE};
    const before=data(await f.call('workflow_month_end_report',args));
    expect(before).toMatchObject({done:false,needsConfirmation:true});
    expect(f.calls).toHaveLength(0);
    const made=data(await f.call('workflow_month_end_report',{...args,
      confirm:true,requestKey:'month-sep-1',previewToken:before.previewToken}));
    expect(made).toMatchObject({done:true,confirmed:true,
      runId:'frr_WORK910',reportCompletion:'pending',publicDownloadUrl:null});
    const close=data(await f.call('workflow_month_end_close',
      {month:MONTH,runId:'frr_WORK910'}));
    expect(close.report.privateExport).toMatchObject({
      available:false,downloadUrl:null,publicUrlAvailable:false});
    expect(f.calls.map(x=>x.kind)).toEqual(['report.create']);
  });
  it('searches two pages using native cursor and reports denied/incomplete honestly',async()=>{
    const f=fixture(),one={id:P,object:'product',livemode:false,name:'Find me',
      active:true,metadata:{}};
    f.sdk.products.search=async args=>args.page?{data:[{...one,id:'prod_OTHER910'}],
      has_more:false}:{data:[one],has_more:true,next_page:'page_TESTTOKEN'};
    const found=data(await f.call('workflow_find',{type:'product',query:"name:'Find me'",
      maxPages:3,limit:10}));
    expect(found).toMatchObject({complete:true,resultCount:2,pages:2});
    f.sdk.products.search=async()=>{throw Error('TEST restricted key denied');};
    const denial=data(await f.call('workflow_find',{type:'product',query:"name:'Find me'"}));
    expect(denial).toMatchObject({complete:false,reason:'provider_search_unavailable'});
    expect((await f.call('workflow_find',{type:'price',query:'[sneaky] \\ secret'})).isError)
      .toBe(true);
  });
  it('creates native product first, then native guarded unique price, and reuses exact lookup without writes',async()=>{
    const f=fixture(),args={name:'Owner Sample Unit',lookupKey:'owner_sample_910',
      unitAmountCents:2500,currency:'usd'};
    let before=data(await f.call('workflow_set_up_catalog',args));
    expect(before).toMatchObject({stage:'product',done:false});
    let step=data(await f.call('workflow_set_up_catalog',{...args,
      confirm:true,requestKey:'catalog-product',previewToken:before.previewToken}));
    expect(step).toMatchObject({confirmed:true,done:false,
      stage:'await_price_preview',productId:P});
    before=data(await f.call('workflow_set_up_catalog',{...args,productId:P}));
    expect(before.stage).toBe('price');
    step=data(await f.call('workflow_set_up_catalog',{...args,productId:P,
      confirm:true,requestKey:'catalog-price',previewToken:before.previewToken}));
    expect(step).toMatchObject({done:true,confirmed:true,
      stage:'complete',priceId:PRICE});
    const again=data(await f.call('workflow_set_up_catalog',{...args,productId:P}));
    expect(again).toMatchObject({done:true,reusedExisting:true,noProviderWrite:true});
    expect(f.calls.map(x=>x.kind)).toEqual(['product.create','price.create']);
  });
  it('refuses mismatch lookup key and LIVE write before any provider mutation',async()=>{
    const f=fixture(),args={name:'Owner Sample Unit',lookupKey:'owner_sample_910',
      unitAmountCents:2500,currency:'usd',productId:P};
    f.ctx.connection.mode='live';
    expect((await f.call('workflow_set_up_catalog',args)).isError).toBe(true);
    expect((await f.call('workflow_month_end_close',{month:MONTH})).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
});
describe('W-10 original native TEST business brand kit and hosted Checkout',()=>{
  it('saves exactly one branded native kit using guarded versioned DB and repeats with zero redundant save',async()=>{
    const f=fixture(),args={brandKit:{backgroundColor:'#112233'}};
    const preview=data(await f.call('workflow_brand_business',args));
    expect(preview).toMatchObject({brandingStage:'brandKit',needsConfirmation:true});
    expect(preview.previewToken).toMatch(/^[a-f0-9]{64}$/);
    const saved=data(await f.call('workflow_brand_business',{...args,
      confirm:true,requestKey:'brand-save-1',previewToken:preview.previewToken}));
    expect(saved).toMatchObject({confirmed:true,done:false,
      brandingStage:'brandKit'});
    const repeat=data(await f.call('workflow_brand_business',args));
    expect(repeat).toMatchObject({noProviderWrite:true,brandingStage:'owner_actions'});
    expect((await f.db.getBrandKit({account:A,mode:'test'})).settings)
      .toMatchObject({backgroundColor:'#112233'});
    expect(f.calls).toHaveLength(0);
  });
  it('creates guarded TEST hosted Checkout and verifies safe provider link; next exact session rerun is read-only',async()=>{
    const f=fixture(),args={customerId:C,priceId:PRICE};
    const preview=data(await f.call('workflow_brand_business',args));
    expect(preview).toMatchObject({brandingStage:'checkout',needsConfirmation:true});
    const done=data(await f.call('workflow_brand_business',{...args,
      confirm:true,requestKey:'checkout-brand-1',previewToken:preview.previewToken}));
    expect(done).toMatchObject({confirmed:true,checkoutVerified:true,
      checkout:{sessionId:'cs_test_WORK910',verified:true}});
    const rerun=data(await f.call('workflow_brand_business',{...args,
      checkoutSessionId:'cs_test_WORK910'}));
    expect(rerun).toMatchObject({done:true,checkoutVerified:true,noProviderWrite:true});
    expect(f.calls.map(x=>x.kind)).toEqual(['checkout.create']);
  });
  it('keeps owner Dashboard-only brand changes as needs_you and refuses LIVE or wrong checkout state',async()=>{
    const f=fixture();
    const report=data(await f.call('workflow_brand_business',{
      accountBranding:{primaryColor:'#ffffff'}}));
    expect(report.guidedSettings[0].status).toBe('needs_you');
    expect(report.done).toBe(false);
    expect(report.anyLiveWrite).toBe(false);
    f.ctx.connection.mode='live';
    expect((await f.call('workflow_brand_business',{})).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
});
