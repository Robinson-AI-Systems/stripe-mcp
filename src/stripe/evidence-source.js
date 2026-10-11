// G-2b2: bounded HTTPS import of public evidence with pinned public DNS resolution.
// No request target, credential, document content or signed query is ever logged.
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
export const MAX_EVIDENCE_BYTES=10*1024*1024;
const refusal=()=>{throw new TypeError('Public evidence URL is unavailable or unsafe');};
export function publicIpv4(ip) {
  if(isIP(ip)!==4)return false;
  const [a,b,c]=ip.split('.').map(Number);
  if(a<1||a>223||[10,127].includes(a)||
    (a===100&&b>=64&&b<=127)||
    (a===169&&b===254)||(a===172&&b>=16&&b<=31)||
    (a===192&&(b===168||b===0||b===88&&c===99))||
    (a===198&&(b===18||b===19||b===51&&c===100))||
    (a===203&&b===0&&c===113))return false;
  return true;
}
export function parseEvidenceUrl(source) {
  if(typeof source!=='string'||source.length<12||source.length>2048||
    /[\r\n\0]/.test(source))refusal();
  let u;try{u=new URL(source);}catch{refusal();}
  if(u.protocol!=='https:'||u.username||u.password||u.hash||
    (u.port&&u.port!=='443')||u.hostname.length>253||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(u.hostname)||
    !u.hostname.includes('.')||isIP(u.hostname)||
    u.hostname==='localhost'||u.hostname.endsWith('.localhost'))refusal();
  // Shared Google Drive file links produce HTML viewers; request their download
  // endpoint instead. Public access is still required; private files fail closed.
  if(u.hostname==='drive.google.com'&&/^\/file\/d\//.test(u.pathname)) {
    const match=/^\/file\/d\/([A-Za-z0-9_-]{10,120})(?:\/(?:view|edit))?\/?$/.exec(u.pathname);
    if(!match)refusal();
    u=new URL('https://drive.google.com/uc?export=download&id='+match[1]);
  }
  return u;
}
export function evidenceType(buffer) {
  if(!Buffer.isBuffer(buffer)||buffer.length<8)refusal();
  if(buffer.subarray(0,5).equals(Buffer.from('%PDF-')))return {mime:'application/pdf',extension:'pdf'};
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    return {mime:'image/png',extension:'png'};
  if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)
    return {mime:'image/jpeg',extension:'jpg'};
  refusal();
}
function pinnedGet(url,ip) {
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{lookup:(_host,_opts,callback)=>callback(null,ip,4),
      family:4,signal:AbortSignal.timeout(15000),
      headers:{Accept:'application/pdf,image/jpeg,image/png,application/octet-stream',
        'User-Agent':'RobinsonStripeEvidenceImport/1.0'},
      maxHeaderSize:16384},resolve);
    req.once('error',reject);
  });
}
export async function downloadEvidence(source,{resolveHost=lookup,request=pinnedGet,
  maxBytes=MAX_EVIDENCE_BYTES}={}) {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_EVIDENCE_BYTES)refusal();
  let url=parseEvidenceUrl(source);
  for(let hop=0;hop<3;hop++){
    const resolved=await resolveHost(url.hostname,{family:4,all:true});
    if(!Array.isArray(resolved)||!resolved.length||
       resolved.length>20||resolved.some(x=>x.family!==4||!publicIpv4(x.address)))refusal();
    const response=await request(url,resolved[0].address);
    const status=response?.statusCode;
    if([301,302,303,307,308].includes(status)&&hop<2){
      const location=response.headers?.location;
      response.destroy?.();
      if(typeof location!=='string'||location.length>2048)refusal();
      let next;try{next=new URL(location,url);}catch{refusal();}
      url=parseEvidenceUrl(next.href);
      continue;
    }
    if(status!==200) {response?.destroy?.();refusal();}
    const length=response.headers?.['content-length'];
    if(length!==undefined&&(!/^[0-9]{1,10}$/.test(String(length))||
       Number(length)>maxBytes)) {response.destroy?.();refusal();}
    if(/text\/html/i.test(String(response.headers?.['content-type']||''))) {
      response.destroy?.();refusal();
    }
    const chunks=[];let size=0;
    try{
      for await(const chunk of response){
        if(!Buffer.isBuffer(chunk))refusal();
        size+=chunk.length;
        if(size>maxBytes)refusal();
        chunks.push(chunk);
      }
    }catch{response.destroy?.();refusal();}
    if(length!==undefined&&size!==Number(length))refusal();
    const buffer=Buffer.concat(chunks,size);
    return {...evidenceType(buffer),buffer,size};
  }
  refusal();
}
