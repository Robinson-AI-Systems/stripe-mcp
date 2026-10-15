// Batch P-1/P-2: versioned per-account app ownership and verified owner route links.
// The seed is public operational policy only: no provider keys or account IDs.
const metadataKeys=Object.freeze(['agreementId','estimateId','depositId','invoiceId',
  'refundId','creditId','rentalLineId','customerId','sessionId','kind',
  'rdf_record_id','rdf_payload_hash','rateVersionId','firstDeliveredOn']);
const webhookEvents=Object.freeze(['checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed','invoice.paid',
  'invoice.payment_failed','charge.refunded','customer.subscription.deleted']);
const permissions=Object.freeze({
  write:['customers','customer_balance_transactions','checkout_sessions',
    'subscriptions','products','prices','tax_rates','refunds','billing_portal_sessions'],
  read:['payment_intents','setup_intents','charges','invoices','invoice_payments',
    'balance_transactions','balance','payouts']
});
const landing=Object.freeze({
  agreementId:'/desk/agreements',rentalLineId:'/desk/agreements',
  firstDeliveredOn:'/desk/agreements',estimateId:'/desk/estimates',
  customerId:'/desk/customers',depositId:'/desk/billing/deposits',
  invoiceId:'/desk/billing',refundId:'/desk/billing',creditId:'/desk/billing',
  sessionId:'/desk/billing',kind:'/desk/agreements',
  rdf_record_id:'/desk/sales-tax/delivery-fees',
  rdf_payload_hash:'/desk/sales-tax/delivery-fees',
  rateVersionId:'/desk/sales-tax',});
const detail=Object.freeze({
  agreementId:'/desk/agreements/{value}',
  estimateId:'/desk/estimates/{value}',
  customerId:'/desk/customers/{value}',
  depositId:'/desk/billing/deposits/{value}'
});
export const APPLIANCE_DESK_SOURCE='docs/APP-NEEDS-APPLIANCE-DESK.md';
export const APP_SEED=Object.freeze({
  id:'appliance-desk',name:'Robinson Appliance Rentals',
  base_url:'https://robinsonappliancerentals.com',
  stripe_accounts:[],
  metadata_keys:metadataKeys,
  webhook_url:'https://robinsonappliancerentals.com/api/webhooks/stripe',
  webhook_events:webhookEvents,
  key_permissions:permissions,
  owns_catalog:true,owns_tax_rates:true,
  payment_methods:['card','us_bank_account'],
  checkout_modes:['payment','setup'],
  portal_rules:{allow_cancel:false,allow_plan_switch:false,
    allow_payment_method_update:true,allow_invoice_history:true},
  dashboard_settings:{failed_subscription:'past_due_invoice_open',
    customer_emails:'owner_decision_IN-09',smart_retries:'owner_decision_IN-08'},
  record_links:Object.fromEntries(metadataKeys.map(k=>[k,{landing:landing[k],
    ...(detail[k]?{detail:detail[k]}:{})}])),
  needs_rows:Array.from({length:21},(_,i)=>'S'+(i+1)),
  source:APPLIANCE_DESK_SOURCE
});
const appId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{2,63}$/.test(id);
const acct=id=>typeof id==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(id);
const safeKey=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(x);
function uniqueStrings(a,{max=80,test=safeKey}={}){
  if(!Array.isArray(a)||a.length>max||new Set(a).size!==a.length||!a.every(test))
    throw new TypeError('Invalid profile list or duplicates');
  return [...a];
}
export function validateProfile(p){
  if(!p||Array.isArray(p)||typeof p!=='object'||
    Object.keys(p).some(k=>!Object.hasOwn(APP_SEED,k)))
    throw new TypeError('Unknown or malformed application profile field');
  if(!appId(p.id)||typeof p.name!=='string'||p.name.length<2||p.name.length>140)
    throw new TypeError('Application identity or display name invalid');
  let base,url;
  try{
    base=new URL(p.base_url),url=new URL(p.webhook_url);
    if(base.protocol!=='https:'||base.origin!==p.base_url||base.username||base.password||
      url.protocol!=='https:'||url.username||url.password||!url.pathname.startsWith('/'))
      throw Error('Unsafe profile URLs');
  }catch{throw new TypeError('Verified HTTPS origin and webhook URL required');}
  const accounts=uniqueStrings(p.stripe_accounts,{max:20,test:acct});
  const keys=uniqueStrings(p.metadata_keys,{max:80,test:safeKey});
  const events=uniqueStrings(p.webhook_events,{max:100,test:x=>
    typeof x==='string'&&/^[a-z_]+(?:\.[a-z_]+)+$/.test(x)});
  if(typeof p.owns_catalog!=='boolean'||typeof p.owns_tax_rates!=='boolean'||
    !p.key_permissions||typeof p.key_permissions!=='object'||
    !p.portal_rules||typeof p.portal_rules!=='object')
    throw new TypeError('Incomplete application ownership or permission contract');
  const rp=p.record_links;
  if(!rp||typeof rp!=='object'||Array.isArray(rp)||
    Object.keys(rp).some(k=>!keys.includes(k)))
    throw new TypeError('Record links must map only declared metadata keys');
  for(const link of Object.values(rp)){
    if(!link||typeof link!=='object'||Object.keys(link).some(k=>!['landing','detail'].includes(k))||
      !/^(?:\/[a-z0-9-]+)+$/.test(link.landing)||link.landing.includes('//')||
      (link.detail!==undefined&&(!/^(?:\/[a-z0-9-]+)+\/\{value\}$/.test(link.detail))))
      throw new TypeError('Record links must be verified local paths without raw query strings');
  }
  const out={...p,stripe_accounts:accounts,metadata_keys:keys,
    webhook_events:events};
  return Object.freeze(out);
}
function safeMarker(value){
  return typeof value==='string'&&value.length>=3&&value.length<=100&&
    /^[A-Za-z0-9_-]+$/.test(value);
}
export function resolveAppRecordLink(profile,marker){
  const safe=validateProfile(profile);
  const def=safe.record_links[marker?.key];
  if(!def)return null;
  const value=marker.value;
  const to=def.detail&&safeMarker(value)?def.detail.replace('{value}',encodeURIComponent(value)):
    def.landing;
  return {app:safe.name,url:safe.base_url+to,route:to,
    deepLink:!!(def.detail&&safeMarker(value)),
    metadataKey:marker.key,
    // Link is a navigation hint, never authority to mutate Stripe or app data.
    source:'profile_route',verifiedAppRecord:false};
}
export async function initAppProfileTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS known_apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','disabled')),
    profile JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_profile_account_scope (
    stripe_account TEXT PRIMARY KEY REFERENCES stripe_accounts(id),
    scope TEXT NOT NULL DEFAULT 'legacy' CHECK (scope IN ('legacy','scoped')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS project_setup_runs (
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    project_id TEXT NOT NULL,
    digest TEXT NOT NULL CHECK (length(digest)=64),
    steps JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stripe_account,project_id)
  )`;
  const seed=JSON.stringify(validateProfile(APP_SEED));
  await sql`INSERT INTO known_apps(id,name,status,profile,version)
    VALUES ('appliance-desk','Robinson Appliance Rentals','active',${seed}::jsonb,1)
    ON CONFLICT (id) DO NOTHING`;
}
export function createAppProfileStore(sql){
  const setupStep=x=>['webhook','portal','methods','brand','product','price','draft'].includes(x);
  const setupInput=({account,id,digest,step})=>{
    if(!acct(account)||!appId(id)||typeof digest!=='string'||
      !/^[a-f0-9]{64}$/.test(digest)||(step!==undefined&&!setupStep(step)))
      throw new TypeError('Valid selected account, project, plan digest and step required');
  };
  return {
    async getProjectSetupRun({account,id}){
      if(!acct(account)||!appId(id))throw new TypeError('Exact selected project run required');
      const rows=await sql`SELECT digest,steps FROM project_setup_runs
        WHERE stripe_account=${account} AND project_id=${id}`;
      return rows[0]??null;
    },
    async reserveProjectSetupStep({account,id,digest,step}){
      setupInput({account,id,digest,step});
      const seed=JSON.stringify({[step]:{state:'pending'}});
      const result=await sql`INSERT INTO project_setup_runs(stripe_account,project_id,digest,steps)
        VALUES (${account},${id},${digest},${seed}::jsonb)
        ON CONFLICT (stripe_account,project_id) DO UPDATE SET
          steps=project_setup_runs.steps || ${seed}::jsonb,updated_at=now()
        WHERE project_setup_runs.digest=${digest}
          AND NOT (project_setup_runs.steps ? ${step})
        RETURNING digest,steps`;
      if(result.length===1)return {newlyReserved:true};
      const existing=await this.getProjectSetupRun({account,id});
      if(!existing||existing.digest!==digest)throw new TypeError(
        'Project plan changed; reconcile original run before new provider writes');
      return {newlyReserved:false,state:existing.steps?.[step]?.state??'unknown',
        receipt:existing.steps?.[step]??null};
    },
    async completeProjectSetupStep({account,id,digest,step,resourceId=null,details={}}){
      setupInput({account,id,digest,step});
      if(resourceId!==null&&(typeof resourceId!=='string'||
        !/^[a-z][a-z0-9]*_[A-Za-z0-9]{2,100}$/.test(resourceId)))
        throw new TypeError('Invalid verified setup resource ID');
      if(!details||typeof details!=='object'||Array.isArray(details)||
        Object.keys(details).some(k=>!['kind','status','manualRequired'].includes(k)))
        throw new TypeError('Only safe setup receipt fields may be stored');
      const receipt={state:'done',resourceId,...details};
      const value=JSON.stringify(receipt);
      const result=await sql`UPDATE project_setup_runs
        SET steps=jsonb_set(steps,ARRAY[${step}],${value}::jsonb),updated_at=now()
        WHERE stripe_account=${account} AND project_id=${id} AND digest=${digest}
          AND steps->${step}->>'state'='pending'
        RETURNING steps`;
      if(result.length!==1)throw new TypeError('Setup step not uniquely reserved');
      return receipt;
    },
    async createProjectDraft(profile){
      const valid=validateProfile(profile),value=JSON.stringify(valid);
      await sql`INSERT INTO known_apps(id,name,status,profile,version)
        VALUES (${valid.id},${valid.name},'draft',${value}::jsonb,1)
        ON CONFLICT (id) DO NOTHING`;
      const rows=await sql`SELECT id,status,version FROM known_apps
        WHERE id=${valid.id} AND status='draft' AND profile=${value}::jsonb`;
      if(rows.length!==1)
        throw new TypeError('Project draft already exists with a different plan or is active');
      return {id:rows[0].id,status:'draft',version:Number(rows[0].version)};
    },
    async getKnownApp(id){
      if(!appId(id))throw new TypeError('Valid app ID required');
      const x=await sql`SELECT id,name,status,profile,version,updated_at
        FROM known_apps WHERE id=${id}`;
      return x[0]?{...x[0],profile:validateProfile(x[0].profile),
        version:Number(x[0].version)}:null;
    },
    async listKnownApps(){
      const x=await sql`SELECT id,name,status,profile,version,updated_at
        FROM known_apps ORDER BY id LIMIT 100`;
      return x.map(v=>({...v,profile:validateProfile(v.profile),
        version:Number(v.version)}));
    },
    async listKnownAppsForAccount(account){
      if(!acct(account))throw new TypeError('Valid selected account required');
      const x=await sql`SELECT id,name,status,profile,version FROM known_apps
        WHERE status='active' AND profile->'stripe_accounts' ? ${account}
        ORDER BY id LIMIT 100`;
      return x.map(v=>({...v,profile:validateProfile(v.profile),
        version:Number(v.version)}));
    },
    async getAppGuardScope(account){
      if(!acct(account))throw new TypeError('Valid selected account required');
      const x=await sql`SELECT scope FROM app_profile_account_scope
        WHERE stripe_account=${account}`;
      return x[0]?.scope??'legacy';
    },
    async bindKnownAppAccount({id,account,expectedVersion,attach=true}){
      if(!appId(id)||!acct(account)||!Number.isSafeInteger(expectedVersion)||
        expectedVersion<1||typeof attach!=='boolean')
        throw new TypeError('Exact app, account, revision and binding action required');
      const selected=await this.getKnownApp(id);
      if(!selected||selected.version!==expectedVersion)
        throw new Error('Application profile revision changed; refresh first');
      const accounts=selected.profile.stripe_accounts;
      const next=validateProfile({...selected.profile,
        stripe_accounts:attach?[...new Set([...accounts,account])]:
          accounts.filter(a=>a!==account)});
      const value=JSON.stringify(next);
      const x=await sql`UPDATE known_apps SET profile=${value}::jsonb,
        version=version+1,updated_at=now()
        WHERE id=${id} AND status='active' AND version=${expectedVersion}
          AND EXISTS(SELECT 1 FROM stripe_accounts WHERE id=${account})
        RETURNING id,version,profile`;
      if(x.length!==1)throw new Error('Profile/account revision changed or account missing');
      return {id,version:Number(x[0].version),profile:validateProfile(x[0].profile)};
    },
    async enableScopedAppGuard({account,expectedScope='legacy'}){
      if(!acct(account)||expectedScope!=='legacy')
        throw new TypeError('Explicit legacy-to-scoped migration required');
      const x=await sql`INSERT INTO app_profile_account_scope(stripe_account,scope)
        SELECT id,'scoped' FROM stripe_accounts WHERE id=${account}
          AND EXISTS(SELECT 1 FROM known_apps
            WHERE status='active' AND profile->'stripe_accounts' ? ${account})
        ON CONFLICT (stripe_account) DO UPDATE SET
          scope='scoped',updated_at=now()
        WHERE app_profile_account_scope.scope=${expectedScope}
        RETURNING scope`;
      if(x.length!==1)throw new Error('Owner scope change not verified');
      return x[0].scope;
    }
  };
}
