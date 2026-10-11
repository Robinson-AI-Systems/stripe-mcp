// TEST Connect seller-onboarding fixtures: no charges, transfers or payouts.
const idPattern={product:/^prod_[A-Za-z0-9]{2,100}$/,
  price:/^price_[A-Za-z0-9]{2,100}$/,customer:/^cus_[A-Za-z0-9]{2,100}$/,
  connected_account:/^acct_[A-Za-z0-9]{2,100}$/};
const providerType={product:'product',price:'price',customer:'customer',
  connected_account:'account'};
const id=x=>typeof x==='string'?x:x?.id;
const fail=message=>{throw new TypeError(message);};
export async function verifyConnectReadiness(stripe,account){
  if(!/^acct_[A-Za-z0-9]{2,100}$/.test(account??''))
    fail('Selected Stripe TEST account is invalid');
  const platform=await stripe.accounts.retrieve();
  if(platform?.object!=='account'||platform.id!==account||platform.livemode!==false)
    fail('Selected TEST account was not independently verified as a Stripe platform');
  const list=await stripe.accounts.list({limit:1});
  if(list?.object!=='list'||!Array.isArray(list.data)||
    typeof list.has_more!=='boolean'||list.data.length>1)
    fail('Stripe Connect account listing is unavailable or unverified');
  return {platformAccount:account,connectAccessVerified:true,mode:'test',
    existingConnectedAccountSample:list.data.length,
    platformTransferCapability:platform.capabilities?.transfers??null,
    note:'Connect account API access verified, NOT transfer or payout eligibility.'};
}
const accountEmail=(plan,i)=>'rtc-dev+'+plan.runId+'-'+i+'@example.test';
async function ensure({step,type,runId,account,db,existing,stripe,rootKey,
  create,retrieve,verify}){
  const previous=existing.get(step);
  if(previous&&(previous.cleaned!==false||previous.object_type!==type||
    !idPattern[type].test(previous.object_id)))
    fail('Run ledger contains a mismatched or cleaned TEST object');
  let result;
  if(previous){
    result=await retrieve(previous.object_id);
  }else{
    const created=await create({idempotencyKey:rootKey+'_'+step});
    if(created?.object!==providerType[type]||!idPattern[type].test(created.id??'')||
      created.livemode===true)
      fail('Stripe did not acknowledge the expected TEST Connect fixture');
    result=await retrieve(created.id);
    if(result?.id!==created.id)fail('Independent TEST provider ID read-back mismatch');
  }
  if(result?.object!==providerType[type]||
    result.livemode!==false||
    !idPattern[type].test(result.id??'')||
    (previous&&result.id!==previous.object_id)||!verify(result))
    fail('Stripe TEST '+step+' provenance or business properties did not match');
  if(!previous){
    const written=await db.recordDevRunObject({account,id:runId,
      stepName:step,objectType:type,objectId:result.id});
    if(!written)throw Error('Provider Connect fixture exists but ledger is uncertain');
    existing.set(step,{step_name:step,object_type:type,object_id:result.id,
      cleaned:false});
  }
  return result;
}
export async function executeMarketplaceSeed({plan,run,stripe,db,account,rootKey}){
  if(plan.scenario!=='marketplace-onboarding')fail('Invalid TEST marketplace plan');
  if(run.status==='completed')return run;
  if(run.status!=='running'||
    Date.now()-new Date(run.created_at).getTime()>43200000)
    fail('Stale or uncertain TEST marketplace run requires review');
  await verifyConnectReadiness(stripe,account); // MUST precede any provider mutation
  const prior=await db.getDevRunObjects({account,id:plan.runId});
  if(!Array.isArray(prior))fail('Run object ledger is unavailable');
  const existing=new Map(prior.map(o=>[o.step_name,o]));
  const metadata={rtc_run:plan.runId};
  for(let i=1;i<=plan.size;i++){
    const priceCents=3500+i*100;
    const product=await ensure({step:'product_'+i,type:'product',
      runId:plan.runId,account,db,existing,stripe,rootKey,
      create:opts=>stripe.products.create({
        name:'RTC TEST Marketplace Product '+i,metadata},opts),
      retrieve:productId=>stripe.products.retrieve(productId),
      verify:p=>p.metadata?.rtc_run===plan.runId&&
        p.name==='RTC TEST Marketplace Product '+i});
    const price=await ensure({step:'price_'+i,type:'price',
      runId:plan.runId,account,db,existing,stripe,rootKey,
      create:opts=>stripe.prices.create({
        product:product.id,currency:'usd',unit_amount:priceCents,metadata},opts),
      retrieve:priceId=>stripe.prices.retrieve(priceId),
      verify:p=>p.metadata?.rtc_run===plan.runId&&
        id(p.product)===product.id&&p.currency==='usd'&&
        p.unit_amount===priceCents&&p.type==='one_time'});
    await ensure({step:'customer_'+i,type:'customer',
      runId:plan.runId,account,db,existing,stripe,rootKey,
      create:opts=>stripe.customers.create({
        name:'RTC TEST Marketplace Buyer '+i,
        email:accountEmail(plan,i),metadata},opts),
      retrieve:customerId=>stripe.customers.retrieve(customerId),
      verify:p=>p.metadata?.rtc_run===plan.runId&&
        p.email===accountEmail(plan,i)});
    const connected=await ensure({step:'connected_account_'+i,
      type:'connected_account',runId:plan.runId,account,db,existing,stripe,rootKey,
      create:opts=>stripe.accounts.create({
        type:'express',country:'US',email:accountEmail(plan,i),
        capabilities:{transfers:{requested:true}},metadata},opts),
      retrieve:connectedId=>stripe.accounts.retrieve(connectedId),
      verify:p=>p.id!==account&&p.type==='express'&&p.country==='US'&&
        p.metadata?.rtc_run===plan.runId&&p.email===accountEmail(plan,i)});
    // Incomplete Connect onboarding must not be mistaken for payout capability.
    if(!connected.capabilities||
      !['active','inactive','pending'].includes(connected.capabilities.transfers))
      fail('Stripe TEST connected-account transfer capability was not verifiable');
    if(!idPattern.price.test(price.id))fail('TEST price not verified');
  }
  if(!(await db.completeDevRun({account,id:plan.runId,
    expectedSteps:plan.expectedSteps})))
    throw Error('TEST marketplace ledger does not contain every exact record');
  return db.getDevRun({account,requestKey:run.request_key});
}
