// G-3e: two independent, irreversible Identity lifecycle operations in
// the connection's own mode (owner-obedience V2, Identity family).
import {defineWrite} from './write.js';
import {client,fullProfiles,validateFields} from './billing-shared.js';
import {identitySafe} from './identity-sessions.js';

const props={sessionId:{type:'string',pattern:'^vs_[A-Za-z0-9]{2,100}$'}};
const control={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128},
  previewFingerprint:{type:'string',maxLength:64}};
const invalid=message=>{throw new TypeError(message);};
const modeOf=ctx=>ctx?.connection?.mode;
const modeLabel=ctx=>modeOf(ctx)==='live'?'LIVE':'TEST';
// previewFingerprint is a core control field (owner-obedience V2
// shared machinery); the family validator must not reject it.
const stripControl=a=>{if(!a||typeof a!=='object'||Array.isArray(a))return a;
  const {previewFingerprint:_f,...rest}=a;return rest;};
async function before(a,ctx,operation){
  validateFields(stripControl(a),props,['sessionId']);
  const record=await (await client(ctx)).identity.verificationSessions.retrieve(a.sessionId);
  const safe=identitySafe(record,modeOf(ctx));
  if(safe.id!==a.sessionId||safe.redactionStatus!==null)
    invalid('An exact unredacted '+modeLabel(ctx)+' Identity session is required');
  if(operation==='cancel'&&safe.status!=='requires_input')
    invalid('Only a session awaiting input can be canceled');
  if(operation==='redact'&&!['requires_input','verified'].includes(safe.status))
    invalid('Only an input-pending or verified session can be redacted');
  // Return raw provider metadata only to the local guard, never to tool results or audit.
  return record;
}
export function makeIdentityCancel(){
  return defineWrite({
    name:'identity_cancel_session',
    read:(a,ctx)=>before(a,ctx,'cancel'),
    summarize:(b,_a,ctx)=>modeOf(ctx)==='live'?
      'LIVE MODE. Irreversibly cancel Identity session '+b.id+
      ' and prevent further verification submissions: the person can no'+
      ' longer complete this verification. This does not erase its records.':
      'TEST ONLY. Irreversibly cancel Identity session '+b.id+
      ' and prevent further verification submissions. This does not erase its records.',
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).identity.verificationSessions.cancel(
        a.sessionId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).identity.verificationSessions.retrieve(a.sessionId),
    verify:(b,v,_a,ctx)=>{
      const after=identitySafe(v,modeOf(ctx));
      return after.id===b.id&&after.type===b.type&&v.created===b.created&&
        after.status==='canceled'&&after.redactionStatus===null;
    }
  });
}
export function makeIdentityRedact(){
  return defineWrite({
    name:'identity_redact_session',
    read:(a,ctx)=>before(a,ctx,'redact'),
    summarize:(b,_a,ctx)=>modeLabel(ctx)+' MODE. Irreversibly request redaction of Identity session '+b.id+
      '. Stripe may take up to four days; processing is NOT completed erasure.'+
      ' Redaction destroys the collected identity documents and verified'+
      ' details Stripe holds for this session. Associated reports, events'+
      ' and records are also affected.'+
      (modeOf(ctx)==='live'?' Whether the business must keep verification'+
      ' records for its own legal or compliance reasons is the owner\'s to'+
      ' judge; this preview discloses the destruction and keeps no copy.':''),
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).identity.verificationSessions.redact(
        a.sessionId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).identity.verificationSessions.retrieve(a.sessionId),
    verify:(b,v,_a,ctx)=>{
      const after=identitySafe(v,modeOf(ctx));
      return after.id===b.id&&after.type===b.type&&v.created===b.created&&
        ['processing','redacted'].includes(after.redactionStatus);
    }
  });
}
const cancel=makeIdentityCancel(),redact=makeIdentityRedact();
export const tools=[
  {...cancel.tool,area:'identity',profiles:fullProfiles,safety:'C',
    annotations:{destructiveHint:true},
    description:'Irreversibly cancel an Identity session awaiting input, with confirmation.',
    inputSchema:{type:'object',properties:{...props,...control},
      required:['sessionId'],additionalProperties:false}},
  {...redact.tool,area:'identity',profiles:fullProfiles,safety:'C',
    annotations:{destructiveHint:true},
    description:'Request irreversible Identity data redaction; verify pending or finished state.',
    inputSchema:{type:'object',properties:{...props,...control},
      required:['sessionId'],additionalProperties:false}}
];
export const handlers={
  identity_cancel_session:(a,ctx)=>cancel.handler(a,ctx),
  identity_redact_session:(a,ctx)=>redact.handler(a,ctx)
};
