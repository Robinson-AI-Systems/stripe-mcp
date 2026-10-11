// Resumable TEST-clock subscription renewal failure with provider evidence only.
// Clock objects have no metadata in Stripe; the exact run name + ledger ID bind them.
const idPatterns={test_clock:/^clock_[A-Za-z0-9]{2,100}$/,
  product:/^prod_[A-Za-z0-9]{2,100}$/,price:/^price_[A-Za-z0-9]{2,100}$/,
  customer:/^cus_[A-Za-z0-9]{2,100}$/,subscription:/^sub_[A-Za-z0-9]{2,100}$/,
  invoice:/^in_[A-Za-z0-9]{2,100}$/};
const objectKind={test_clock:'test_helpers.test_clock',product:'product',
  price:'price',customer:'customer',subscription:'subscription',invoice:'invoice'};
const ref=x=>typeof x==='string'?x:x?.id;
const error=x=>{throw new TypeError(x);};
const target=p=>p.frozenTime+8*86400;
const clockName=(p,i)=>'RTC DEV RUN '+p.runId+' '+i;
function expectedClock(v,p,i){
  return v?.object==='test_helpers.test_clock'&&v.livemode===false&&
    v.name===clockName(p,i)&&
    (v.frozen_time===p.frozenTime||v.frozen_time===target(p))&&
    ['ready','advancing'].includes(v.status)&&
    (v.status!=='advancing'||v.status_details?.advancing?.target_frozen_time===target(p));
}
function expectedSub(v,p,customer,price){
  return v?.object==='subscription'&&v.livemode!==true&&
    v.metadata?.rtc_run===p.runId&&ref(v.customer)===customer&&
    ['trialing','past_due'].includes(v.status)&&
    Array.isArray(v.items?.data)&&
    v.items.data.some(item=>ref(item.price)===price);
}
const trialInvoice=(x,p,c)=>x?.object==='invoice'&&x.livemode!==true&&
  x.metadata?.rtc_run===p.runId&&ref(x.customer)===c&&
  x.status==='paid'&&x.currency==='usd'&&x.amount_due===0&&x.amount_paid===0;
const dueInvoice=(x,p,c,cents)=>x?.object==='invoice'&&x.livemode!==true&&
  x.metadata?.rtc_run===p.runId&&ref(x.customer)===c&&
  x.status==='open'&&x.currency==='usd'&&x.amount_due===cents&&
  x.amount_remaining===cents&&x.amount_paid===0&&
  x.attempted===true&&Number.isInteger(x.attempt_count)&&x.attempt_count>=1;
export async function executeLateSubscription({plan,run,stripe:s,db,account,rootKey}){
  if(plan.scenario!=='subscription-past-due')error('Only overdue TEST scenario is supported');
  if(run.status==='completed')return run;
  if(run.status!=='running'||Date.now()-new Date(run.created_at).getTime()>43200000)
    error('Expired or uncertain clocked seed run requires manual review');
  if(!Number.isSafeInteger(plan.frozenTime)||plan.frozenTime<946684800||
    target(plan)>4102444800)error('Immutable starting TEST clock time is invalid');
  const rows=await db.getDevRunObjects({account,id:plan.runId});
  const known=new Map(rows.map(x=>[x.step_name,x]));
  const metadata={rtc_run:plan.runId};
  async function ensure({step,type,create,read,validate}){
    const old=known.get(step),rx=idPatterns[type];
    if(!rx)error('Unexpected TEST provider type');
    let id;
    if(old){
      if(old.cleaned!==false||old.object_type!==type||!rx.test(old.object_id))
        error('Recorded TEST object identity is inconsistent');
      id=old.object_id;
    }else{
      const made=await create({idempotencyKey:rootKey+'_'+step});
      if(!made||made.object!==objectKind[type]||!rx.test(made.id??'')||
        made.livemode===true)
        error('Stripe did not acknowledge the expected TEST object');
      id=made.id;
    }
    const value=await read(id);
    if(value?.id!==id||value.object!==objectKind[type]||
      !rx.test(value.id)||!validate(value))
      error('Independent TEST '+step+' provider read-back did not match plan');
    if(!old){
      if(!(await db.recordDevRunObject({account,id:plan.runId,
        stepName:step,objectType:type,objectId:id})))
        throw Error('Provider TEST object created but durable ledger unavailable');
      known.set(step,{step_name:step,object_type:type,object_id:id,cleaned:false});
    }
    return value;
  }
  for(let i=1;i<=plan.size;i++){
    const cents=3500+i*100;
    const clock=await ensure({
      step:'clock_'+i,type:'test_clock',
      create:opts=>s.testHelpers.testClocks.create({
        frozen_time:plan.frozenTime,name:clockName(plan,i)},opts),
      read:id=>s.testHelpers.testClocks.retrieve(id),
      validate:x=>expectedClock(x,plan,i)
    });
    const product=await ensure({
      step:'product_'+i,type:'product',
      create:opts=>s.products.create({name:'RTC Test Product '+i,metadata},opts),
      read:id=>s.products.retrieve(id),
      validate:x=>x.metadata?.rtc_run===plan.runId&&x.livemode!==true
    });
    const price=await ensure({
      step:'price_'+i,type:'price',
      create:opts=>s.prices.create({product:product.id,currency:'usd',
        unit_amount:cents,recurring:{interval:'month'},metadata},opts),
      read:id=>s.prices.retrieve(id),
      validate:x=>x.metadata?.rtc_run===plan.runId&&
        ref(x.product)===product.id&&x.currency==='usd'&&x.unit_amount===cents&&
        x.recurring?.interval==='month'&&x.livemode!==true
    });
    const customer=await ensure({
      step:'customer_'+i,type:'customer',
      create:opts=>s.customers.create({
        name:'RTC Test Customer '+i,
        email:'rtc-test+'+plan.runId+'-'+i+'@example.test',
        payment_method:'pm_card_chargeCustomerFail',
        invoice_settings:{default_payment_method:'pm_card_chargeCustomerFail'},
        test_clock:clock.id,metadata
      },opts),
      read:id=>s.customers.retrieve(id),
      validate:x=>x.metadata?.rtc_run===plan.runId&&x.livemode!==true&&
        ref(x.test_clock)===clock.id&&
        ref(x.invoice_settings?.default_payment_method)==='pm_card_chargeCustomerFail'
    });
    const subscription=await ensure({
      step:'subscription_'+i,type:'subscription',
      create:opts=>s.subscriptions.create({customer:customer.id,
        items:[{price:price.id}],collection_method:'charge_automatically',
        billing_mode:{type:'flexible'},payment_behavior:'error_if_incomplete',
        proration_behavior:'none',trial_period_days:7,metadata},opts),
      read:id=>s.subscriptions.retrieve(id),
      validate:x=>expectedSub(x,plan,customer.id,price.id)
    });
    const firstInvoice=ref(subscription.latest_invoice);
    if(!known.has('trial_invoice_'+i)&&!idPatterns.invoice.test(firstInvoice??''))
      error('Trial subscription has no provider-linked initial zero-dollar invoice');
    const trialId=known.get('trial_invoice_'+i)?.object_id??firstInvoice;
    await ensure({
      step:'trial_invoice_'+i,type:'invoice',
      create:async opts=>{
        const x=await s.invoices.retrieve(trialId);
        if(x?.object!=='invoice'||ref(x.customer)!==customer.id||
          x.status!=='paid'||x.amount_due!==0||x.amount_paid!==0)
          error('Initial TEST trial invoice not paid at zero amount');
        return s.invoices.update(trialId,{metadata},opts);
      },
      read:id=>s.invoices.retrieve(id),
      validate:x=>trialInvoice(x,plan,customer.id)
    });
    const now=await s.testHelpers.testClocks.retrieve(clock.id);
    if(!expectedClock(now,plan,i))
      error('Provider TEST clock identity changed before advance');
    if(now.status==='ready'&&now.frozen_time===plan.frozenTime){
      const accepted=await s.testHelpers.testClocks.advance(clock.id,{
        frozen_time:target(plan)
      },{idempotencyKey:rootKey+'_advance_'+i});
      if(accepted?.id!==clock.id||accepted.object!=='test_helpers.test_clock'||
        accepted.livemode===true||!['ready','advancing'].includes(accepted.status))
        error('Stripe did not acknowledge expected TEST clock advance');
    }
    const afterClock=await s.testHelpers.testClocks.retrieve(clock.id);
    if(!expectedClock(afterClock,plan,i))
      error('Clock advancement read-back did not match the planned run');
    if(afterClock.status==='advancing'||afterClock.frozen_time!==target(plan))
      return db.getDevRun({account,requestKey:run.request_key});
    const afterSub=await s.subscriptions.retrieve(subscription.id);
    if(!expectedSub(afterSub,plan,customer.id,price.id))
      error('Clocked subscription identity changed');
    if(afterSub.status==='trialing')
      return db.getDevRun({account,requestKey:run.request_key});
    if(afterSub.status!=='past_due')
      error('Stripe never proved a past-due renewal');
    const failedId=ref(afterSub.latest_invoice);
    if(!idPatterns.invoice.test(failedId??'')||failedId===trialId)
      error('Past-due subscription lacks a distinct failed renewal invoice');
    await ensure({
      step:'failed_invoice_'+i,type:'invoice',
      create:async opts=>{
        const x=await s.invoices.retrieve(failedId);
        if(x?.object!=='invoice'||ref(x.customer)!==customer.id||
          x.status!=='open'||x.amount_remaining!==cents||
          x.attempted!==true||x.attempt_count<1)
          error('Stripe has not verified an attempted and unpaid renewal invoice');
        return s.invoices.update(failedId,{metadata},opts);
      },
      read:id=>s.invoices.retrieve(id),
      validate:x=>dueInvoice(x,plan,customer.id,cents)
    });
  }
  if(!(await db.completeDevRun({account,id:plan.runId,
    expectedSteps:plan.expectedSteps})))
    throw Error('Unverified TEST subscription renewal ledger incomplete');
  return db.getDevRun({account,requestKey:run.request_key});
}
