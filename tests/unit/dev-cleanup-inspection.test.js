import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {tools,handlers} from '../../src/tools/dev-cleanup-inspection.js';
import {registry} from '../../src/tools/index.js';
const account='acct_CLEANVERIFY123';
const parse=r=>JSON.parse(r.content[0].text);
function fixture(){
  const plan=planTrigger({type:'customer.created',requestKey:'inspection'},account);
  const run={id:plan.runId,stripe_account:account,request_key:'inspection',size:1,
    status:'completed',scenario:plan.scenario,plan_digest:plan.planDigest};
  const rows=[{step_name:'customer_1',object_type:'customer',object_id:'cus_VERIFY123',cleaned:true},
    {step_name:'event_1',object_type:'event',object_id:'evt_VERIFY123',cleaned:false}];
  return {plan,run,rows};
}

describe('provider-verified TEST cleanup inspection',()=>{
  it('registers a read-only selected-account verifier',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_verify_cleanup_run'))
      .toHaveLength(1);
  });
});
