// Context-efficient discovery. Every indirect execution goes through the
// exact same default-deny dispatcher as a direct MCP tool call.
import {visibleTools,isToolAllowed,publicToolInfo,isGuardedTestWrite,isGuardedLiveWrite} from '../core/profiles.js';
const profiles=['read_only','everyday','full'];
const shape={type:'object',additionalProperties:false};
const noNested=new Set(['stripe_call','stripe_batch','stripe_search_tools','stripe_describe_tool']);
const okay=x=>({content:[{type:'text',text:JSON.stringify(x)}]});
const deny=x=>({isError:true,content:[{type:'text',text:x}]});
export const tools=[
  {name:'stripe_search_tools',area:'server',writes:false,profiles,
    description:'Search available Stripe tools by action or name with safety labels.',
    inputSchema:{...shape,properties:{
      query:{type:'string',minLength:1,maxLength:100},
      area:{type:'string',maxLength:50},
      limit:{type:'integer',minimum:1,maximum:20},
      offset:{type:'integer',minimum:0,maximum:100000}
    },required:['query']}},
  {name:'stripe_describe_tool',area:'server',writes:false,profiles,
    description:'Describe one available Stripe tool, including arguments and safety.',
    inputSchema:{...shape,properties:{name:{type:'string',minLength:1,maxLength:120}},
      required:['name']}},
  {name:'stripe_call',area:'server',writes:false,profiles,
    description:'Call an available Stripe tool through its profile and guarded write-contract checks.',
    inputSchema:{...shape,properties:{
      name:{type:'string',minLength:1,maxLength:120},
      args:{type:'object',additionalProperties:true}
    },required:['name']}},
  {name:'stripe_batch',area:'server',writes:false,profiles,
    description:'Run up to ten available read-only Stripe calls, with no write bypass.',
    inputSchema:{...shape,properties:{
      calls:{type:'array',minItems:1,maxItems:10,items:{type:'object',
        properties:{name:{type:'string'},args:{type:'object'}},
        required:['name'],additionalProperties:false}}
    },required:['calls']}}
];
const allowed=(registry,connection,name)=>{
  const tool=registry?.tools?.find(t=>t.name===name);
  const safeWrite=isGuardedTestWrite(tool,connection)||isGuardedLiveWrite(tool,connection);
  return isToolAllowed(tool,connection?.profile,{allowWrites:safeWrite})&&
    (tool.writes===false||safeWrite)?tool:null;
};
const safeArgs=x=>x===undefined||(x!==null&&typeof x==='object'&&!Array.isArray(x));
export const handlers={
  async stripe_search_tools(args,{registry,connection}){
    if(typeof args?.query!=='string'||!args.query.trim()||args.query.length>100||
      (args.area!==undefined&&(typeof args.area!=='string'||args.area.length>50))||
      (args.limit!==undefined&&(!Number.isSafeInteger(args.limit)||args.limit<1||args.limit>20))||
      (args.offset!==undefined&&(!Number.isSafeInteger(args.offset)||args.offset<0||args.offset>100000)))
      return deny('Provide a bounded tool search query, area, limit and offset');
    const words=args.query.toLowerCase().trim().split(/\s+/).slice(0,10);
    const filtered=visibleTools(registry,connection.profile,
      {allowWrites:connection.mode==='test'||connection.rtcLiveOwnerApproved===true})
      .filter(t=>allowed(registry,connection,t.name)&&(!args.area||
        (t.area||t.name.split('_')[0])===args.area))
      .map(t=>({tool:t,score:words.reduce((n,w)=>
        n+((t.name+' '+t.description).toLowerCase().includes(w)?1:0),0)}))
      .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.tool.name.localeCompare(b.tool.name));
    const offset=args.offset??0,limit=args.limit??10;
    const next=offset+limit<filtered.length?offset+limit:null;
    return okay({matches:filtered.slice(offset,offset+limit).map(({tool})=>({
      name:tool.name,description:tool.description,
      safety:tool.writes===false?'READ ONLY':'GUARDED '+connection.mode.toUpperCase()+' WRITE'})),
      total:filtered.length,hasMore:next!==null,nextOffset:next});
  },
  async stripe_describe_tool(args,{registry,connection}){
    if(typeof args?.name!=='string'||args.name.length>120)
      return deny('A valid tool name is required');
    const t=allowed(registry,connection,args.name);
    if(!t)return deny('Tool unavailable for this connection');
    const info=publicToolInfo(t);
    return okay({name:info.name,description:info.description,
      inputSchema:info.inputSchema,annotations:info.annotations,
      safety:t.writes===true?'GUARDED '+connection.mode.toUpperCase()+' WRITE':'READ ONLY',area:t.area||t.name.split('_')[0]});
  },
  async stripe_call(args,{registry,connection,runRead}){
    if(typeof args?.name!=='string'||noNested.has(args.name)||
      !safeArgs(args.args))return deny('Select a non-meta tool and valid object arguments');
    if(!allowed(registry,connection,args.name)||typeof runRead!=='function')
      return deny('Tool unavailable for this connection');
    return runRead(args.name,args.args??{});
  },
  async stripe_batch(args,{registry,connection,runRead}){
    if(!Array.isArray(args?.calls)||args.calls.length<1||args.calls.length>10||
      typeof runRead!=='function'||args.calls.some(call=>
        !call||typeof call!=='object'||typeof call.name!=='string'||
        noNested.has(call.name)||!safeArgs(call.args)||
        allowed(registry,connection,call.name)?.writes!==false))
      return deny('All batch calls must be available read-only tools, at most 10');
    const results=[];
    for(const call of args.calls){
      // The same wrapped dispatcher enforces profile and read-only policy.
      const result=await runRead(call.name,call.args??{});
      results.push({name:call.name,result});
    }
    return okay({count:results.length,results});
  }
};