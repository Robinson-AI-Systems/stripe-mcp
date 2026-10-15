// W-series shared read-only orchestration. Only call real, wrapped registry reads.
// A bounded/failed page never turns partial observations into a complete report.
import {allProfiles} from './billing-shared.js';

const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
const CUSTOMER=/^cus_[A-Za-z0-9]{2,100}$/;
export const MAX_MS=50_000;
export const MAX_PAGES=10;
export const MAX_ROWS=1000;
export const str=(v,n=180)=>typeof v==='string'?v.slice(0,n):null;
export const validCustomer=v=>CUSTOMER.test(v??'');
export const hasCurrency=v=>typeof v==='string'&&/^[a-z]{3}$/.test(v);
export const integer=v=>Number.isSafeInteger(v)&&Math.abs(v)<=1_000_000_000_000;

export function verifyContext(ctx){
  if(ctx?.connection?.mode!=='test'||!ACCOUNT.test(ctx.connection.stripeAccount??'')||
    !allProfiles.includes(ctx.connection.profile))
    throw new TypeError('An exact selected TEST account and permitted read profile are required');
}
export function deadline(){return Date.now()+MAX_MS;}
export function expired(end){return Date.now()>=end;}
export function statusText(value){
  if(value?.isError)throw new TypeError('A guarded native TEST read was denied');
  const text=value?.content?.[0]?.text;
  if(typeof text!=='string'||text.length>2_000_000)
    throw new TypeError('Native read result is unavailable');
  let data;
  try{data=JSON.parse(text);}catch{throw new TypeError('Native read returned invalid JSON');}
  if(!data||typeof data!=='object'||Array.isArray(data))
    throw new TypeError('Native read returned invalid shape');
  return data;
}
export async function nativeRead(name,args,ctx){
  verifyContext(ctx);
  const {registry}=await import('./index.js');
  const tool=registry.tools.find(v=>v.name===name);
  if(!tool||tool.writes!==false||!tool.profiles?.includes(ctx.connection.profile)||
    typeof registry.handlers[name]!=='function')
    throw new TypeError('An approved read-only tool is unavailable');
  return statusText(await registry.handlers[name](args,ctx));
}

// Fail closed on nonadvancing cursors, missing has_more, duplicate page identities
// and incomplete result shape. Return previously verified rows with a reason.
export async function collect(name,args,ctx,{end,maxPages=MAX_PAGES,stop}={}){
  let cursor=null,pages=0,complete=false,reason=null;
  const data=[],ids=new Set(),cursors=new Set();
  while(pages<maxPages&&data.length<MAX_ROWS){
    if(expired(end)){reason='time_budget';break;}
    const input={...args};
    if(cursor)input.starting_after=cursor;
    let page;
    try{page=await nativeRead(name,input,ctx);}
    catch{reason='guarded_read_unavailable';break;}
    if(!Array.isArray(page.data)||typeof page.has_more!=='boolean'||
      page.data.length>(args.limit??100)){
      reason='invalid_page';break;
    }
    pages++;
    for(const item of page.data){
      if(!item||typeof item.id!=='string'||ids.has(item.id)){
        reason='duplicate_or_missing_provider_id';break;
      }
      ids.add(item.id);data.push(item);
    }
    if(reason)break;
    if(expired(end)){reason='time_budget';break;}
    if(stop?.(page.data)===true){complete=true;break;}
    if(!page.has_more){complete=true;break;}
    if(!page.data.length||typeof page.next!=='string'||cursors.has(page.next)){
      reason='nonadvancing_cursor';break;
    }
    cursors.add(page.next);cursor=page.next;
  }
  if(!complete&&!reason)reason='bounded_page_limit';
  return {data,complete,reason,pages,next:complete?null:cursor};
}
export const partial=(sections,end)=>({
  complete:sections.every(x=>x.complete)&&!expired(end),
  continuation:sections.every(x=>x.complete)&&!expired(end)?null:
    'One or more pages were not verified. Repeat this read with narrower inputs; never treat partial totals as final.',
  gaps:sections.filter(x=>!x.complete).map(x=>({section:x.name,reason:x.reason??'time_budget'}))
});
export function amount(value){
  if(!integer(value))throw new TypeError('Verified integer Stripe minor units required');
  return value;
}
export function byCurrency(rows,select){
  const sums=Object.create(null);
  for(const row of rows){
    const {currency,value}=select(row);
    if(!hasCurrency(currency)||!Number.isFinite(value))
      throw new TypeError('Currency or value unavailable');
    sums[currency]=(sums[currency]??0)+value;
    if(!Number.isSafeInteger(Math.round(sums[currency])))
      throw new TypeError('Money aggregate exceeds safe integer');
  }
  return Object.fromEntries(Object.entries(sums).sort());
}

// Date-only boundaries in America/Denver. Never assume a civil day = 86400 s.
const dateRe=/^\d{4}-\d{2}-\d{2}$/;
export function civilStart(s){
  if(!dateRe.test(s??'')||!Number.isFinite(Date.parse(s+'T00:00:00Z')))
    throw new TypeError('Use a real YYYY-MM-DD Colorado date');
  const [year,month,day]=s.split('-').map(Number);
  const check=new Date(Date.UTC(year,month-1,day));
  if(check.toISOString().slice(0,10)!==s)
    throw new TypeError('Invalid calendar date');
  const stamp=Date.UTC(year,month-1,day);
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit'});
  const wall=ms=>{
    const v=Object.fromEntries(fmt.formatToParts(ms).map(x=>[x.type,x.value]));
    return Date.UTC(Number(v.year),Number(v.month)-1,Number(v.day),Number(v.hour),Number(v.minute));
  };
  let ms=stamp+7*3600_000;
  // Fixed point can oscillate at transitions; use bounded offset sampling.
  for(let i=0;i<4;i++)ms+=stamp-wall(ms);
  if(wall(ms)!==stamp)throw new TypeError('Colorado date boundary unavailable');
  return Math.floor(ms/1000);
}
export function dateWindow(start,end){
  const from=civilStart(start);
  const next=new Date(Date.parse(end+'T00:00:00Z')+86_400_000);
  if(!dateRe.test(end??'')||!Number.isFinite(next.getTime()))
    throw new TypeError('Invalid end date');
  const until=civilStart(next.toISOString().slice(0,10));
  if(until<=from||until-from>366*86_400)
    throw new TypeError('Choose a 1–366-day inclusive Colorado window');
  return {from,until,fromDate:start,throughDate:end,timeZone:'America/Denver'};
}
