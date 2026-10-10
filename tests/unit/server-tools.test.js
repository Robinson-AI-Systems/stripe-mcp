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
    expect(info.moneyUsedTodayCents).toBeNull();
    expect(JSON.stringify(info)).not.toContain('cipher-only');
    const list=await read(db,'stripe_list_accounts');
    expect(JSON.parse(list.content[0].text).accounts).toEqual([{
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
});
