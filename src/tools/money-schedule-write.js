// G-1e: TEST-only payout schedule update with truthful dashboard fallback.
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,validateFields} from './billing-shared.js';
const dashboardUrl='https://dashboard.stripe.com/test/settings/payouts';
const intervals=['manual','daily','weekly','monthly'];
const weekdays=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const props={interval:{type:'string',enum:intervals},
  weeklyAnchor:{type:'string',enum:weekdays},
  monthlyAnchor:{type:'integer',minimum:1,maximum:31},
  outsideApp:{type:'boolean'}};
function options(a){
  validateFields(a,props,['interval']);
  if((a.interval==='weekly')!==Boolean(a.weeklyAnchor)||
    (a.interval==='monthly')!==(a.monthlyAnchor!==undefined))
    throw new TypeError('A matching weekly or monthly anchor is mandatory');
  return {interval:a.interval,
    ...(a.weeklyAnchor?{weekly_anchor:a.weeklyAnchor}:{}),
    ...(a.monthlyAnchor?{monthly_anchor:a.monthlyAnchor}:{})};
}
async function ownAccount(ctx){
  const s=await client(ctx),v=await s.accounts.retrieve();
  if(v?.object!=='account'||v.id!==ctx.connection.stripeAccount||
    v.livemode!==false)
    throw new TypeError('Selected own TEST account identity could not be verified');
  return {s,v};
}
function make(){
  const op=defineWrite({
    name:'money_set_payout_schedule',
    read:async(a,ctx)=>{
      options(a);
      return (await ownAccount(ctx)).v;
    },
    summarize:(before,a)=>'TEST MODE. Request payout schedule '+
      JSON.stringify(options(a))+' on exact account '+before.id+
      '. Own-account Stripe API may refuse this; no update is confirmed until independent read-back.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const {s,v}=await ownAccount(ctx);
      await s.accounts.update(v.id,{settings:{payouts:{schedule:options(a)}}},
        {idempotencyKey});
    },
    readAfter:async(_a,ctx)=>(await ownAccount(ctx)).v,
    verify:(before,after,a)=>{
      const value=options(a),schedule=after?.settings?.payouts?.schedule;
      return after?.id===before.id&&after.livemode===false&&
        schedule?.interval===value.interval&&
        (value.weekly_anchor===undefined||
          schedule.weekly_anchor===value.weekly_anchor)&&
        (value.monthly_anchor===undefined||
          schedule.monthly_anchor===value.monthly_anchor);
    }
  });
  return {...op,async handler(a,ctx){
    const output=await op.handler(a,ctx);
    const obj=JSON.parse(output.content[0].text);
    if(obj.done===true)return output;
    return {...output,content:[{type:'text',text:JSON.stringify({
      ...obj,manualSettingsUrl:dashboardUrl,
      manualSteps:['Open Stripe Dashboard TEST mode > Settings > Payouts.',
        'Choose the payout interval and any weekly/monthly anchor.',
        'Save in Stripe, then call money_get_payout_schedule to verify.'],
      verified:false,verifyWith:'money_get_payout_schedule',
      note:'A refused or uncertain API result is NOT proof that the setting was changed.'
    })}]};
  }};
}
const op=make();
export const tools=[{...op.tool,area:'money',profiles:fullProfiles,
  description:'Request TEST payout schedule; if own-account API is unsupported, return guided steps without claiming success.',
  inputSchema:{type:'object',properties:{...props,
    dryRun:{type:'boolean'},confirm:{type:'boolean'},
    requestKey:{type:'string',minLength:1,maxLength:128}},
    required:['interval'],additionalProperties:false}}];
export const handlers={money_set_payout_schedule:(a,ctx)=>
  ctx?.connection?.mode!=='test'?
    gone('Payout settings changes require TEST mode'):make().handler(a,ctx)};
export const makeScheduleWrite=make;
