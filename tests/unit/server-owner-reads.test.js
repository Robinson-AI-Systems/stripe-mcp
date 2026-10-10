import {describe,expect,it} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {handlers} from '../../src/tools/server.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {DASHBOARD_SETTINGS,whereIsSetting} from '../../src/data/dashboard-map.js';

const parse=r=>JSON.parse(r.content[0].text);
describe('B-8a server-side read-only operations, fake database',()=>{
  it('shows actual shared-account dollar usage without one budget per AI connection',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_owner',label:'Fixture',money_limit_cents:50000}]});
    await db.requestMoneyApproval({account:'acct_owner',idempotencyKey:'request-one',
      tool:'test_payout',target:'ch_FAKE1234',description:'Fake payout',amountCents:12500,currency:'usd'});
    await db.approveMoneyRequest({account:'acct_owner',idempotencyKey:'request-one'});
    await db.reserveMoneyOut({account:'acct_owner',connection:'agent-A',
      idempotencyKey:'request-one',amountCents:12500,currency:'usd'});
    const connection={stripeAccount:'acct_owner',clientId:'agent-B',
      profile:'read_only',mode:'test',listing:'compact'};
    const info=parse(await handlers.stripe_whoami({}, {db,connection}));
    expect(info.moneyUsedTodayCents).toBe(12500);
    expect(info.moneyLimitCents).toBe(50000);
    const displayed=parse(await dispatchReadOnlyTool({registry,name:'stripe_whoami',
      connection,db,args:{}}));
    expect(displayed.moneyLimitCents_display).toBe('$500.00');
    expect(displayed.moneyUsedTodayCents_display).toBe('$125.00');
  });
  it('scopes audit summaries to the authenticated account and hides snapshots',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_A',label:'A'},{id:'acct_B',label:'B'}]});
    await db.recordChange({account:'acct_A',tool:'stripe_A_only',summary:'Fake A',mode:'test'});
    await db.recordChange({account:'acct_B',tool:'stripe_B_only',summary:'Fake B',mode:'test'});
    await db.recordChange({account:'acct_A',tool:'stripe_live_a',summary:'Fake LIVE',mode:'live'});
    const connection={stripeAccount:'acct_A',mode:'test',profile:'read_only'};
    const result=parse(await handlers.stripe_recent_changes({}, {db,connection}));
    expect(result.account).toBe('acct_A');
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].tool).toBe('stripe_A_only');
    expect(result.changes[0].at_local).toBeTruthy();
    expect(result.includesRawSnapshots).toBe(false);
    expect(JSON.stringify(result)).not.toContain('stripe_B_only');
    expect((await handlers.stripe_recent_changes({mode:'live'},{db,connection})).isError).toBe(true);
    const full=parse(await handlers.stripe_recent_changes({mode:'live'},{
      db,connection:{...connection,profile:'full'}}));
    expect(full.changes[0].tool).toBe('stripe_live_a');
  });
  it('lists only selected-account connection metadata and never token hashes',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_A',label:'A'},{id:'acct_B',label:'B'}]});
    await db.createAccessToken({accessToken:'a'.repeat(40),clientId:'agent_A',
      stripeAccount:'acct_A',mode:'test',profile:'everyday',listing:'catalog'});
    await db.createAccessToken({accessToken:'b'.repeat(40),clientId:'agent_B',
      stripeAccount:'acct_B',mode:'test',profile:'full',listing:'compact'});
    const result=parse(await handlers.stripe_list_connections({},{
      db,connection:{stripeAccount:'acct_A',mode:'test',profile:'read_only'}}));
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].client_id).toBe('agent_A');
    expect(JSON.stringify(result)).not.toContain('agent_B');
    expect(JSON.stringify(result)).not.toContain('token_hash');
    expect(JSON.stringify(result)).not.toContain('refresh_hash');
    expect(JSON.stringify(result)).not.toContain('a'.repeat(40));
  });
  it('validates account-scoped limits and missing account selections',async()=>{
    const db=createFakeDb();
    const connection={stripeAccount:'acct_A',mode:'test',profile:'full'};
    expect((await handlers.stripe_recent_changes({limit:101},{db,connection})).isError).toBe(true);
    expect((await handlers.stripe_list_connections({limit:-1},{db,connection})).isError).toBe(true);
    expect((await handlers.stripe_recent_changes({},{
      db,connection:{...connection,stripeAccount:null}})).isError).toBe(true);
  });
  it('offers owner-directed dashboard navigation without pretending to make changes',()=>{
    const result=whereIsSetting('receipt emails');
    expect(result.found).toBe(true);
    expect(result.dashboardUrl).toBe('https://dashboard.stripe.com/settings');
    expect(result.steps.length).toBeGreaterThan(2);
    for (const name of ['restricted_key_creation','phone_payments',
      'team_members','custom_payment_domain','public_branding','webhook_redelivery']) {
      expect(whereIsSetting(name).found).toBe(true);
    }
    expect(whereIsSetting('custom_payment_domain').steps[0].action)
      .toMatch(/approval/);
    expect(result.changeMade).toBe(false);
    expect(Object.keys(DASHBOARD_SETTINGS)).toContain('subscription_retries');
    const unknown=whereIsSetting('fake made-up section');
    expect(unknown.found).toBe(false);
    expect(unknown.supported).toContain('receipt_emails');
  });
});

describe('B-8a bounded owner report safety regressions',()=>{
  it('pages long audit history under the 8 KB response ceiling without hiding omitted records',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_page',label:'Page'}]});
    for(let i=0;i<44;i++) {
      await db.recordChange({account:'acct_page',tool:'test_change',
        summary:'Very long fake summary '+String(i)+' '+('X'.repeat(1400)),mode:'test'});
    }
    const connection={stripeAccount:'acct_page',mode:'test',profile:'read_only'};
    let offset=0,items=0,iterations=0,wasTruncated=false;
    do {
      const raw=await handlers.stripe_recent_changes({limit:40,offset},{db,connection});
      expect(Buffer.byteLength(JSON.stringify(raw),'utf8')).toBeLessThanOrEqual(8192);
      const page=parse(raw);
      expect(page.changes.length).toBeGreaterThan(0);
      items+=page.changes.length;
      if(page.changes.some(x=>x.summaryTruncated))wasTruncated=true;
      iterations++;
      if(!page.hasMore)break;
      expect(page.nextOffset).toBeGreaterThan(offset);
      offset=page.nextOffset;
    } while(iterations<30);
    expect(items).toBe(44);
    expect(wasTruncated).toBe(true);
    expect(iterations).toBeGreaterThan(1);
  });
  it('displays audit dates correctly through a Denver daylight-saving transition',async()=>{
    let now=Date.parse('2026-11-01T07:30:00Z');
    const db=createFakeDb({clock:()=>now,accounts:[{id:'acct_dst',label:'DST'}]});
    await db.recordChange({account:'acct_dst',tool:'before',summary:'Before fallback'});
    now=Date.parse('2026-11-01T08:30:00Z');
    await db.recordChange({account:'acct_dst',tool:'after',summary:'After fallback'});
    const page=parse(await handlers.stripe_recent_changes({},{
      db,connection:{stripeAccount:'acct_dst',mode:'test',profile:'read_only'}}));
    expect(page.changes.map(x=>x.at_local).join(' ')).toContain('MDT');
    expect(page.changes.map(x=>x.at_local).join(' ')).toContain('MST');
  });
  it('refuses oversized arbitrary read results instead of silently clipping them',async()=>{
    const registry={tools:[{name:'unsafe_oversize',writes:false,profiles:['read_only']}],
      handlers:{unsafe_oversize:async()=>({content:[
        {type:'text',text:JSON.stringify({notes:'X'.repeat(9500)})}
      ]})}};
    const result=await dispatchReadOnlyTool({registry,name:'unsafe_oversize',
      args:{},connection:{stripeAccount:'acct_1',profile:'read_only',mode:'test'},db:{}});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/8 KB/);
  });
});
