import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeScheduleWrite,tools,handlers} from '../../src/tools/money-schedule-write.js';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,readBackMatches=true,limitCents=10000}={}){
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const provider={writes:[],afterCalls:0};
  let own={id:'acct_safefixture',object:'account',livemode:false,
    metadata:appOwned?{agreementId:'ag_TEST'}:{},
    settings:{payouts:{schedule:{interval:'manual'}}}};
  const s={accounts:{
    async retrieve(){if(provider.writes.length)provider.afterCalls++;return own;},
    async update(_id,params,opts){
      provider.writes.push({idempotencyKey:opts.idempotencyKey,payload:params});
      if(readBackMatches)own={...own,settings:{payouts:{
        schedule:params.settings.payouts.schedule}}};
      return own;
    }
  }};
  const ctx={db,connection:{mode:'test',stripeAccount:own.id,profile:'full'},
    connectionId:'schedule-test',services:{stripeForConnection:async()=>s}};
  return {ctx,db,provider,s,deny:()=>{s.accounts.update=async()=>{
    throw Object.assign(new Error('restricted'),{statusCode:403});};}};
}
describe('G-1e schedule update actual write safety',()=>{
  runWriteContract({withMoney:false,strictArgs:true,
    args:{interval:'daily'},tool:makeScheduleWrite,fixtures:fixture});
});
it('is unique, guarded and full profile only',()=>{
  expect(tools).toHaveLength(1);
  expect(tools[0]).toMatchObject({name:'money_set_payout_schedule',
    writes:true,profiles:['full'],writeContract:'defineWrite-v1'});
  expect(registry.tools.filter(t=>t.name===tools[0].name)).toHaveLength(1);
});
it('cannot infer an API success when own account rejects mutation',async()=>{
  const f=fixture();f.deny();
  const res=parse(await handlers.money_set_payout_schedule({
    interval:'daily',confirm:true},f.ctx));
  expect(res.done).toBe(false);
  expect(res.verified).toBe(false);
  expect(res.manualSettingsUrl).toContain('/test/settings/payouts');
  expect(res.verifyWith).toBe('money_get_payout_schedule');
});
it('rejects missing/mismatched anchors and LIVE without touching Stripe',async()=>{
  const f=fixture();
  await expect(handlers.money_set_payout_schedule({interval:'weekly',confirm:true},f.ctx))
    .rejects.toThrow(/anchor/);
  await expect(handlers.money_set_payout_schedule({
    interval:'daily',monthlyAnchor:12,confirm:true},f.ctx)).rejects.toThrow();
  const live={...f.ctx,connection:{...f.ctx.connection,mode:'live'}};
  expect((await handlers.money_set_payout_schedule({interval:'daily'},live)).isError)
    .toBe(true);
  expect(f.provider.writes).toHaveLength(0);
});
