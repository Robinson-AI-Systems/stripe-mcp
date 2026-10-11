import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/dispute-reads.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='du_FAKE1234';
const dispute={object:'dispute',id,livemode:false,amount:2565,
  currency:'usd',created:1680203749,status:'needs_response',
  charge:'ch_FAKE1234',payment_intent:'pi_FAKE1234',reason:'fraudulent',
  evidence_details:{due_by:1680403749,past_due:false,
    has_evidence:true,submission_count:0},
  evidence:{billing_address:'PRIVATE CUSTOMER ADDRESS',customer_email_address:'private@example.test'},
  payment_method_details:{card:{last4:'9876'}}};
const parse=r=>JSON.parse(r.content[0].text);
function fixture() {
  const s={disputes:{list:vi.fn(async()=>({data:[dispute],has_more:false})),
    retrieve:vi.fn(async()=>dispute)}};
  const ctx={connection:{stripeAccount:'acct_FAKE1234',mode:'test',profile:'read_only'},
    services:{stripeForConnection:async()=>s}};
  return {s,ctx,call:(n,a={})=>handlers[n](a,ctx)};
}
describe('G-2a safe TEST dispute reads',()=>{
  it('registers exactly two read-only tools',()=>{
    expect(tools.map(t=>t.name)).toEqual(['dispute_list','dispute_get']);
    for(const t of tools){
      expect(t.writes).toBe(false);
      expect(t.profiles).toContain('read_only');
      expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
    }
  });
  it('projects exact dispute values and local deadlines without leaking private evidence',async()=>{
    const f=fixture(),r=parse(await f.call('dispute_list',{limit:5}));
    expect(f.s.disputes.list).toHaveBeenCalledWith({limit:5});
    expect(r.data[0]).toMatchObject({id,amountMinor:2565,currency:'usd',
      status:'needs_response',evidenceDueUnix:1680403749,hasEvidence:true,
      needsResponse:true});
    expect(r.has_more).toBe(false);
    const serialized=JSON.stringify(r);
    for(const secret of ['PRIVATE CUSTOMER ADDRESS','private@example.test','9876'])
      expect(serialized).not.toContain(secret);
    expect(parse(await f.call('dispute_get',{disputeId:id})).id).toBe(id);
  });
  it('rejects malformed, LIVE, mismatched and untrusted provider objects',async()=>{
    const f=fixture();
    expect((await f.call('dispute_get',{disputeId:'bad'})).isError).toBe(true);
    expect((await f.call('dispute_list',{limit:500})).isError).toBe(true);
    expect((await f.call('dispute_list',{unrecognized:true})).isError).toBe(true);
    expect((await handlers.dispute_get({disputeId:id},{...f.ctx,
      connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    f.s.disputes.retrieve.mockResolvedValue({...dispute,id:'du_DIFFERENT'});
    expect((await f.call('dispute_get',{disputeId:id})).isError).toBe(true);
    f.s.disputes.list.mockResolvedValue({data:[{...dispute,livemode:true}],has_more:false});
    expect((await f.call('dispute_list')).isError).toBe(true);
  });
  it('works through read-only dispatch with no write bypass',async()=>{
    const f=fixture(),r=await dispatchReadOnlyTool({registry,name:'dispute_get',
      args:{disputeId:id},connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(parse(r).id).toBe(id);
  });
});
