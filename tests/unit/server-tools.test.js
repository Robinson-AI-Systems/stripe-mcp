import { describe,expect,it } from 'vitest';
import { registry } from '../../src/tools/index.js';
import { dispatchReadOnlyTool } from '../../src/core/mcp-server.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';

const read = async (db,name,profile='full') => dispatchReadOnlyTool({
  registry,name,args:{},connection:{stripeAccount:'acct_FAKESETUP',mode:'test',profile,listing:'compact'},db
});
describe('MCP metadata-tool safety boundary',()=>{
  it('returns safe account metadata, never ciphertext or the account key',async()=>{
    const db=createFakeDb();
    await db.saveTestKey({account:'acct_FAKESETUP',label:'My Project',ciphertext:'v1.cipher-only',
      kind:'restricted',last4:'FAKE',permissions:{customers:'ok'}});
    const who=await read(db,'stripe_whoami','read_only');
    const info=JSON.parse(who.content[0].text);
    expect(info).toMatchObject({account:'acct_FAKESETUP',label:'My Project',
      profile:'read_only',keyType:'restricted',keyLast4:'FAKE'});
    expect(info.moneyUsedTodayCents).toBe(0);
    expect(info.moneyTrackingStatus).toMatch(/Shared account-wide/);
    expect(JSON.stringify(info)).not.toContain('cipher-only');
    const list=await read(db,'stripe_list_accounts');
    const accountsResult=JSON.parse(list.content[0].text);
    expect(accountsResult.hasMore).toBe(false);
    expect(accountsResult.nextOffset).toBeNull();
    expect(accountsResult.accounts).toEqual([{
      account:'acct_FAKESETUP',label:'My Project',isDefault:true,testConfigured:true,
      liveConfigured:false,liveEnabled:false
    }]);
  });
  it('blocks unknown tools, unauthorized profiles and every write even with a registered handler',async()=>{
    const db=createFakeDb();
    const denied=await read(db,'stripe_delete_everything');
    expect(denied.isError).toBe(true);
    const evil={tools:[{name:'stripe_write',writes:true,profiles:['full']}],
      handlers:{stripe_write:async()=>({content:[{type:'text',text:'should never run'}]})}};
    const call=await dispatchReadOnlyTool({registry:evil,name:'stripe_write',args:{},db,
      connection:{profile:'full'}});
    expect(call.isError).toBe(true);
    expect(JSON.stringify(call)).not.toContain('should never run');
    expect((await read(db,'stripe_whoami','not-a-profile')).isError).toBe(true);
  });
  it('bounds account listings to at most 100, with explained next page',async()=>{
    const db=createFakeDb({accounts:Array.from({length:40},(_,i)=>({
      id:'acct_BATCH'+i,label:'Test account '+i}))});
    const connection={stripeAccount:'acct_BATCH0',mode:'test',profile:'full'};
    const page=await dispatchReadOnlyTool({registry,name:'stripe_list_accounts',
      args:{limit:20,offset:0},connection,db});
    const first=JSON.parse(page.content[0].text);
    expect(first.accounts).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(first.nextOffset).toBe(20);
    expect(first.pageHint).toMatch(/next page/);
    const next=JSON.parse((await dispatchReadOnlyTool({registry,
      name:'stripe_list_accounts',args:{limit:20,offset:20},connection,db}))
      .content[0].text);
    expect(next.accounts).toHaveLength(20);
    expect(next.hasMore).toBe(false);
    expect((await dispatchReadOnlyTool({registry,name:'stripe_list_accounts',
      args:{limit:101},connection,db})).isError).toBe(true);
  });
});
