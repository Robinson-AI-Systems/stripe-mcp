#!/usr/bin/env node
// X-2: explicit authenticated, TEST-only read inventory against deployed MCP.
// Missing fixture, restricted permission and provider errors are gaps, NOT passes.
// Never print bearer tokens, provider payloads or resource identity in audit.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {registry} from '../src/tools/index.js';

const defaultReport='docs/audits/smoke-2026-10-18.md';
const reqArgs=(tool)=>Array.isArray(tool.inputSchema?.required)?
  tool.inputSchema.required:[];
const hasInputs=(schema,args)=>
  !!args&&typeof args==='object'&&!Array.isArray(args)&&
  reqArgs({inputSchema:schema}).every(k=>Object.hasOwn(args,k))&&
  Object.keys(args).every(k=>Object.hasOwn(schema.properties??{},k));
const safeError=e=>{
  const s=typeof e==='string'?e:(e?.message??'Provider returned an error');
  // Never write a remote error, URL, arbitrary customer ID or private text.
  if(/status 4\d\d|status 5\d\d/i.test(s))return 'HTTP/provider transport rejected request';
  return /network|timeout|abort/i.test(s)?'TEST connection transport unavailable':
    'MCP call failed; investigate authorized provider and fixture prerequisites';
};
export function inventory(tools=registry.tools) {
  if(!Array.isArray(tools))throw new TypeError('Registered tools required');
  const reads=tools.filter(t=>t.writes===false);
  if(reads.some(t=>!t.name||!Array.isArray(t.profiles))||
    new Set(reads.map(t=>t.name)).size!==reads.length)
    throw new TypeError('Unsafe or duplicated read-only tool registry');
  return reads;
}
export function assertTestWhoami(result) {
  const data=result?.content?.[0]?.text;
  if(result?.isError||typeof data!=='string')throw new Error('TEST identity not verified: no authenticated whoami result');
  let parsed;try{parsed=JSON.parse(data);}catch{throw new Error('TEST identity not verified: response not JSON');}
  if(parsed.mode!=='test'||!/^acct_[A-Za-z0-9]{2,100}$/.test(parsed.account??'')||
    parsed.liveEnabled===true)
    throw new Error('TEST-only smoke refused: connected MCP identity was not verified TEST');
  return true;
}
export async function collect({tools=registry.tools,call=null,fixtures={},origin=null,
  deployedRevision=null,inventoryOnly=false}={}) {
  const reads=inventory(tools);
  if(!inventoryOnly){
    if(typeof call!=='function')throw new TypeError('Authenticated MCP TEST request function required');
    // This is the only action allowed before TEST verification; never invoke
    // customer/account reading or any write if whoami is missing or LIVE.
    assertTestWhoami(await call('stripe_whoami',{}));
  }
  const rows=[];
  for(const tool of reads){
    if(inventoryOnly){
      rows.push({name:tool.name,result:'GAP',reason:'Not invoked: no verified authenticated TEST transport'});
      continue;
    }
    // Every registered read is inventoried even if an exact provider-owned
    // resource ID/permission is absent. Do not substitute made-up IDs.
    const supplied=fixtures[tool.name];
    const required=reqArgs(tool);
    const args=supplied??(required.length===0?{}:null);
    if(!hasInputs(tool.inputSchema??{properties:{}},args)){
      rows.push({name:tool.name,result:'GAP',
        reason:'No authorized TEST fixture or required parameters: '+required.join(',')});
      continue;
    }
    try{
      const response=tool.name==='stripe_whoami'?
        await call('stripe_whoami',{}):await call(tool.name,args);
      if(response?.isError===true||!Array.isArray(response?.content)||
        response.content.some(x=>x?.type!=='text'))
        rows.push({name:tool.name,result:'GAP',reason:'Read denied or response contract unavailable'});
      else rows.push({name:tool.name,result:'PASS',reason:'Authenticated TEST MCP tool returned a result'});
    }catch(e){rows.push({name:tool.name,result:'GAP',reason:safeError(e)});}
  }
  return {reads:reads.length,rows,origin:origin??'not executed',
    deployedRevision:deployedRevision??'not independently verified',
    identity:inventoryOnly?'unverified':'provider whoami TEST confirmed',
    mode:inventoryOnly?'inventory-only':'test'};
}
export function report(summary){
  const escape=s=>String(s).replace(/\|/g,'/').replace(/[\r\n]/g,' ').slice(0,160);
  const table=summary.rows.map(row=>
    '| \`'+escape(row.name)+'\` | '+escape(row.result)+' | '+
      escape(row.reason)+' |').join('\n');
  return '# X-2 — original read-only TEST smoke inventory (2026-10-18)\n\n'+
    '- Execution: '+escape(summary.mode)+'; '+escape(summary.identity)+
    '. The registry was inventoried; a GAP is not acceptance.\n'+
    '- Origin: '+escape(summary.origin)+'\n'+
    '- Deployed revision: '+escape(summary.deployedRevision)+'\n'+
    '- Read-only tools inventoried: '+summary.reads+
    '; independently observed PASS: '+summary.rows.filter(r=>r.result==='PASS').length+
    '; GAP: '+summary.rows.filter(r=>r.result!=='PASS').length+'.\n'+
    '- No writes requested, no LIVE reads permitted, no provider payloads or credentials stored.\n'+
    '- Required fixture IDs must be supplied through local TEST-only protected configuration.\n\n'+
    '| Registered read-only tool | Result | Evidence / gap |\n|---|---|---|\n'+table+'\n';
}
function opts(argv){
  const out={};
  for(let i=0;i<argv.length;i+=2){
    if(!argv[i].startsWith('--')||i+1>=argv.length)
      throw new Error('Use --origin, --token-env, --fixtures, --report, --deployed, or --inventory-only yes');
    out[argv[i].slice(2)]=argv[i+1];
  }
  if(Object.keys(out).some(k=>!['origin','token-env','fixtures','report',
    'deployed','inventory-only'].includes(k)))throw new Error('Unsupported smoke CLI flag');
  return out;
}
export async function mcpRequest({origin,token},name,args){
  if(!/^https:\/\/[A-Za-z0-9.-]+(?:\/api\/mcp)?$/.test(origin)||
    !/^[-._~+\/A-Za-z0-9]+=*$/.test(token))
    throw new Error('Safe HTTPS origin and protected TEST bearer required');
  const url=origin.endsWith('/api/mcp')?origin:origin+'/api/mcp';
  const response=await fetch(url,{method:'POST',
    headers:{authorization:'Bearer '+token,'content-type':'application/json',
      accept:'application/json, text/event-stream'},
    body:JSON.stringify({jsonrpc:'2.0',id:42,method:'tools/call',
      params:{name,arguments:args}}),signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw new Error('HTTP status '+response.status);
  const body=await response.text();
  if(body.length>1000000)throw new Error('MCP response exceeded safe byte cap');
  let content;
  if((response.headers.get('content-type')??'').includes('text/event-stream')){
    const payload=body.split('\n').filter(line=>line.startsWith('data: ')).
      map(line=>line.slice(6)).filter(x=>x!=='[DONE]');
    if(!payload.length)throw new Error('Missing SSE result');
    content=JSON.parse(payload.at(-1));
  }else content=JSON.parse(body);
  if(content.error)throw new Error('Authenticated MCP returned JSON-RPC error');
  return content.result;
}
export async function main(argv=process.argv.slice(2),env=process.env){
  const flags=opts(argv),inventoryOnly=flags['inventory-only']==='yes';
  if(!inventoryOnly&&(!flags.origin||!flags['token-env']||
    !env[flags['token-env']]))
    throw new Error('Verified TEST origin and bearer variable required; no implicit production fallback');
  const fixtures=flags.fixtures?JSON.parse(await readFile(flags.fixtures,'utf8')):{};
  const token=inventoryOnly?null:env[flags['token-env']];
  const output=await collect({inventoryOnly,fixtures,origin:flags.origin,
    deployedRevision:flags.deployed,call:inventoryOnly?null:
      (name,args)=>mcpRequest({origin:flags.origin,token},name,args)});
  await writeFile(flags.report??defaultReport,report(output),'utf8');
  return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().then(x=>{process.stdout.write(
    'Read-only TEST smoke: '+x.reads+' checked, '+
    x.rows.filter(row=>row.result==='PASS').length+' observed, report written\n');},
    e=>{process.stderr.write(safeError(e)+'\n');process.exitCode=1;});
}
