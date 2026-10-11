// G-1g: owner-authenticated TEST finance-report CSV download, never returned to MCP.
import {makeStripeClient} from './client.js';

const accountId=v=>typeof v==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(v);
const runId=v=>typeof v==='string'&&/^frr_[A-Za-z0-9]{2,100}$/.test(v);
const fileId=v=>typeof v==='string'&&/^file_[A-Za-z0-9]{2,100}$/.test(v);
const invalid=()=>{throw new TypeError('Verified TEST report CSV unavailable');};
export const MAX_REPORT_BYTES=5*1024*1024;

async function boundedCsv(response,expectedBytes,maxBytes) {
  if(!response||response.ok!==true||response.status!==200||
     !response.body||typeof response.body.getReader!=='function')invalid();
  const length=response.headers?.get?.('content-length');
  if(length!==null&&length!==undefined&&
     (!/^[0-9]+$/.test(length)||Number(length)>maxBytes||Number(length)!==expectedBytes))
    invalid();
  const reader=response.body.getReader(),parts=[];
  let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))invalid();
      size+=value.byteLength;
      if(size>maxBytes||size>expectedBytes)invalid();
      parts.push(value);
    }
  } catch {
    await reader.cancel().catch(()=>{});
    invalid();
  }
  if(size!==expectedBytes)invalid();
  const result=Buffer.concat(parts.map(p=>Buffer.from(p)),size);
  if(result.includes(0))invalid();
  return result;
}

// The key is decrypted only after the separate owner password + CSRF checks.
// No URL supplied by a user or Stripe response is used as a fetch destination.
export function createReportDownloader({db,keyStore,makeClient=makeStripeClient,
  fetcher=globalThis.fetch,maxBytes=MAX_REPORT_BYTES}) {
  return async function download({account,run}) {
    if(!accountId(account)||!runId(run)||!db||!keyStore||
       !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_REPORT_BYTES)invalid();
    const record=await db.getStripeAccount(account);
    if(record?.test_connected!==true)invalid();
    const key=await keyStore.loadKey({account,mode:'test'});
    if(typeof key!=='string'||!/^(?:sk|rk)_test_[A-Za-z0-9]+$/.test(key))invalid();
    const stripe=makeClient({key,mode:'test'});
    const report=await stripe.reporting.reportRuns.retrieve(run);
    if(report?.object!=='reporting.report_run'||report.id!==run||
       report.livemode!==false||report.status!=='succeeded')invalid();
    const result=typeof report.result==='string'?report.result:report.result?.id;
    if(!fileId(result))invalid();
    const file=await stripe.files.retrieve(result);
    const url='https://files.stripe.com/v1/files/'+result+'/contents';
    if(file?.object!=='file'||file.id!==result||
       file.purpose!=='finance_report_run'||file.livemode===true||
       file.url!==url||!['csv','text/csv','application/csv'].includes(file.type)||
       !Number.isSafeInteger(file.size)||file.size<1||file.size>maxBytes)invalid();
    const response=await fetcher(url,{method:'GET',headers:{
      Authorization:'Bearer '+key,Accept:'text/csv'
    },redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const bytes=await boundedCsv(response,file.size,maxBytes);
    return {bytes,filename:'stripe-report-'+run+'.csv'};
  };
}
