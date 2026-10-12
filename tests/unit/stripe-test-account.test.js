import {describe,it,expect,vi} from 'vitest';
import {readVerifiedTestAccount} from '../../src/stripe/test-account.js';

const id='acct_PROVIDERMODETEST';
const account={object:'account',id,charges_enabled:true,payouts_enabled:false,
  details_submitted:true};
function fixture(record=account,balance={object:'balance',livemode:false}){
  const sdk={accounts:{retrieve:vi.fn(async()=>record)},
    balance:{retrieve:vi.fn(async()=>balance)}};
  return sdk;
}
describe('independent TEST identity for documented Stripe Account schema',()=>{
  it('verifies missing Account livemode via same-client Balance livemode:false',async()=>{
    const sdk=fixture();
    const proven=await readVerifiedTestAccount(sdk,id);
    expect(proven).toMatchObject({...account,livemode:false});
    expect(sdk.accounts.retrieve).toHaveBeenCalledTimes(1);
    expect(sdk.balance.retrieve).toHaveBeenCalledTimes(1);
  });
  it('accepts an explicit safe Account mode without an extra privilege',async()=>{
    const sdk=fixture({...account,livemode:false});
    expect(await readVerifiedTestAccount(sdk,id)).toMatchObject({id,livemode:false});
    expect(sdk.balance.retrieve).not.toHaveBeenCalled();
  });
  it('fails closed for LIVE, malformed, missing or denied balance evidence',async()=>{
    for(const v of [true,null,'false']){
      const sdk=fixture(account,{object:'balance',livemode:v});
      await expect(readVerifiedTestAccount(sdk,id)).rejects.toThrow();
    }
    const denied=fixture();
    denied.balance.retrieve.mockRejectedValue({statusCode:403,code:'permission_denied'});
    await expect(readVerifiedTestAccount(denied,id)).rejects.toThrow();
    for(const record of [{...account,id:'acct_FOREIGN'}, {...account,object:'customer'},
      {...account,livemode:true},{...account,livemode:null},
      {...account,livemode:'false'}]){
      const sdk=fixture(record);
      await expect(readVerifiedTestAccount(sdk,id)).rejects.toThrow();
      expect(sdk.balance.retrieve).not.toHaveBeenCalled();
    }
  });
  it('does not accept Balance without the correct object and definite TEST mode',async()=>{
    for(const balance of [{livemode:false},{object:'balance'},
      {object:'balance',livemode:'false'},{object:'balance',livemode:true}]){
      await expect(readVerifiedTestAccount(fixture(account,balance),id)).rejects.toThrow();
    }
  });
});
