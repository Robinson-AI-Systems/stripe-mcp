// Independent GA-public unified v1/v2 source. Never used to construct a Stripe request.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const UNIFIED_BLOB_SHA = '7e337a03e77e8a350e2fd1ead2e6afe89e18ff43';
export const UPSTREAM_COMMIT = 'af2d19d63ea42049abecf784482898c654ab42d5';
export const UPSTREAM_BLOB = '9da296dc459321ad8cd04c68c41d32af8ca436dd';
export const UNIFIED_VERSION = '2026-09-30.endive';
const SOURCE = new URL('../../vendor/stripe-openapi/unified-ga.operations.json',import.meta.url);
const verbs = new Set(['GET','POST','PUT','PATCH','DELETE']);
const deny = msg => {throw new Error('Unified Stripe inventory: '+msg);};
const key = op => op.method+' '+op.path;

export function validateUnifiedSource(doc,{expectCount=null}={}){
  if(doc?.schemaVersion!==1 || !doc.upstream ||
    doc.upstream.commit!==UPSTREAM_COMMIT ||
    doc.upstream.blobSha!==UPSTREAM_BLOB ||
    doc.upstream.specVersion!==UNIFIED_VERSION ||
    doc.upstream.path!=='latest/openapi.spec3.json' ||
    doc.upstream.audience!=='ga-public' ||
    !Array.isArray(doc.operations) || !doc.operations.length ||
    (expectCount!==null && doc.operations.length!==expectCount))
    deny('unexpected official release/commit/shape');
  const seenKeys=new Set(),seenIds=new Set();
  for(let i=0;i<doc.operations.length;i++){
    const op=doc.operations[i];
    if(!op || !verbs.has(op.method) ||
      !/^\/v[12]\/[A-Za-z0-9_{}./-]+$/.test(op.path) ||
      !/^[A-Za-z0-9_]{4,180}$/.test(op.operationId) ||
      op.apiVersion!==op.path.split('/')[1] ||
      typeof op.summary!=='string' || op.summary.length>180 ||
      typeof op.apiFamily!=='string' || !op.apiFamily.startsWith('/'+op.apiVersion+'/') ||
      Object.keys(op).sort().join(',')!=='apiFamily,apiVersion,method,operationId,path,summary' ||
      seenKeys.has(key(op)) || seenIds.has(op.operationId) ||
      (i && (doc.operations[i-1].path.localeCompare(op.path,'en')>0 ||
        (doc.operations[i-1].path===op.path &&
         doc.operations[i-1].method.localeCompare(op.method,'en')>0))))
      deny('duplicate/malformed/unsorted or misleading source operation');
    seenKeys.add(key(op));seenIds.add(op.operationId);
  }
  return {operationCount:doc.operations.length,
    v1:doc.operations.filter(x=>x.apiVersion==='v1').length,
    v2:doc.operations.filter(x=>x.apiVersion==='v2').length};
}
export function loadUnifiedSource(){
  const bytes=readFileSync(SOURCE);
  const gitBlob=createHash('sha1').update('blob '+bytes.length+'\0')
    .update(bytes).digest('hex');
  if(gitBlob!==UNIFIED_BLOB_SHA)deny('generated inventory blob changed; verify upstream and pin a new reviewed file');
  const doc=JSON.parse(bytes.toString('utf8'));
  validateUnifiedSource(doc,{expectCount:644});
  return doc;
}
