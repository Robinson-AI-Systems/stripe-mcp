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
  const out={};const unknown=[];
  for(const path of paths){
    const parts=path.split('.');let cursor=value;
    for(const segment of parts){
      if(!cursor||typeof cursor!=='object'||!Object.hasOwn(cursor,segment)){
        cursor=undefined;break;
      }
      cursor=cursor[segment];
    }
    if(cursor===undefined){unknown.push(path);continue;}
    let destination=out;
    for(const segment of parts.slice(0,-1)){
      if(!Object.hasOwn(destination,segment))destination[segment]={};
      destination=destination[segment];
    }
    Object.defineProperty(destination,parts.at(-1),{value:cursor,
      enumerable:true,writable:true,configurable:true});
  }
  return {value:out,unknown};
}
export function readDetail(value,{detail,fields}={}){
  if(detail!==undefined&&!['summary','full'].includes(detail))
    throw new TypeError('detail must be summary or full');
  const selected=detail==='full'?value:summarizeProvider(value);
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
