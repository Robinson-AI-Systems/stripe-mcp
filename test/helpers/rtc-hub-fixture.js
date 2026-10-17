// Original Stripe MCP RTC 1 dispatch against a disposable TEST fake-provider.
// The native defineWrite implementation performs preview, audit, read-after
// and confirmation, backed by actual isolated PostgreSQL rows; no Stripe key.
import {createHash} from 'node:crypto';
import {defineWrite} from '../../src/core/write.js';

const ok=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
const readSchema={type:'object',properties:{
  detail:{type:'string',enum:['summary','full']},
  fields:{type:'string',maxLength:600}},additionalProperties:false};
const previewSchema={type:'object',properties:{
  value:{type:'string',maxLength:120},dryRun:{type:'boolean'},
  confirm:{type:'boolean'},requestKey:{type:'string',maxLength:128}},
  additionalProperties:false};
const idempotency=(connection,name,args)=>'rmcp_'+createHash('sha256')
  .update(JSON.stringify([connection.stripeAccount,connection.mode,name,
    args.requestKey||args.value])).digest('hex').slice(0,40);

export async function createRtcHubFixture({registry,rawQuery}){
  if(!registry?.tools||!registry?.handlers||typeof rawQuery!=='function')
    throw new TypeError('Real original registry and disposable SQL fixture are mandatory');
  await rawQuery('CREATE TABLE rtc_hub_fake_provider (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  await rawQuery("INSERT INTO rtc_hub_fake_provider(id,value) VALUES(1,'initial')");
  const readValue=async()=>{
    const rows=await rawQuery('SELECT value FROM rtc_hub_fake_provider WHERE id=1');
    if(rows.length!==1)throw new Error('Isolated fake-provider fixture vanished');
    return rows[0].value;
  };
  const apply=async(args)=>{
    if(!['committed','preview'].includes(args.value))
      throw new TypeError('Only fixture TEST metadata changes are allowed');
    const newValue=args.value;
    const rows=await rawQuery('UPDATE rtc_hub_fake_provider SET value=$1 WHERE id=1 RETURNING value',
      [newValue]);
    if(rows.length!==1)throw new Error('Fake TEST provider did not update');
  };
  const common={
    read:async()=>({value:await readValue()}),
    summarize:async(before,args)=>{
      if(!['committed','preview','unconfirmed'].includes(args.value))
        throw new TypeError('Malformed fake TEST provider fixture value');
      return 'Fixture TEST metadata from '+before.value+' to '+args.value;
    },
    apply,readAfter:async()=>({value:await readValue()}),
    verify:async(_before,after,args)=>after.value===args.value,
    idempotency
  };
  const safe=defineWrite({name:'rtc_fixture_write',...common});
  const guarded=defineWrite({name:'rtc_fixture_guarded',...common});
  const tool=(source,destructive)=>({
    ...source.tool,
    description:destructive?'Guarded fake TEST destructive preview requires owner confirmation.':
      'Guarded fake TEST provider metadata change, with native readback and audit.',
    area:'payments',profiles:['full'],
    destructive,annotations:{destructiveHint:destructive},
    inputSchema:previewSchema
  });
  const fixtureRead={
    name:'rtc_fixture_read',description:'Read original disposable fake Stripe TEST provider metadata.',
    area:'server',profiles:['read_only','everyday','full'],
    writes:false,destructive:false,money:false,
    annotations:{readOnlyHint:true,destructiveHint:false},
    inputSchema:readSchema
  };
  const fixtureLarge={
    ...fixtureRead,name:'rtc_fixture_large_read',
    description:'Read >8 KB original fake Stripe TEST provider report through scoped handle.'
  };
  const handlers={
    ...registry.handlers,
    rtc_fixture_read:async()=>ok({value:await readValue()}),
    rtc_fixture_large_read:async()=>ok({
      value:await readValue(),payload:'X'.repeat(9800)}),
    rtc_fixture_write:safe.handler,
    rtc_fixture_guarded:guarded.handler
  };
  return {
    registry:{tools:[fixtureRead,fixtureLarge,tool(safe,false),tool(guarded,true),
      ...registry.tools],handlers},
    fixtures:{
      read:{name:'stripe_rtc_fixture_read',args:{}},
      largeRead:{name:'stripe_rtc_fixture_large_read',args:{}},
      write:{name:'stripe_rtc_fixture_write',args:{}},
      guarded:{name:'stripe_rtc_fixture_guarded',args:{}},
      field:'value',valueArgument:'value'
    },
    readValue
  };
}
