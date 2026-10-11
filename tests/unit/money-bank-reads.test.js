import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/money-bank-reads.js';
import {registry} from '../../src/tools/index.js';

const account='acct_OWNTEST';
const bank={id:'ba_TESTBANK',object:'bank_account',last4:'6789',
  currency:'usd',country:'US',bank_name:'STRIPE TEST BANK',status:'new',
  account,default_for_currency:true,account_number:'DO_NOT_EXPOSE',
  routing_number:'DO_NOT_EXPOSE',fingerprint:'DO_NOT_EXPOSE'};
const own={id:account,object:'account',settings:{payouts:{schedule:{
  interval:'weekly',delay_days:2,weekly_anchor:'monday'}}},
  external_accounts:{data:[bank]}};
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const s={accounts:{
    retrieve:vi.fn(async()=>own),
    listExternalAccounts:vi.fn(async()=>({object:'list',data:[bank],has_more:false}))
  }};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:account},
    services:{stripeForConnection:async()=>s}};
  return {s,ctx,call:(name,a={})=>handlers[name](a,ctx)};
}
describe('G-1b safe own-account TEST payout preferences',()=>{
  it('registers both reads exactly once, including read_only',()=>{
    expect(tools.map(x=>x.name)).toEqual([
      'money_list_bank_accounts','money_get_payout_schedule']);
    expect(tools.every(x=>!x.writes&&x.profiles.includes('read_only')))
      .toBe(true);
    for(const t of tools)expect(registry.tools.filter(x=>x.name===t.name))
      .toHaveLength(1);
  });
  it('masks bank routing/account details and pages bank destinations',async()=>{
    const f=fixture();
    const result=parse(await f.call('money_list_bank_accounts',{limit:4}));
    expect(result).toMatchObject({available:true,has_more:false,
      complete:true,data:[{id:bank.id,last4:'6789',bankName:'STRIPE TEST BANK'}]});
    expect(JSON.stringify(result)).not.toMatch(/DO_NOT_EXPOSE|routing_number|fingerprint/);
    expect(f.s.accounts.listExternalAccounts).toHaveBeenCalledWith(account,
      {limit:4,object:'bank_account'});
  });
  it('does not claim empty when own-account external API is denied',async()=>{
    const f=fixture();
    f.s.accounts.listExternalAccounts.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'),{statusCode:403}));
    const result=parse(await f.call('money_list_bank_accounts',{}));
    expect(result).toMatchObject({available:false,complete:false,items:[]});
    expect(result.reason).toMatch(/did_not_authorize/);
    expect(result.dashboardUrl).toContain('/settings/payouts');
  });
  it('authenticates own account and rejects foreign or malformed bank results',async()=>{
    const f=fixture();
    f.s.accounts.retrieve.mockResolvedValueOnce({...own,id:'acct_OTHER'});
    expect((await f.call('money_list_bank_accounts',{})).isError).toBe(true);
    expect(f.s.accounts.listExternalAccounts).not.toHaveBeenCalled();
    f.s.accounts.listExternalAccounts.mockResolvedValueOnce({
      data:[{...bank,account:'acct_OTHER'}],has_more:false});
    expect((await f.call('money_list_bank_accounts',{})).isError).toBe(true);
  });
  it('reads actual payout schedule, never asserts a settings write',async()=>{
    const f=fixture();
    const v=parse(await f.call('money_get_payout_schedule'));
    expect(v).toMatchObject({available:true,interval:'weekly',
      weeklyAnchor:'monday',delayDays:2,accountId:account,mode:'test'});
    expect(f.s.accounts.retrieve).toHaveBeenCalledTimes(1);
    f.s.accounts.retrieve.mockResolvedValueOnce({
      id:account,object:'account',settings:{}});
    expect(parse(await f.call('money_get_payout_schedule')))
      .toMatchObject({available:false,reason:'own_account_schedule_not_readable'});
  });
  it('rejects LIVE before any API call and unknown parameters or bank cursor',async()=>{
    const f=fixture();
    const live={...f.ctx,connection:{...f.ctx.connection,mode:'live'}};
    expect((await handlers.money_list_bank_accounts({},live)).isError).toBe(true);
    expect((await handlers.money_get_payout_schedule({},live)).isError).toBe(true);
    expect(f.s.accounts.retrieve).not.toHaveBeenCalled();
    expect((await f.call('money_get_payout_schedule',{oops:1})).isError)
      .toBe(true);
    expect((await f.call('money_list_bank_accounts',{starting_after:'cus_OTHER'}))
      .isError).toBe(true);
  });
});
