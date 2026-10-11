// G-3d: Identity sessions without exposing verification documents, PII or client_secret.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,guarded,fail,paging,pageResult,local,validateFields} from './billing-shared.js';
const invalid=m=>{throw new TypeError(m);};
const exact=v=>typeof v==='string'&&/^vs_[A-Za-z0-9]{2,100}$/.test(v);
const states=['requires_input','processing','verified','canceled'];
const types=['document','id_number'];
export function identitySafe(v){
  if(v?.object!=='identity.verification_session'||!exact(v.id)||
    v.livemode!==false||!Number.isSafeInteger(v.created)||v.created<946684800||
    !states.includes(v.status)||!types.includes(v.type))
    invalid('Exact TEST Identity verification session unavailable');
  const redaction=v.redaction?.status??null;
  if(redaction!==null&&!['processing','redacted'].includes(redaction))
    invalid('Identity redaction state invalid');
  // Never project client_secret, person data, document links, report IDs or full metadata.
  return {id:v.id,type:v.type,status:v.status,createdAt:local(v.created),
    redactionStatus:redaction,actionRequired:v.status==='requires_input',
    note:'Private verification evidence and access secrets are not displayed.'};
}
function hostedUrl(value){
  if(typeof value!=='string'||value.length<20||value.length>2048)
    invalid('Verified Stripe hosted Identity URL unavailable');
  let url;try{url=new URL(value);}catch{invalid('Invalid Stripe hosted Identity URL');}
  if(url.protocol!=='https:'||url.hostname!=='verify.stripe.com'||
    url.username||url.password||url.port||!url.pathname.startsWith('/start/')||
    url.hash)invalid('Unexpected Stripe hosted Identity URL destination');
  return value;
}
const sess={type:'string',pattern:'^vs_[A-Za-z0-9]{2,100}$'};
const t={type:'string',enum:types};
const props={type:t};
const common={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
function validate(a,allowed,needed=[]){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(x=>!allowed.includes(x))||
    needed.some(x=>a[x]===undefined))invalid('Exact Identity read arguments required');
}
export const tools=[
  {name:'identity_list_sessions',description:'List safe TEST Identity verification statuses without private documents.',
    area:'identity',writes:false,profiles:fullProfiles,annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{
      limit:{type:'integer',minimum:1,maximum:100},
      starting_after:sess},additionalProperties:false}},
  {name:'identity_get_session',description:'Get a TEST Identity verification state without access secrets or personal data.',
    area:'identity',writes:false,profiles:fullProfiles,annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{sessionId:sess},
      required:['sessionId'],additionalProperties:false}},
  {...makeIdentityCreate().tool,area:'identity',profiles:fullProfiles,
    description:'Create an owner-guarded TEST Identity session and return only verified hosted URL.',
    inputSchema:{type:'object',properties:{...props,...common},
      required:['type'],additionalProperties:false}}
];
export const handlers={
  identity_list_sessions:(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('TEST Identity mode required'):guarded(ctx,async s=>{
      validate(a,['limit','starting_after']);
      if(a.starting_after!==undefined&&!exact(a.starting_after))
        invalid('Exact Identity cursor required');
      const v=await s.identity.verificationSessions.list(paging(a));
      return pageResult(v,identitySafe);
    }),
  identity_get_session:(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('TEST Identity mode required'):guarded(ctx,async s=>{
      validate(a,['sessionId'],['sessionId']);
      if(!exact(a.sessionId))invalid('Exact Identity ID required');
      const v=await s.identity.verificationSessions.retrieve(a.sessionId);
      if(v?.id!==a.sessionId)invalid('Identity session ID mismatch');
      return identitySafe(v);
    }),
  identity_create_session:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Identity creation requires TEST mode'):makeIdentityCreate().handler(a,ctx)
};
export function makeIdentityCreate(){
  let createdId=null,verifiedUrl=null;
  const op=defineWrite({
    name:'identity_create_session',
    read:async(a,ctx)=>{
      validateFields(a,props,['type']);
      if(!types.includes(a.type))invalid('Supported Identity verification type required');
      const result=await (await client(ctx)).identity.verificationSessions.list({limit:1});
      if(!Array.isArray(result?.data)||typeof result.has_more!=='boolean')
        invalid('Selected TEST Identity provider could not be verified');
      return {id:'identity_new_session',metadata:{},customer:null};
    },
    summarize:(_b,a)=>'TEST ONLY. Create a new hosted Stripe Identity '+a.type+
      ' verification session. Customer document data stays on Stripe.'+
      ' The hosted URL is only shown after independent read-back.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const v=await (await client(ctx)).identity.verificationSessions.create({
        type:a.type},{idempotencyKey});
      if(!exact(v?.id)||v.object!=='identity.verification_session'||v.livemode!==false)
        invalid('Stripe Identity creation identity unavailable');
      createdId=v.id; // do not keep, echo or log client_secret
    },
    readAfter:async(_a,ctx)=>createdId?
      (await client(ctx)).identity.verificationSessions.retrieve(createdId):null,
    verify:(_b,v,args)=>{
      const identity=identitySafe(v);
      if(identity.id!==createdId||identity.type!==args.type||
        identity.status!=='requires_input')return false;
      verifiedUrl=hostedUrl(v.url);
      return true;
    }
  });
  return {...op,async handler(args,ctx){
    const result=await op.handler(args,ctx);
    if(result?.isError||!verifiedUrl)return result;
    const value=JSON.parse(result.content[0].text);
    if(value.confirmed!==true)return result;
    return {...result,content:[{type:'text',text:JSON.stringify({
      ...value,sessionId:createdId,verificationUrl:verifiedUrl})}]};
  }};
}
