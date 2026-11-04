// CAP-4 Connect slice 2: native lifecycle WRITES for connected
// accounts, on the guarded defineWrite lifecycle slice 1's reads
// precede. The platform account (the enrolled connection's own
// account) is verified as the actor inside every read() — before any
// call that touches a connected account — reusing slice 1's
// platformAccount exactly. Connected objects verify livemode against
// the connection mode through slice 1's safe projections wherever
// they appear (before-state, apply results, read-backs); Account
// objects follow the projected readers' documented tolerance (a
// present livemode must match; the mode seam itself is the verified
// platform read). Person surfaces carry slice 1's safe fields only:
// previews and summaries name the FIELDS being set, never identity
// values, and verification compares raw provider state internally
// without projecting it anywhere. The two link tools are the card's
// minting exception (rulings 3 and 5): Stripe offers no read-back,
// list or revoke for a minted link, so read-back verification is the
// provider-evidenced disposition recorded in the slice-2 JIT card —
// the account is re-read and verified unchanged after minting, the
// minted URL is validated against the exact account, and the URL
// itself is attached to the confirmed result only: never to the
// preview, the audit record, a summary or a log.
import {defineWrite} from './write.js';
import {client,fullProfiles,validateMetadata,reply} from
  './billing-shared.js';
import {platformAccount,connectAccountSafe,connectCapabilitySafe,
  connectPersonSafe,connectExternalAccountSafe} from './connect-reads.js';

const reject=m=>{throw new TypeError(m);};
const acctId=v=>typeof v==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(v);
const personId=v=>typeof v==='string'&&
  /^person_[A-Za-z0-9]{2,100}$/.test(v);
const externalId=v=>typeof v==='string'&&
  /^(ba|card)_[A-Za-z0-9]{2,100}$/.test(v);
const capabilityId=v=>typeof v==='string'&&
  /^[a-z][a-z0-9_]{1,80}$/.test(v);
const modeName=ctx=>ctx.connection.mode.toUpperCase()+' MODE';
const modeBool=ctx=>ctx.connection.mode==='live';

function validate(a,allowed,required=[]){
  if(!a||typeof a!=='object'||Array.isArray(a))
    reject('Exact Connect write arguments required');
  for(const k of Object.keys(a))if(!allowed.includes(k))
    reject('Unsupported argument: '+k);
  for(const k of required)if(a[k]===undefined)
    reject('Missing required argument: '+k);
}
function text(v,label,min,max){
  if(typeof v!=='string'||v.length<min||v.length>max||
    /[\r\n\0]/.test(v))reject('Invalid '+label);
  return v;
}
function accountArg(a){
  if(!acctId(a.account))reject('Exact connected account ID required');
  return a.account;
}
// Actor verification runs first inside every read(): the mode client
// resolves (LIVE only through the verified seam), then slice 1's
// platformAccount proves the provider account IS the enrolled
// platform account. A non-platform connection refuses here, before
// any connected-account call is made.
async function actor(ctx){
  const s=await client(ctx);
  const platform=await platformAccount(s,ctx);
  return {s,platform};
}
async function connectedAccount(s,a,ctx){
  const v=await s.accounts.retrieve(accountArg(a));
  if(v?.id!==a.account)reject('Exact connected account unavailable');
  connectAccountSafe(v,ctx.connection.mode);
  return v;
}
function metadataArg(a){
  if(a.metadata===undefined)return undefined;
  validateMetadata(a.metadata);
  return a.metadata;
}
function metadataMatches(after,want){
  if(!want)return true;
  const got=after?.metadata??{};
  return Object.entries(want).every(([k,v])=>got[k]===v);
}

// --- Account create / update -------------------------------------------
function createParams(a){
  const p={type:a.type};
  if(a.country!==undefined)p.country=a.country;
  if(a.businessType!==undefined)p.business_type=a.businessType;
  if(a.businessName!==undefined)p.business_profile={name:a.businessName};
  if(a.defaultCurrency!==undefined)p.default_currency=a.defaultCurrency;
  const m=metadataArg(a);if(m!==undefined)p.metadata=m;
  return p;
}
function checkCreateArgs(a){
  validate(a,['type','country','businessType','businessName',
    'defaultCurrency','metadata','dryRun','confirm','requestKey'],
    ['type']);
  if(!['express','custom','standard'].includes(a.type))
    reject('Connected account type must be express, custom or standard');
  if(a.country!==undefined&&!/^[A-Z]{2}$/.test(a.country??''))
    reject('Country must be a two-letter code');
  if(a.businessType!==undefined&&
    !['company','individual','non_profit','government_entity']
      .includes(a.businessType))reject('Invalid business type');
  if(a.businessName!==undefined)text(a.businessName,'business name',1,200);
  if(a.defaultCurrency!==undefined&&
    !/^[a-z]{3}$/.test(a.defaultCurrency??''))
    reject('Default currency must be a three-letter code');
  metadataArg(a);
}
export function makeConnectCreateAccount(){
  let createdId=null;
  const op=defineWrite({
    name:'connect_create_account',
    read:async(a,ctx)=>{
      checkCreateArgs(a);
      const {platform}=await actor(ctx);
      return {object:'connect_account_creation',platform:platform.id,
        params:createParams(a)};
    },
    summarize:(p,_a,ctx)=>modeName(ctx)+'. Platform account '+
      ctx.connection.stripeAccount+' (verified actor) creates a new '+
      p.params.type+' connected account. Exact create fields: '+
      Object.keys(p.params).join(', ')+'. The new account ID is '+
      'assigned by Stripe and verified by read-back after creation.',
    apply:async(a,ctx,{before,idempotencyKey})=>{
      const {s}=await actor(ctx);
      const created=await s.accounts.create(before.params,
        {idempotencyKey});
      if(created?.object!=='account'||!acctId(created.id)||
        (created.livemode!==undefined&&
          created.livemode!==modeBool(ctx)))
        reject('Provider account creation returned no verified account');
      connectAccountSafe(created,ctx.connection.mode);
      createdId=created.id;
    },
    readAfter:async(_a,ctx)=>{
      const {s}=await actor(ctx);
      return s.accounts.retrieve(createdId);
    },
    verify:(before,after,a,ctx)=>{
      if(after?.id!==createdId)return false;
      try{connectAccountSafe(after,ctx.connection.mode);}catch{return false;}
      return after.type===before.params.type;
    },
    resultId:()=>createdId
  });
  return {...op,handler:(a,ctx)=>{createdId=null;return op.handler(a,ctx);}};
}
function updateParams(a){
  const p={},profile={};
  if(a.businessName!==undefined)profile.name=a.businessName;
  if(a.businessUrl!==undefined)profile.url=a.businessUrl;
  if(Object.keys(profile).length)p.business_profile=profile;
  if(a.businessType!==undefined)p.business_type=a.businessType;
  const m=metadataArg(a);if(m!==undefined)p.metadata=m;
  return p;
}
function checkUpdateAccountArgs(a){
  validate(a,['account','businessName','businessUrl','businessType',
    'metadata','outsideApp','dryRun','confirm','requestKey'],['account']);
  accountArg(a);
  if(a.businessName===undefined&&a.businessUrl===undefined&&
    a.businessType===undefined&&a.metadata===undefined)
    reject('Name at least one account field to change');
  if(a.businessName!==undefined)text(a.businessName,'business name',1,200);
  if(a.businessUrl!==undefined){
    text(a.businessUrl,'business URL',1,2048);
    if(!/^https?:\/\/\S+$/.test(a.businessUrl))
      reject('Business URL must be an http(s) URL');
  }
  if(a.businessType!==undefined&&
    !['company','individual','non_profit','government_entity']
      .includes(a.businessType))reject('Invalid business type');
  metadataArg(a);
}
const connectUpdateAccount=defineWrite({
  name:'connect_update_account',
  read:async(a,ctx)=>{
    checkUpdateAccountArgs(a);
    const {s}=await actor(ctx);
    return connectedAccount(s,a,ctx);
  },
  summarize:(before,a,ctx)=>{
    const safe=connectAccountSafe(before,ctx.connection.mode);
    return modeName(ctx)+'. Platform account '+
      ctx.connection.stripeAccount+' (verified actor) updates '+
      'connected account '+a.account+'. Exact fields set: '+
      Object.keys(updateParams(a)).join(', ')+'. Before: '+safe.type+
      ' account, charges enabled '+safe.chargesEnabled+', payouts '+
      'enabled '+safe.payoutsEnabled+'.';
  },
  apply:async(a,ctx,{idempotencyKey})=>{
    const {s}=await actor(ctx);
    await s.accounts.update(a.account,updateParams(a),{idempotencyKey});
  },
  readAfter:async(a,ctx)=>{
    const {s}=await actor(ctx);
    return s.accounts.retrieve(a.account);
  },
  verify:(before,after,a,ctx)=>{
    if(after?.id!==a.account)return false;
    try{connectAccountSafe(after,ctx.connection.mode);}catch{return false;}
    const p=updateParams(a);
    if(p.business_profile?.name!==undefined&&
      after.business_profile?.name!==p.business_profile.name)return false;
    if(p.business_profile?.url!==undefined&&
      after.business_profile?.url!==p.business_profile.url)return false;
    if(p.business_type!==undefined&&
      after.business_type!==p.business_type)return false;
    return metadataMatches(after,p.metadata);
  }
});

// --- Persons -------------------------------------------------------------
// Identity values are accepted as inputs (the platform legitimately
// collects them) but are NEVER projected: previews and summaries
// name fields only, results carry no person body, and the audit
// record stores the field-name summary only. Document data, ID
// numbers and addresses are not a tool surface at all — hosted
// onboarding through account links collects those from the account
// holder directly.
const personAllowed=['account','person','firstName','lastName','email',
  'phone','dobDay','dobMonth','dobYear','owner','director',
  'representative','executive','percentOwnership','outsideApp',
  'dryRun','confirm','requestKey'];
function checkPersonArgs(a,{existing}){
  validate(a,personAllowed,existing?['account','person']:['account']);
  accountArg(a);
  if(existing&&!personId(a.person))
    reject('Exact person ID required');
  if(a.firstName!==undefined)text(a.firstName,'first name',1,100);
  if(a.lastName!==undefined)text(a.lastName,'last name',1,100);
  if(a.email!==undefined){
    text(a.email,'email',3,200);
    if(!a.email.includes('@'))reject('Invalid email');
  }
  if(a.phone!==undefined)text(a.phone,'phone',1,32);
  const dob=['dobDay','dobMonth','dobYear']
    .filter(k=>a[k]!==undefined);
  if(dob.length&&dob.length!==3)
    reject('Date of birth needs day, month and year together');
  if(dob.length){
    if(!Number.isInteger(a.dobDay)||a.dobDay<1||a.dobDay>31||
      !Number.isInteger(a.dobMonth)||a.dobMonth<1||a.dobMonth>12||
      !Number.isInteger(a.dobYear)||a.dobYear<1900||a.dobYear>2025)
      reject('Invalid date of birth');
  }
  for(const k of ['owner','director','representative','executive'])
    if(a[k]!==undefined&&typeof a[k]!=='boolean')
      reject('Relationship flags must be boolean');
  if(a.percentOwnership!==undefined&&
    (typeof a.percentOwnership!=='number'||
      a.percentOwnership<0||a.percentOwnership>100))
    reject('Percent ownership must be between 0 and 100');
  if(Object.keys(personParams(a)).length===0)
    reject(existing?'Name at least one person field to change':
      'Name at least one person field to set');
}
function personParams(a){
  const p={};
  if(a.firstName!==undefined)p.first_name=a.firstName;
  if(a.lastName!==undefined)p.last_name=a.lastName;
  if(a.email!==undefined)p.email=a.email;
  if(a.phone!==undefined)p.phone=a.phone;
  if(a.dobDay!==undefined)
    p.dob={day:a.dobDay,month:a.dobMonth,year:a.dobYear};
  const rel={};
  for(const k of ['owner','director','representative','executive'])
    if(a[k]!==undefined)rel[k]=a[k];
  if(a.percentOwnership!==undefined)
    rel.percent_ownership=a.percentOwnership;
  if(Object.keys(rel).length)p.relationship=rel;
  return p;
}
function personFieldNames(a){
  const p=personParams(a),names=[];
  for(const [k,v] of Object.entries(p)){
    if(k==='dob')names.push('dob');
    else if(k==='relationship')
      names.push(...Object.keys(v).map(r=>'relationship.'+r));
    else names.push(k);
  }
  return names;
}
function personMatches(observed,params){
  for(const [k,v] of Object.entries(params)){
    if(k==='dob'){
      if(observed?.dob?.day!==v.day||observed?.dob?.month!==v.month||
        observed?.dob?.year!==v.year)return false;
    }else if(k==='relationship'){
      for(const [rk,rv] of Object.entries(v))
        if(observed?.relationship?.[rk]!==rv)return false;
    }else if(observed?.[k]!==v)return false;
  }
  return true;
}
async function existingPerson(s,a,ctx){
  const v=await s.accounts.retrievePerson(a.account,a.person);
  if(v?.id!==a.person)reject('Exact connected-account person unavailable');
  connectPersonSafe(v,a.account,ctx.connection.mode);
  return v;
}
export function makeConnectCreatePerson(){
  let createdId=null;
  const op=defineWrite({
    name:'connect_create_person',
    read:async(a,ctx)=>{
      checkPersonArgs(a,{existing:false});
      const {s}=await actor(ctx);
      return connectedAccount(s,a,ctx);
    },
    summarize:(before,a,ctx)=>{
      const safe=connectAccountSafe(before,ctx.connection.mode);
      return modeName(ctx)+'. Platform account '+
        ctx.connection.stripeAccount+' (verified actor) creates a '+
        'person on connected account '+a.account+' ('+safe.type+
        '). Exact fields set: '+personFieldNames(a).join(', ')+
        '. Identity values are never shown in previews, results '+
        'or audit records.';
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const {s}=await actor(ctx);
      const created=await s.accounts.createPerson(a.account,
        personParams(a),{idempotencyKey});
      connectPersonSafe(created,a.account,ctx.connection.mode);
      if(created.id===undefined)reject('Person creation unverified');
      createdId=created.id;
    },
    readAfter:async(a,ctx)=>{
      const {s}=await actor(ctx);
      return s.accounts.retrievePerson(a.account,createdId);
    },
    verify:(_before,after,a,ctx)=>{
      if(after?.id!==createdId)return false;
      try{connectPersonSafe(after,a.account,ctx.connection.mode);}
      catch{return false;}
      return personMatches(after,personParams(a));
    },
    resultId:()=>createdId
  });
  return {...op,handler:(a,ctx)=>{createdId=null;return op.handler(a,ctx);}};
}
const connectUpdatePerson=defineWrite({
  name:'connect_update_person',
  read:async(a,ctx)=>{
    checkPersonArgs(a,{existing:true});
    const {s}=await actor(ctx);
    return existingPerson(s,a,ctx);
  },
  summarize:(before,a,ctx)=>{
    const safe=connectPersonSafe(before,a.account,ctx.connection.mode);
    return modeName(ctx)+'. Platform account '+
      ctx.connection.stripeAccount+' (verified actor) updates '+
      'person '+a.person+' on connected account '+a.account+
      '. Exact fields set: '+personFieldNames(a).join(', ')+
      '. Before: verification '+safe.verificationStatus+', owner '+
      safe.relationship.owner+', representative '+
      safe.relationship.representative+'. Identity values are '+
      'never shown in previews, results or audit records.';
  },
  apply:async(a,ctx,{idempotencyKey})=>{
    const {s}=await actor(ctx);
    await s.accounts.updatePerson(a.account,a.person,personParams(a),
      {idempotencyKey});
  },
  readAfter:async(a,ctx)=>{
    const {s}=await actor(ctx);
    return s.accounts.retrievePerson(a.account,a.person);
  },
  verify:(_before,after,a,ctx)=>{
    if(after?.id!==a.person)return false;
    try{connectPersonSafe(after,a.account,ctx.connection.mode);}
    catch{return false;}
    return personMatches(after,personParams(a));
  }
});
async function readBackDeleted(s,a,ctx,kind){
  try{
    const v=kind==='person'?
      await s.accounts.retrievePerson(a.account,a.person):
      await s.accounts.retrieveExternalAccount(a.account,
        a.externalAccount);
    return v;
  }catch(e){
    if(e?.code==='resource_missing'||e?.statusCode===404)
      return {id:kind==='person'?a.person:a.externalAccount,
        object:kind,deleted:true,account:a.account,
        livemode:modeBool(ctx)};
    throw e;
  }
}
const connectDeletePerson=defineWrite({
  name:'connect_delete_person',
  read:async(a,ctx)=>{
    validate(a,['account','person','outsideApp','dryRun','confirm',
      'requestKey'],['account','person']);
    accountArg(a);
    if(!personId(a.person))reject('Exact person ID required');
    const {s}=await actor(ctx);
    return existingPerson(s,a,ctx);
  },
  summarize:(before,a,ctx)=>{
    const safe=connectPersonSafe(before,a.account,ctx.connection.mode);
    return modeName(ctx)+'. Platform account '+
      ctx.connection.stripeAccount+' (verified actor) DELETES '+
      'person '+a.person+' from connected account '+a.account+
      '. Before: verification '+safe.verificationStatus+', owner '+
      safe.relationship.owner+'. Identity values are never shown '+
      'in previews, results or audit records.';
  },
  apply:async(a,ctx,{idempotencyKey})=>{
    const {s}=await actor(ctx);
    const gone=await s.accounts.deletePerson(a.account,a.person,
      {idempotencyKey});
    if(gone?.id!==undefined&&gone.id!==a.person)
      reject('Provider deleted a different person');
  },
  readAfter:async(a,ctx)=>{
    const {s}=await actor(ctx);
    return readBackDeleted(s,a,ctx,'person');
  },
  verify:(_before,after,a)=>after?.deleted===true&&after?.id===a.person
});

// --- External accounts ---------------------------------------------------
// Tokenized attachment only: raw bank-account or card numbers are
// never accepted as arguments (the repo-wide hosted/tokenized rule);
// Stripe.js or a hosted surface mints the token.
export function makeConnectCreateExternal(){
  let createdId=null;
  const op=defineWrite({
    name:'connect_create_external_account',
    read:async(a,ctx)=>{
      validate(a,['account','externalAccountToken','defaultForCurrency',
        'outsideApp','dryRun','confirm','requestKey'],
        ['account','externalAccountToken']);
      accountArg(a);
      if(!/^tok_[A-Za-z0-9]{2,100}$/.test(a.externalAccountToken??''))
        reject('A tokenized external account (tok_...) is required; '+
          'raw bank or card details are never accepted');
      if(a.defaultForCurrency!==undefined&&
        typeof a.defaultForCurrency!=='boolean')
        reject('defaultForCurrency must be boolean');
      const {s}=await actor(ctx);
      return connectedAccount(s,a,ctx);
    },
    summarize:(before,a,ctx)=>{
      const safe=connectAccountSafe(before,ctx.connection.mode);
      return modeName(ctx)+'. Platform account '+
        ctx.connection.stripeAccount+' (verified actor) attaches a '+
        'tokenized external account to connected account '+a.account+
        ' ('+safe.type+'). Exact fields set: external_account (token), '+
        'default_for_currency '+(a.defaultForCurrency===true)+
        '. The token value is never shown or recorded.';
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const {s}=await actor(ctx);
      const created=await s.accounts.createExternalAccount(a.account,{
        external_account:a.externalAccountToken,
        ...(a.defaultForCurrency!==undefined?
          {default_for_currency:a.defaultForCurrency}:{})
      },{idempotencyKey});
      connectExternalAccountSafe(created,a.account,ctx.connection.mode);
      createdId=created.id;
    },
    readAfter:async(a,ctx)=>{
      const {s}=await actor(ctx);
      return s.accounts.retrieveExternalAccount(a.account,createdId);
    },
    verify:(_before,after,a,ctx)=>{
      if(after?.id!==createdId)return false;
      try{connectExternalAccountSafe(after,a.account,
        ctx.connection.mode);}catch{return false;}
      return a.defaultForCurrency===undefined||
        (after.default_for_currency===true)===
          (a.defaultForCurrency===true);
    },
    resultId:()=>createdId
  });
  return {...op,handler:(a,ctx)=>{createdId=null;return op.handler(a,ctx);}};
}
const connectUpdateExternal=defineWrite({
  name:'connect_update_external_account',
  read:async(a,ctx)=>{
    validate(a,['account','externalAccount','defaultForCurrency',
      'metadata','outsideApp','dryRun','confirm','requestKey'],
      ['account','externalAccount']);
    accountArg(a);
    if(!externalId(a.externalAccount))
      reject('Exact external account ID required');
    if(a.defaultForCurrency===undefined&&a.metadata===undefined)
      reject('Name at least one external-account field to change');
    if(a.defaultForCurrency!==undefined&&
      typeof a.defaultForCurrency!=='boolean')
      reject('defaultForCurrency must be boolean');
    metadataArg(a);
    const {s}=await actor(ctx);
    const v=await s.accounts.retrieveExternalAccount(a.account,
      a.externalAccount);
    if(v?.id!==a.externalAccount)
      reject('Exact connected-account external account unavailable');
    connectExternalAccountSafe(v,a.account,ctx.connection.mode);
    return v;
  },
  summarize:(before,a,ctx)=>{
    const safe=connectExternalAccountSafe(before,a.account,
      ctx.connection.mode);
    const fields=[];
    if(a.defaultForCurrency!==undefined)
      fields.push('default_for_currency');
    if(a.metadata!==undefined)fields.push('metadata');
    return modeName(ctx)+'. Platform account '+
      ctx.connection.stripeAccount+' (verified actor) updates '+
      'external account '+a.externalAccount+' (…'+safe.last4+') on '+
      'connected account '+a.account+'. Exact fields set: '+
      fields.join(', ')+'. Before: default for currency '+
      safe.defaultForCurrency+'.';
  },
  apply:async(a,ctx,{idempotencyKey})=>{
    const {s}=await actor(ctx);
    const p={};
    if(a.defaultForCurrency!==undefined)
      p.default_for_currency=a.defaultForCurrency;
    const m=metadataArg(a);if(m!==undefined)p.metadata=m;
    await s.accounts.updateExternalAccount(a.account,a.externalAccount,
      p,{idempotencyKey});
  },
  readAfter:async(a,ctx)=>{
    const {s}=await actor(ctx);
    return s.accounts.retrieveExternalAccount(a.account,
      a.externalAccount);
  },
  verify:(_before,after,a,ctx)=>{
    if(after?.id!==a.externalAccount)return false;
    try{connectExternalAccountSafe(after,a.account,
      ctx.connection.mode);}catch{return false;}
    if(a.defaultForCurrency!==undefined&&
      (after.default_for_currency===true)!==
        (a.defaultForCurrency===true))return false;
    return metadataMatches(after,metadataArg(a));
  }
});
const connectDeleteExternal=defineWrite({
  name:'connect_delete_external_account',
  read:async(a,ctx)=>{
    validate(a,['account','externalAccount','outsideApp','dryRun',
      'confirm','requestKey'],['account','externalAccount']);
    accountArg(a);
    if(!externalId(a.externalAccount))
      reject('Exact external account ID required');
    const {s}=await actor(ctx);
    const v=await s.accounts.retrieveExternalAccount(a.account,
      a.externalAccount);
    if(v?.id!==a.externalAccount)
      reject('Exact connected-account external account unavailable');
    connectExternalAccountSafe(v,a.account,ctx.connection.mode);
    return v;
  },
  summarize:(before,a,ctx)=>{
    const safe=connectExternalAccountSafe(before,a.account,
      ctx.connection.mode);
    return modeName(ctx)+'. Platform account '+
      ctx.connection.stripeAccount+' (verified actor) DELETES '+
      'external account '+a.externalAccount+' (…'+safe.last4+') '+
      'from connected account '+a.account+'.';
  },
  apply:async(a,ctx,{idempotencyKey})=>{
    const {s}=await actor(ctx);
    const gone=await s.accounts.deleteExternalAccount(a.account,
      a.externalAccount,{idempotencyKey});
    if(gone?.id!==undefined&&gone.id!==a.externalAccount)
      reject('Provider deleted a different external account');
  },
  readAfter:async(a,ctx)=>{
    const {s}=await actor(ctx);
    return readBackDeleted(s,a,ctx,'bank_account');
  },
  verify:(_before,after,a)=>
    after?.deleted===true&&after?.id===a.externalAccount
});

// --- Capability request --------------------------------------------------
const connectUpdateCapability=defineWrite({
  name:'connect_update_capability',
  read:async(a,ctx)=>{
    validate(a,['account','capability','requested','outsideApp',
      'dryRun','confirm','requestKey'],
      ['account','capability','requested']);
    accountArg(a);
    if(!capabilityId(a.capability))
      reject('Exact capability ID required');
    if(typeof a.requested!=='boolean')
      reject('requested must be boolean');
    const {s}=await actor(ctx);
    const v=await s.accounts.retrieveCapability(a.account,a.capability);
    if(v?.id!==a.capability)
      reject('Exact connected-account capability unavailable');
    connectCapabilitySafe(v,a.account,ctx.connection.mode);
    return v;
  },
  summarize:(before,a,ctx)=>{
    const safe=connectCapabilitySafe(before,a.account,
      ctx.connection.mode);
    return modeName(ctx)+'. Platform account '+
      ctx.connection.stripeAccount+' (verified actor) sets '+
      'capability '+a.capability+' on connected account '+a.account+
      ' to requested '+a.requested+'. Before: status '+safe.status+
      ', requested '+safe.requested+'.';
  },
  apply:async(a,ctx,{idempotencyKey})=>{
    const {s}=await actor(ctx);
    await s.accounts.updateCapability(a.account,a.capability,
      {requested:a.requested},{idempotencyKey});
  },
  readAfter:async(a,ctx)=>{
    const {s}=await actor(ctx);
    return s.accounts.retrieveCapability(a.account,a.capability);
  },
  verify:(_before,after,a,ctx)=>{
    if(after?.id!==a.capability)return false;
    try{connectCapabilitySafe(after,a.account,ctx.connection.mode);}
    catch{return false;}
    return after.requested===a.requested;
  }
});

// --- Minted links (the exception class) ----------------------------------
function checkUrl(v,label){
  text(v,label,1,2048);
  if(!/^https?:\/\/\S+$/.test(v))reject(label+' must be an http(s) URL');
}
function mintedValid(v,account,kind){
  if(!v||typeof v.url!=='string'||
    !/^https:\/\/connect\.stripe\.com\/\S{8,}$/.test(v.url))return false;
  if(kind==='account_link')
    return v.object==='account_link'&&v.account===account&&
      Number.isSafeInteger(v.expires_at);
  return v.object==='login_link'&&
    (v.account===undefined||v.account===account);
}
function makeLinkOp({name,kind,mint,checkArgs,summarizeChange}){
  let minted=null;
  const op=defineWrite({
    name,
    read:async(a,ctx)=>{
      checkArgs(a);
      const {s}=await actor(ctx);
      return connectedAccount(s,a,ctx);
    },
    summarize:(before,a,ctx)=>{
      const safe=connectAccountSafe(before,ctx.connection.mode);
      return modeName(ctx)+'. Platform account '+
        ctx.connection.stripeAccount+' (verified actor) mints a '+
        summarizeChange+' for connected account '+a.account+' ('+
        safe.type+'). Stripe provides no way to read back, list or '+
        'revoke a minted link: the URL is shown once, in the '+
        'confirmed result only — never in this preview, the audit '+
        'record or any log.';
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const {s}=await actor(ctx);
      const v=await mint(s,a,idempotencyKey);
      if(!mintedValid(v,a.account,kind))
        reject('Provider returned no verified minted link');
      minted={url:v.url,expiresAt:Number.isSafeInteger(v.expires_at)?
        new Date(v.expires_at*1000).toISOString():null};
    },
    // No provider read-back exists for a minted link (the recorded
    // exception disposition): the post-mint verification re-reads the
    // connected account and proves it unchanged and in-mode, and the
    // minted artifact itself was validated in apply against the
    // exact account.
    readAfter:async(a,ctx)=>{
      const {s}=await actor(ctx);
      return s.accounts.retrieve(a.account);
    },
    verify:(before,after,a,ctx)=>{
      if(!minted||after?.id!==before.id)return false;
      try{connectAccountSafe(after,ctx.connection.mode);}
      catch{return false;}
      return true;
    },
    resultId:(_b,_o,a)=>a.account
  });
  return {...op,async handler(a,ctx){
    minted=null;
    const response=await op.handler(a,ctx);
    if(!minted||response?.isError)return response;
    const result=JSON.parse(response.content[0].text);
    if(result.done!==true)return response;
    return reply({...result,link:{url:minted.url,
      ...(minted.expiresAt?{expiresAt:minted.expiresAt}:{})},
      note:'Minted link for the exact connected account above. '+
        'Shown once, in this result only: it is not in the audit '+
        'record, the preview or any log, and Stripe offers no way '+
        'to read it back — mint a new link instead.'});
  }};
}
const connectCreateAccountLink=()=>makeLinkOp({
  name:'connect_create_account_link',kind:'account_link',
  summarizeChange:'one-time account link',
  checkArgs:a=>{
    validate(a,['account','type','refreshUrl','returnUrl','outsideApp',
      'dryRun','confirm','requestKey'],
      ['account','type','refreshUrl','returnUrl']);
    accountArg(a);
    if(!['account_onboarding','account_update'].includes(a.type))
      reject('Link type must be account_onboarding or account_update');
    checkUrl(a.refreshUrl,'Refresh URL');
    checkUrl(a.returnUrl,'Return URL');
  },
  mint:(s,a,key)=>s.accountLinks.create({account:a.account,
    refresh_url:a.refreshUrl,return_url:a.returnUrl,type:a.type},
    {idempotencyKey:key})
});
const connectCreateLoginLink=()=>makeLinkOp({
  name:'connect_create_login_link',kind:'login_link',
  summarizeChange:'one-time login link',
  checkArgs:a=>{
    validate(a,['account','outsideApp','dryRun','confirm','requestKey'],
      ['account']);
    accountArg(a);
  },
  mint:(s,a,key)=>s.accounts.createLoginLink(a.account,
    {idempotencyKey:key})
});

// --- Registration ----------------------------------------------------------
const createAccount=makeConnectCreateAccount();
const createPerson=makeConnectCreatePerson();
const createExternal=makeConnectCreateExternal();
const accountLink=connectCreateAccountLink();
const loginLink=connectCreateLoginLink();
const accountArgSchema={type:'string',
  pattern:'^acct_[A-Za-z0-9]{2,100}$'};
const flags={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
const outside={outsideApp:{type:'boolean'}};
const metadataSchema={type:'object',
  additionalProperties:{type:'string',maxLength:500},maxProperties:50};
const personFieldProps={
  firstName:{type:'string',minLength:1,maxLength:100},
  lastName:{type:'string',minLength:1,maxLength:100},
  email:{type:'string',minLength:3,maxLength:200},
  phone:{type:'string',minLength:1,maxLength:32},
  dobDay:{type:'integer',minimum:1,maximum:31},
  dobMonth:{type:'integer',minimum:1,maximum:12},
  dobYear:{type:'integer',minimum:1900,maximum:2025},
  owner:{type:'boolean'},director:{type:'boolean'},
  representative:{type:'boolean'},executive:{type:'boolean'},
  percentOwnership:{type:'number',minimum:0,maximum:100}};
export const tools=[
  {...createAccount.tool,area:'connect',profiles:fullProfiles,
    description:'Create a connected account under the verified platform account; preview, idempotent apply, read-back.',
    inputSchema:{type:'object',properties:{
      type:{type:'string',enum:['express','custom','standard']},
      country:{type:'string',pattern:'^[A-Z]{2}$'},
      businessType:{type:'string',enum:['company','individual',
        'non_profit','government_entity']},
      businessName:{type:'string',minLength:1,maxLength:200},
      defaultCurrency:{type:'string',pattern:'^[a-z]{3}$'},
      metadata:metadataSchema,...flags},
      required:['type'],additionalProperties:false}},
  {...connectUpdateAccount.tool,area:'connect',profiles:fullProfiles,
    description:'Update one exact connected account (business profile, type, metadata); preview and read-back verified.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      businessName:{type:'string',minLength:1,maxLength:200},
      businessUrl:{type:'string',minLength:1,maxLength:2048},
      businessType:{type:'string',enum:['company','individual',
        'non_profit','government_entity']},
      metadata:metadataSchema,...outside,...flags},
      required:['account'],additionalProperties:false}},
  {...createPerson.tool,area:'connect',profiles:fullProfiles,
    description:'Create a person on one exact connected account; identity values never appear in previews, results or audit.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,...personFieldProps,...outside,...flags},
      required:['account'],additionalProperties:false}},
  {...connectUpdatePerson.tool,area:'connect',profiles:fullProfiles,
    description:'Update one exact person on a connected account; identity values never appear in previews, results or audit.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      person:{type:'string',pattern:'^person_[A-Za-z0-9]{2,100}$'},
      ...personFieldProps,...outside,...flags},
      required:['account','person'],additionalProperties:false}},
  {...connectDeletePerson.tool,area:'connect',profiles:fullProfiles,
    description:'Delete one exact person from a connected account; preview, confirmation and read-back verified.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      person:{type:'string',pattern:'^person_[A-Za-z0-9]{2,100}$'},
      ...outside,...flags},
      required:['account','person'],additionalProperties:false}},
  {...createExternal.tool,area:'connect',profiles:fullProfiles,
    description:'Attach a tokenized bank account or card to one exact connected account; raw bank or card details never accepted.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      externalAccountToken:{type:'string',
        pattern:'^tok_[A-Za-z0-9]{2,100}$'},
      defaultForCurrency:{type:'boolean'},...outside,...flags},
      required:['account','externalAccountToken'],
      additionalProperties:false}},
  {...connectUpdateExternal.tool,area:'connect',profiles:fullProfiles,
    description:'Update one exact external account on a connected account (default-for-currency, metadata); read-back verified.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      externalAccount:{type:'string',
        pattern:'^(ba|card)_[A-Za-z0-9]{2,100}$'},
      defaultForCurrency:{type:'boolean'},metadata:metadataSchema,
      ...outside,...flags},
      required:['account','externalAccount'],
      additionalProperties:false}},
  {...connectDeleteExternal.tool,area:'connect',profiles:fullProfiles,
    description:'Remove one exact external account from a connected account; preview, confirmation and read-back verified.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      externalAccount:{type:'string',
        pattern:'^(ba|card)_[A-Za-z0-9]{2,100}$'},
      ...outside,...flags},
      required:['account','externalAccount'],
      additionalProperties:false}},
  {...connectUpdateCapability.tool,area:'connect',profiles:fullProfiles,
    description:'Request or unrequest one capability on one exact connected account; preview and read-back verified.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      capability:{type:'string',
        pattern:'^[a-z][a-z0-9_]{1,80}$'},
      requested:{type:'boolean'},...outside,...flags},
      required:['account','capability','requested'],
      additionalProperties:false}},
  {...accountLink.tool,area:'connect',profiles:fullProfiles,
    description:'Mint a one-time account onboarding or update link for one exact connected account; URL shown once, in the result only.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,
      type:{type:'string',
        enum:['account_onboarding','account_update']},
      refreshUrl:{type:'string',minLength:1,maxLength:2048},
      returnUrl:{type:'string',minLength:1,maxLength:2048},
      ...outside,...flags},
      required:['account','type','refreshUrl','returnUrl'],
      additionalProperties:false}},
  {...loginLink.tool,area:'connect',profiles:fullProfiles,
    description:'Mint a one-time Express login link for one exact connected account; URL shown once, in the result only.',
    inputSchema:{type:'object',properties:{
      account:accountArgSchema,...outside,...flags},
      required:['account'],additionalProperties:false}}
];
export const handlers={
  connect_create_account:(a,ctx)=>makeConnectCreateAccount().handler(a,ctx),
  connect_update_account:connectUpdateAccount.handler,
  connect_create_person:(a,ctx)=>makeConnectCreatePerson().handler(a,ctx),
  connect_update_person:connectUpdatePerson.handler,
  connect_delete_person:connectDeletePerson.handler,
  connect_create_external_account:(a,ctx)=>
    makeConnectCreateExternal().handler(a,ctx),
  connect_update_external_account:connectUpdateExternal.handler,
  connect_delete_external_account:connectDeleteExternal.handler,
  connect_update_capability:connectUpdateCapability.handler,
  connect_create_account_link:(a,ctx)=>
    connectCreateAccountLink().handler(a,ctx),
  connect_create_login_link:(a,ctx)=>
    connectCreateLoginLink().handler(a,ctx)
};
