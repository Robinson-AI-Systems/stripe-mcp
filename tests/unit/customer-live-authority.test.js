import {describe,it,expect,vi,afterEach} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {listingForConnection,isGuardedLiveWrite} from '../../src/core/profiles.js';
const acct='acct_LIVECUSTOMERS',cid='cus_LIVECUST1',pm='pm_LIVEMETHOD1',tid='txi_LIVETAX1';
const parse=r=>JSON.parse(r.content[0].text);
afterEach(()=>vi.unstubAllEnvs());
function fixture({consent=true,active=true,providerMode='live',owned=false,
  stale=false,missingMode=false,profile='full'}={}){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,label:'Synthetic LIVE',live_enabled:active,
    live_connected:true,money_limit_cents:50000}]});
  const calls=[];
  let customer={id:cid,object:'customer',livemode:missingMode?undefined:providerMode==='live',
    name:'Original',email:'fixture@example.test',phone:'+19705550123',description:null,
    metadata:owned?{agreementId:'APP_OWNED'}:{},created:1695680197,deleted:false,
    invoice_settings:{default_payment_method:pm},discount:{id:'di_ONE'},
    address:null,balance:0};
  let method={id:pm,object:'payment_method',livemode:providerMode==='live',
    type:'card',customer:cid,card:{brand:'visa',last4:'4242',exp_month:9,exp_year:2030}};
  let tax={id:tid,object:'tax_id',livemode:providerMode==='live',
    type:'eu_vat',value:'DE123456789',customer:cid,deleted:false};
  let createdTax=null;
  const copy=x=>x&&{...x,metadata:{...x.metadata},
    invoice_settings:x.invoice_settings?{...x.invoice_settings}:undefined};
  const mutation=(name,opts)=>{calls.push({name,opts});expect(opts?.idempotencyKey).toMatch(/^rmcp_/);};
  const stripe={
    accounts:{retrieve:async()=>({object:'account',id:acct})},
    balance:{retrieve:async()=>({object:'balance',livemode:providerMode==='live'})},
    customers:{
      list:async()=>({data:[copy(customer)],has_more:false}),
      search:async()=>({data:[copy(customer)],has_more:false}),
      retrieve:async id=>id===cid?copy(customer):id==='cus_CREATEDLIVE'?copy(created):null,
      listPaymentMethods:async()=>({data:[{...method}],has_more:false}),
      retrievePaymentMethod:async()=>({...method}),
      listBalanceTransactions:async()=>({data:[{
        id:'cbtxn_LIVE1',object:'customer_balance_transaction',
        livemode:providerMode==='live',amount:-100,currency:'usd',type:'adjustment'
      }],has_more:false}),
      listTaxIds:async()=>({data:[{...tax}],has_more:false}),
      create:async(payload,opts)=>{
        mutation('customer_create',opts);
        created={...customer,id:'cus_CREATEDLIVE',metadata:payload.metadata??{},
          ...payload};return copy(created);
      },
      update:async(_id,payload,opts)=>{
        mutation('customer_update',opts);
        if(!stale)customer={...customer,...payload};return copy(customer);
      },
      del:async(id,_body,opts)=>{
        mutation('customer_delete',opts);
        if(!stale)customer={...customer,deleted:true};
        return {id,deleted:true};
      },
      deleteDiscount:async(_id,_body,opts)=>{
        mutation('customer_remove_discount',opts);
        if(!stale)customer={...customer,discount:null};return {deleted:true};
      },
      createTaxId:async(_id,input,opts)=>{
        mutation('customer_add_tax_id',opts);
        createdTax={...tax,id:'txi_CREATEDLIVE',...input};return {...createdTax};
      },
      retrieveTaxId:async(_id,id)=>id===tid?{...tax}:{...createdTax},
      deleteTaxId:async(_id,id,_body,opts)=>{
        mutation('customer_delete_tax_id',opts);
        if(!stale)tax={...tax,deleted:true};return {id,deleted:true};
      }
    },
    paymentMethods:{
      retrieve:async()=>({...method}),
      detach:async(_id,_body,opts)=>{
        mutation('customer_remove_payment_method',opts);
        if(!stale)method={...method,customer:null};return {...method};
      }
    }
  };
  let created=null;
  const ctx={db,connection:{mode:'live',profile,listing:'catalog',
    stripeAccount:acct,rtcLiveOwnerApproved:consent,moneyLimitCents:0},
    connectionId:'synthetic-customer-live',liveAccessGranted:consent,
    services:{stripeForConnection:async connection=>{
      expect(connection.mode).toBe('live');
      expect(connection.stripeAccount).toBe(acct);
      return stripe;
    }}};
  const invoke=(name,args={})=>registry.handlers[name](args,ctx);
  const confirm=(name,args)=>invoke(name,{...args,confirm:true,
    requestKey:'synthetic-'+name});
  return {ctx,db,stripe,calls,invoke,confirm,
    customer:()=>customer,method:()=>method,tax:()=>tax};
}
describe('D-1 owner selected LIVE nonfinancial customer operations',()=>{
  const writes=['customer_create','customer_update','customer_delete',
    'customer_remove_payment_method','customer_set_default_payment_method',
    'customer_add_tax_id','customer_delete_tax_id','customer_remove_discount'];
  it('discovers only nonfinancial owner-delegated LIVE customer write tools',()=>{
    const f=fixture();
    const listed=listingForConnection(registry,f.ctx.connection).filter(t=>
      t.area==='customers'&&t.writes===true).map(t=>t.name).sort();
    expect(listed).toEqual([...writes].sort());
    for(const name of writes){
      const tool=registry.tools.find(t=>t.name===name);
      expect(isGuardedLiveWrite(tool,f.ctx.connection)).toBe(true);
      expect(isGuardedLiveWrite(tool,{...f.ctx.connection,
        rtcLiveOwnerApproved:false})).toBe(false);
    }
    const money=registry.tools.find(t=>t.name==='customer_add_balance_credit');
    expect(isGuardedLiveWrite(money,f.ctx.connection)).toBe(false);
    expect(listingForConnection(registry,f.ctx.connection).some(t=>
      t.name==='customer_add_balance_credit')).toBe(false);
  });
  it('reads all eight original customer views in LIVE without revealing card secrets',async()=>{
    const f=fixture();
    const cases=[
      ['customer_list',{}],['customer_get',{customerId:cid}],
      ['customer_search',{query:"email:'fixture@example.test'"}],
      ['customer_find',{term:'fixture@example.test'}],
      ['customer_list_payment_methods',{customerId:cid}],
      ['customer_get_payment_method',{customerId:cid,paymentMethodId:pm}],
      ['customer_list_balance_transactions',{customerId:cid}],
      ['customer_list_tax_ids',{customerId:cid}]
    ];
    for(const [name,args]of cases){
      const got=await f.invoke(name,args);
      expect(got.isError,name).not.toBe(true);
      expect(JSON.stringify(got)).not.toContain('fingerprint');
    }
    const reading=await dispatchReadOnlyTool({registry,name:'customer_get',
      args:{customerId:cid},connection:f.ctx.connection,db:f.db,
      services:f.ctx.services});
    expect(reading.isError).toBeUndefined();
  });
  it('creates and updates a LIVE customer only after owner preview and readback',async()=>{
    const f=fixture();
    const proposal=parse(await f.invoke('customer_create',{name:'Live Customer'}));
    expect(proposal).toMatchObject({mode:'LIVE',done:false,needsConfirmation:true});
    expect(proposal.preview).toContain('future billing');
    expect(f.calls).toHaveLength(0);
    const created=parse(await f.confirm('customer_create',{name:'Live Customer'}));
    expect(created).toMatchObject({mode:'LIVE',done:true,confirmed:true,
      resourceId:'cus_CREATEDLIVE'});
    const updated=parse(await f.confirm('customer_update',{customerId:cid,name:'New Name'}));
    expect(updated).toMatchObject({mode:'LIVE',done:true,confirmed:true,resourceId:cid});
    expect(f.customer().name).toBe('New Name');
    expect(f.calls.map(x=>x.name)).toEqual(['customer_create','customer_update']);
  });
  it('updates saved default payment method, detaches it, and verifies actual owner target',async()=>{
    const f=fixture();
    const set=parse(await f.confirm('customer_set_default_payment_method',{
      customerId:cid,paymentMethodId:pm}));
    expect(set).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    const detach=parse(await f.confirm('customer_remove_payment_method',{
      customerId:cid,paymentMethodId:pm}));
    expect(detach).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(f.method().customer).toBeNull();
  });
  it('adds/deletes exact LIVE tax ID and removes customer discount with fresh readback',async()=>{
    const f=fixture();
    const added=parse(await f.confirm('customer_add_tax_id',{
      customerId:cid,type:'eu_vat',value:'DE123456789'}));
    expect(added).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    const removed=parse(await f.confirm('customer_delete_tax_id',{
      customerId:cid,taxId:tid}));
    expect(removed).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    const discount=parse(await f.confirm('customer_remove_discount',{customerId:cid}));
    expect(discount).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(f.tax().deleted).toBe(true);
  });
  it('deletes exactly the selected LIVE customer only after irreversible-action approval',async()=>{
    const f=fixture();
    const proposal=parse(await f.invoke('customer_delete',{customerId:cid}));
    expect(proposal).toMatchObject({mode:'LIVE',done:false,needsConfirmation:true});
    expect(proposal.preview).toContain('destructive');
    expect(f.calls).toHaveLength(0);
    const done=parse(await f.confirm('customer_delete',{customerId:cid}));
    expect(done).toMatchObject({mode:'LIVE',done:true,confirmed:true,resourceId:cid});
    expect(f.customer().deleted).toBe(true);
  });
  it('refuses missing write grant, read_only, disabled account, TEST provider and forged financial operation',async()=>{
    for(const scenario of [
      {consent:false},{profile:'read_only'},{active:false},{providerMode:'test'}
    ]){
      const f=fixture(scenario);
      const outcome=await f.confirm('customer_update',{customerId:cid,name:'Forbidden'})
        .catch(()=>({isError:true}));
      expect(outcome.isError).toBe(true);
      expect(f.calls).toHaveLength(0);
    }
    const full=fixture();
    const money=await full.confirm('customer_add_balance_credit',{customerId:cid,
      creditCents:100,description:'Forbidden money without exact approval'});
    expect(money.isError).toBe(true);
    expect(full.calls).toHaveLength(0);
    const denied=await dispatchReadOnlyTool({registry,
      name:'customer_update',args:{customerId:cid,name:'Read-only',confirm:true},
      connection:{...full.ctx.connection,profile:'read_only'},
      db:full.db,services:full.ctx.services});
    expect(denied.isError).toBe(true);
    vi.stubEnv('VERCEL_ENV','preview');
    await expect(full.confirm('customer_create',{name:'Not in preview'}))
      .rejects.toThrow(/LIVE account/i);
    expect(full.calls).toHaveLength(0);
  });
  it('fails closed for application-owned records, opposite-mode readback and uncertain writes',async()=>{
    const owned=fixture({owned:true});
    const denied=await owned.confirm('customer_update',{customerId:cid,name:'No'})
      .catch(()=>({isError:true}));
    expect(denied.isError).toBe(true);
    expect(owned.calls).toHaveLength(0);
    const absent=fixture({missingMode:true});
    expect((await absent.invoke('customer_get',{customerId:cid})).isError).toBe(true);
    const stale=fixture({stale:true});
    const ambiguous=parse(await stale.confirm('customer_update',{customerId:cid,name:'Unseen'}));
    expect(ambiguous).toMatchObject({mode:'LIVE',done:false,confirmed:false});
    expect(stale.calls).toHaveLength(1);
  });
});
