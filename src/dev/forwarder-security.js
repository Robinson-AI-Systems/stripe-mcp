// Outbound developer webhook prerequisites. No request is sent from this module.
// Every address is resolved once; the caller MUST pin the verified IP in TLS
// while preserving the original hostname for Host/SNI and reject redirects.
import {lookup as dnsLookup} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';
import {createHmac} from 'node:crypto';

const reject=x=>{throw new TypeError(x);};
const reservedV4=new BlockList();
for(const [base,bits] of [
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],
  ['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],
  ['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],
  ['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],
  ['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]
])reservedV4.addSubnet(base,bits,'ipv4');
const globallyRoutableV6=new BlockList();
globallyRoutableV6.addSubnet('2000::',3,'ipv6');
const reservedV6=new BlockList();
for(const [base,bits] of [
  ['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]
])reservedV6.addSubnet(base,bits,'ipv6');

export function isGlobalForwardAddress(address){
  const family=isIP(address);
  if(family===4)return !reservedV4.check(address,'ipv4');
  if(family===6)return globallyRoutableV6.check(address,'ipv6')&&
    !reservedV6.check(address,'ipv6');
  return false;
}

export function parseForwardUrl(input){
  if(typeof input!=='string'||input.length<1||input.length>2048||
    [...input].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127||
      c.charCodeAt(0)===92))
    reject('Invalid webhook target URL');
  let u;
  try{u=new URL(input);}catch{reject('Invalid webhook target URL');}
  if(u.protocol!=='https:'||u.username||u.password||u.hash||
    (u.port&&u.port!=='443')||u.search)
    reject('Webhook targets require HTTPS port 443 without credentials, query or fragment');
  const host=u.hostname.toLowerCase();
  if(host.length>253||!host.includes('.')||isIP(host)||host.includes(':')||
    !/^[a-z0-9.-]+$/.test(host)||
    !host.split('.').every(label=>label.length>0&&label.length<=63&&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion|lan)$/.test(host)||
    host.endsWith('.home.arpa'))
    reject('Webhook hostname must be public DNS, not internal or literal IP');
  return Object.freeze({url:u.toString(),hostname:host});
}

export async function resolveForwardTarget(input,{lookup=dnsLookup}={}){
  const target=parseForwardUrl(input);
  let records;
  try{records=await lookup(target.hostname,{all:true,verbatim:true});}
  catch{reject('Webhook public DNS resolution failed');}
  if(!Array.isArray(records)||records.length<1||records.length>32||
    !records.every(r=>r&&[4,6].includes(r.family)&&
      isIP(r.address)===r.family&&isGlobalForwardAddress(r.address)))
    reject('Webhook DNS contains a private, reserved or unverifiable address');
  return Object.freeze({...target,address:records[0].address,
    family:records[0].family,port:443});
}

export function signTestStripeEvent(event,secret,now=Date.now()){
  if(event?.object!=='event'||event.livemode!==false||
    !/^evt_[A-Za-z0-9]{2,100}$/.test(event.id??'')||
    typeof event.type!=='string'||event.type.length<3||
    !event.data?.object||typeof event.data.object!=='object')
    reject('Only a verified original Stripe TEST Event can be forwarded');
  if(typeof secret!=='string'||!/^whsec_[A-Za-z0-9_-]{24,256}$/.test(secret))
    reject('Configured webhook signing secret is unavailable');
  if(!Number.isSafeInteger(now)||now<0)
    reject('A valid current signing time is required');
  const body=JSON.stringify(event),bytes=Buffer.byteLength(body);
  if(bytes<20||bytes>262144)reject('Stripe event payload exceeds safe forwarding limit');
  const timestamp=Math.floor(now/1000);
  const digest=createHmac('sha256',secret)
    .update(String(timestamp)+'.'+body,'utf8').digest('hex');
  return Object.freeze({body,
    signature:'t='+timestamp+',v1='+digest,
    contentType:'application/json'});
}
