// Reusable read-result rules. All input must first pass shapeToolResult
// credential redaction; do not store raw provider objects in result_store.
import {summarizeProvider} from './summaries.js';

const safePath=/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){0,5}$/;
const forbidden=new Set(['__proto__','prototype','constructor']);
export function projectFields(value,fields){
  if(fields===undefined||fields===null||fields==='')return {value,unknown:[]};
  if(typeof fields!=='string'||fields.length>600)throw new TypeError('fields must be a short comma-separated list');
  const paths=fields.split(',').map(v=>v.trim());
  if(paths.length>12||paths.some(p=>!safePath.test(p)||p.length>100||
    p.split('.').some(x=>forbidden.has(x)))||new Set(paths).size!==paths.length)
    throw new TypeError('Choose at most 12 distinct safe dotted fields');
  if(value===null||typeof value!=='object')return {value,unknown:paths};
  // A dotted path projects across array elements (e.g. data.id), without
  // permitting arbitrary numeric indexes, prototypes or unsafe keys.
  function select(node,parts){
    if(parts.length===0)return {found:true,value:node};
    if(Array.isArray(node)){
      const rows=node.map(item=>select(item,parts));
      return rows.some(r=>r.found)?{found:true,value:rows.map(r=>r.found?r.value:null)}
        :{found:false};
    }
    if(!node||typeof node!=='object'||!Object.hasOwn(node,parts[0]))
      return {found:false};
    const next=select(node[parts[0]],parts.slice(1));
    return next.found?{found:true,value:{[parts[0]]:next.value}}:{found:false};
  }
  function merge(into,from){
    if(Array.isArray(from)){
      return from.map((item,i)=>merge(into?.[i],item));
    }
    if(!from||typeof from!=='object')return from;
    const merged={...into};
    for(const [key,v] of Object.entries(from))
      merged[key]=merge(merged[key],v);
    return merged;
  }
  let out={};const unknown=[];
  for(const path of paths){
    const result=select(value,path.split('.'));
    if(!result.found){unknown.push(path);continue;}
    out=merge(out,result.value);
  }
  return {value:out,unknown};
}
export function readDetail(value,{detail,fields}={}){
  if(detail!==undefined&&!['summary','full'].includes(detail))
    throw new TypeError('detail must be summary or full');
  const selected=detail==='full'||(fields!==undefined&&fields!=='')
    ?value:summarizeProvider(value);
  const result=projectFields(selected,fields);
  return result.unknown.length?{...result.value,unavailableFields:result.unknown}:result.value;
}
export function splitResult(value,maxBytes=2500){
  const json=JSON.stringify(value);
  if(typeof json!=='string')throw new TypeError('Serializable result required');
  const pages=[];let chunk='',size=0;
  for(const character of json){
    const bytes=Buffer.byteLength(character,'utf8');
    if(size+bytes>maxBytes&&chunk){pages.push(chunk);chunk='';size=0;}
    chunk+=character;size+=bytes;
  }
  if(chunk||!pages.length)pages.push(chunk);
  return {pages,totalBytes:Buffer.byteLength(json,'utf8')};
}
export function resultPage(body,page=0,fields){
  if(!body||!Array.isArray(body.pages)||body.pages.length===0||
    !body.pages.every(s=>typeof s==='string')||
    !Number.isInteger(page)||page<0||page>=body.pages.length)
    throw new TypeError('Result page unavailable');
  let pages=body.pages;
  let unknown=[];
  if(fields!==undefined&&fields!==''){
    const original=JSON.parse(pages.join(''));
    const projected=projectFields(original,fields);
    pages=splitResult(projected.value).pages;
    unknown=projected.unknown;
  }
  if(page>=pages.length)throw new TypeError('Result page unavailable');
  return {page,pageCount:pages.length,nextPage:page+1<pages.length?page+1:null,
    fragment:pages[page],needsAssembly:pages.length>1,
    unavailableFields:unknown.length?unknown:undefined,
    note:'Concatenate fragments in page order to reconstruct JSON; this is not a complete JSON document unless pageCount is 1.'};
}
