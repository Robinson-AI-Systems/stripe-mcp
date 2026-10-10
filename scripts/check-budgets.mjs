// Exact o200k-base token budgets, pinned to gpt-tokenizer 3.4.0.
// Fail CI on listing, schema and default 100-record response regressions.
import {countTokens} from 'gpt-tokenizer';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {registry} from '../src/tools/index.js';
import {listingForConnection,publicToolInfo} from '../src/core/profiles.js';
import {dispatchReadOnlyTool} from '../src/core/mcp-server.js';
const tokens=x=>countTokens(JSON.stringify(x));
export function evaluateBudgets(source=registry){
  const failures=[],counts={};
  for(const tool of source.tools){
    if((tool.description||'').length>160)
      failures.push(tool.name+' listing description >160 characters');
    const amount=tokens(publicToolInfo(tool).inputSchema);
    if(amount>=1500)failures.push(tool.name+' schema >=1500 tokens: '+amount);
  }
  const connection={profile:'everyday',listing:'compact'};
  counts.compact=tokens(listingForConnection(source,connection).map(publicToolInfo));
  counts.everyday=tokens(listingForConnection(source,{...connection,listing:'catalog'})
    .map(publicToolInfo));
  if(counts.compact>=5000)failures.push('Compact listing >=5000 tokens');
  if(counts.everyday>=20000)failures.push('Everyday catalog >=20000 tokens');
  return {failures,counts};
}
export async function verifyDefaultFixture(source=registry){
  const fixture={name:'fixture_read_100',writes:false,
    profiles:['read_only','everyday','full'],
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    description:'Inspect a safe 100-item fixture'};
  const testRegistry={tools:[...source.tools,fixture],handlers:{...source.handlers,
    fixture_read_100:async()=>({content:[{type:'text',text:JSON.stringify({
      object:'list',data:Array.from({length:100},(_,i)=>({
        object:'customer',id:'cus_'+i,name:'A tested customer '.repeat(4),
        email:'person'+i+'@example.test',balance:1000,currency:'usd'}))
    })}]})}};
  let saved=false;
  const result=await dispatchReadOnlyTool({registry:testRegistry,name:fixture.name,
    args:{},connection:{mode:'test',profile:'everyday',resultScope:randomUUID()},
    db:{async putScopedResult(){saved=true;}}});
  const bytes=Buffer.byteLength(JSON.stringify(result),'utf8');
  const handle=result.content?.[0]?.text?.includes('res_');
  return {bytes,saved,handle:!!handle,ok:!result.isError&&saved&&handle&&bytes<=8192};
}
async function main(){
  const {failures,counts}=evaluateBudgets();
  const response=await verifyDefaultFixture();
  if(!response.ok)failures.push('100-record default fixture exceeds 8 KB without a private handle');
  console.log('Tokenizer: gpt-tokenizer@3.4.0 (o200k_base)');
  console.log('Compact: '+counts.compact+' tokens (<5000); everyday catalog: '+
    counts.everyday+' tokens (<20000); 100-item response: '+response.bytes+' bytes');
  if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
  else console.log('Context budget and result handle checks passed for '+registry.tools.length+' tools');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error('Budget validation failed:',error.message);process.exitCode=1;});
}