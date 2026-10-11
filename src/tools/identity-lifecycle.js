// G-3e: two independent TEST-only, irreversible Identity lifecycle operations.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields} from './billing-shared.js';
import {identitySafe} from './identity-sessions.js';

const props={sessionId:{type:'string',pattern:'^vs_[A-Za-z0-9]{2,100}$'}};
const control={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
const invalid=message=>{throw new TypeError(message);};
async function before(a,ctx,operation){
  validateFields(a,props,['sessionId']);
  const record=await (await client(ctx)).identity.verificationSessions.retrieve(a.sessionId);
  const safe=identitySafe(record);
  if(safe.id!==a.sessionId||safe.redactionStatus!==null)
    invalid('An exact unredacted TEST Identity session is required');
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
    summarize:b=>'TEST ONLY. Irreversibly cancel Identity session '+b.id+
      ' and prevent further verification submissions. This does not erase its records.',
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).identity.verificationSessions.cancel(
        a.sessionId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).identity.verificationSessions.retrieve(a.sessionId),
    verify:(b,v)=>{
      const after=identitySafe(v);
      return after.id===b.id&&after.type===b.type&&v.created===b.created&&
        after.status==='canceled'&&after.redactionStatus===null;
    }
  });
}
export function makeIdentityRedact(){
  return defineWrite({
    name:'identity_redact_session',
    read:(a,ctx)=>before(a,ctx,'redact'),
    summarize:b=>'TEST ONLY. Irreversibly request redaction of Identity session '+b.id+
      '. Stripe may take up to four days; processing is NOT completed erasure.'+
      ' Associated reports, events and records are also affected.',
    apply:async(a,ctx,{idempotencyKey})=>{
      await (await client(ctx)).identity.verificationSessions.redact(
        a.sessionId,{}, {idempotencyKey});
    },
    readAfter:async(a,ctx)=>(await client(ctx)).identity.verificationSessions.retrieve(a.sessionId),
    verify:(b,v)=>{
      const after=identitySafe(v);
      return after.id===b.id&&after.type===b.type&&v.created===b.created&&
        ['processing','redacted'].includes(after.redactionStatus);
    }
  });
}
const cancel=makeIdentityCancel(),redact=makeIdentityRedact();
export const tools=[
  {...cancel.tool,area:'identity',profiles:fullProfiles,safety:'C',
    annotations:{destructiveHint:true},
    description:'Irreversibly cancel a TEST Identity session awaiting input, with confirmation.',
    inputSchema:{type:'object',properties:{...props,...control},
      required:['sessionId'],additionalProperties:false}},
  {...redact.tool,area:'identity',profiles:fullProfiles,safety:'C',
    annotations:{destructiveHint:true},
    description:'Request irreversible TEST Identity data redaction; verify pending or finished state.',
    inputSchema:{type:'object',properties:{...props,...control},
      required:['sessionId'],additionalProperties:false}}
];
export const handlers={
  identity_cancel_session:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Identity cancellation requires TEST mode'):cancel.handler(a,ctx),
  identity_redact_session:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Identity redaction requires TEST mode'):redact.handler(a,ctx)
};
