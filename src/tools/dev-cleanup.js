// TEST-only per-run and bounded all-runs lifecycle with explicit retained results.
import {defineWrite,gone} from './write.js';
import {client,reply,writeProfiles,allProfiles} from './billing-shared.js';
import {prepareCleanup,executeCleanup} from '../dev/cleanup.js';
const runId={type:'string',pattern:'^run_[a-f0-9]{24}$'};
export function makeDevCleanupWrite(){
  let last=null;
  const op=defineWrite({
    name:'dev_cleanup',
    read:(a,ctx)=>prepareCleanup(a,ctx),
    summarize:plan=>{
      const ids=plan.runs.map(r=>r.run.id);
      const targets=plan.runs.flatMap(x=>
        x.rows.filter(y=>!y.cleaned).map(y=>y.object_id));
      const preview='TEST MODE. Clean recorded objects for '+ids.join(', ')+
        '; exact target IDs: '+targets.join(', ')+
        '. Cancel subscriptions/payment intents where safe, void open invoices, '+
        'archive prices/products, and delete verified customers. Never auto-refund, '+
        'move money, delete a seller account or test clock, or destroy paid records.';
      if(preview.length>1024)throw new TypeError(
        'Too many IDs for complete cleanup preview; choose one smaller run');
      return preview;
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      last=await executeCleanup(a,ctx,await client(ctx),idempotencyKey);
    },
    readAfter:async()=>last,
    verify:(_before,after)=>after?.allCleaned===true
  });
  return {...op,async handler(a,ctx){
    if(ctx?.connection?.mode!=='test')return gone('Cleanup is TEST only');
    const response=await op.handler(a,ctx);
    if(last&&a?.confirm===true&&a.dryRun!==true&&
      Array.isArray(response?.content)){
      const original=JSON.parse(response.content[0].text);
      return {...response,content:[{type:'text',
        text:JSON.stringify({...original,cleanup:{
          outcomes:last.outcomes,allCleaned:last.allCleaned,
          note:last.allCleaned?'All recorded IDs independently cleaned':
            'Partial cleanup: retained and uncertain objects remain recorded.'}})}]};
    }
    return response;
  }};
}
const cleanup=makeDevCleanupWrite();
export const tools=[
  {...cleanup.tool,area:'developer',profiles:writeProfiles,
    description:'Safely clean only verified run-owned TEST objects; report retained/uncertain records, never auto-refund.',
    inputSchema:{type:'object',properties:{
      runId,scope:{type:'string',enum:['all-runs']},
      confirm:{type:'boolean'},dryRun:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}
    },additionalProperties:false}},
  {name:'dev_reset_test_data',area:'developer',writes:false,
    profiles:allProfiles,
    description:'Show Stripe Dashboard steps for owner-directed full TEST-data reset; never execute an API reset.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
export const handlers={
  dev_cleanup:(a,ctx)=>makeDevCleanupWrite().handler(a,ctx),
  dev_reset_test_data:(a,ctx)=>{
    if(ctx?.connection?.mode!=='test'||!ctx.connection.stripeAccount)
      return gone('Full TEST-data reset guidance is TEST only');
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).length!==0)
      return gone('Guided TEST reset accepts no arguments');
    return reply({mode:'test',performed:false,
      account:ctx.connection.stripeAccount,
      dashboard:'https://dashboard.stripe.com/test/dashboard',
      steps:[
        'Sign in to the owner Stripe Dashboard and select the exact TEST account.',
        'Switch to test mode; locate the test-data deletion control in Stripe settings.',
        'Inspect the scope, warnings, associated Connect accounts and dependencies.',
        'Only the authenticated account owner should approve deletion in Stripe.'
      ],note:'Stripe provides no supported API to delete all test data. This MCP does not start, authorize or confirm a full reset.'});
  }
};
