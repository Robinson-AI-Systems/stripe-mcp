// Rehearse K-3 inside THIS source checkout; never add private core at runtime.
// CI-only, immutable Hub commit and independently recorded archive SHA256.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const candidateCommit='08f4189f72dbe1d5b870c7b17daabd39833eff31';
// Digest from Hub #122 exact-main source-SQL CI, NOT a remote Release asset.
export const candidateSha256='3038f7664e18ac57e5fdb86daf0884f603a78a446e2f1300f20fd59a92e73ea6';
export const candidateName='robinson-mcp-core-0.1.0.tgz';
export const leaves=Object.freeze(['oauth','crypto','registry','write-contract-check']);
export const originalUnit=Object.freeze([
  'tests/unit/oauth-core.test.js','tests/unit/keys.test.js',
  'tests/unit/registry.test.js','tests/unit/write-metadata.test.js',
  'tests/unit/oauth-handlers.test.js','tests/unit/http-body-limits.test.js',
  'tests/unit/rtc-http.test.js'
]);
export const originalSql=Object.freeze([
  'tests/db/oauth-persistent.test.js','tests/db/oauth.test.js',
  'tests/db/money-owner-approval.test.js','tests/db/money-reservation.test.js',
  'tests/db/owner-money-limit.test.js','tests/db/rtc-passes.test.js',
  'tests/db/rtc-rate-limit.test.js','tests/db/rtc-real-http.test.js',
  'tests/db/rtc-dual-http.test.js'
]);
const cmd=(bin,args,cwd,timeout=120000)=>{
  const r=spawnSync(bin,args,{cwd,timeout,encoding:'utf8',
    env:{...process.env,NODE_OPTIONS:'',npm_config_audit:'false',npm_config_fund:'false'}});
  if(r.error||r.status!==0)throw Error('K-3 CI-only verification command failed: '+
    bin.split('/').at(-1)+' ('+String(r.status)+')');
  return r.stdout.trim();
};
export function assertDisposableDb(env=process.env){
  if(env.CI!=='true')throw Error('K-3 adopter runs only in CI');
  let u;
  try{u=new URL(env.TEST_DATABASE_URL);}
  catch{throw Error('K-3 adopter needs disposable PostgreSQL');}
  if(u.protocol!=='postgresql:'||u.hostname!=='127.0.0.1'||
    u.port!=='5432'||u.pathname!=='/postgres'||u.search||u.hash)
    throw Error('K-3 adopter refuses non-disposable database');
  return true;
}
export function validateCandidate({commit,name,sha256,bytes,privateFlag}){
  if(commit!==candidateCommit||name!==candidateName||
    sha256!==candidateSha256||!Number.isSafeInteger(bytes)||
    bytes<1000||bytes>500000||privateFlag!==true)
    throw Error('K-3 private archive integrity/identity mismatch');
  return true;
}
export function rehearse(){
  assertDisposableDb();
  const hub=join(root,'k3-candidate');
  if(!existsSync(join(hub,'packages/core/package.json')))
    throw Error('Missing immutable private Hub checkout');
  if(cmd('git',['rev-parse','HEAD'],hub)!==candidateCommit)
    throw Error('Hub checkout drifted from pinned commit');
  const scratch=mkdtempSync(join(tmpdir(),'stripe-k3-private-'));
  const installed=join(root,'node_modules/robinson-mcp-core');
  const backups=new Map();
  let installedCreated=false;
  try{
    if(existsSync(installed))
      throw Error('Private library is unexpectedly present in source runtime');
    // Check each pure export against the actual unmodified Stripe source.
    for(const leaf of leaves){
      const local=join(root,'src/core',leaf+'.js');
      const portable=join(hub,'packages/core/src',leaf+'.js');
      const original=readFileSync(local);
      const target=readFileSync(portable);
      if(createHash('sha256').update(original).digest('hex')!==
         createHash('sha256').update(target).digest('hex'))
        throw Error('Stripe / private core leaf mismatch: '+leaf);
      backups.set(local,original);
    }
    const listing=JSON.parse(cmd('npm',['pack','--workspace','packages/core',
      '--json','--ignore-scripts','--pack-destination',scratch],hub));
    if(!Array.isArray(listing)||listing.length!==1||
      listing[0].filename!==candidateName||listing[0].name!=='robinson-mcp-core')
      throw Error('Unexpected private package archive');
    const archive=join(scratch,candidateName),tar=readFileSync(archive);
    const sha256=createHash('sha256').update(tar).digest('hex');
    validateCandidate({commit:candidateCommit,name:listing[0].filename,
      sha256,bytes:statSync(archive).size,privateFlag:true});
    if(listing[0].size!==tar.length||
      'sha512-'+createHash('sha512').update(tar).digest('base64')!==listing[0].integrity)
      throw Error('Private package npm integrity mismatch');
    mkdirSync(installed,{recursive:true});installedCreated=true;
    cmd('tar',['-xzf',archive,'-C',installed,'--strip-components=1'],root);
    const pkg=JSON.parse(readFileSync(join(installed,'package.json'),'utf8'));
    if(pkg.private!==true||pkg.name!=='robinson-mcp-core'||
      pkg.version!=='0.1.0'||leaves.some(leaf=>
        pkg.exports?.['./'+leaf]!=='./src/'+leaf+'.js'))
      throw Error('Installed core exports/identity mismatch');
    for(const leaf of leaves)
      writeFileSync(join(root,'src/core',leaf+'.js'),
        'export * from '+JSON.stringify('robinson-mcp-core/'+leaf)+';\n');
    // All assertions execute against the original Stripe modules/SQL and
    // HTTP/RTC routes; only four proven byte-identical import leaves change.
    cmd('npx',['--no-install','vitest','run','--config','vitest.config.js',
      ...originalUnit],root,180000);
    cmd('npm',['run','test:db','--',...originalSql],root,240000);
    return {hubCommit:candidateCommit,sha256,private:true,published:false,
      sourceServiceRepoModified:false,overlaidImports:leaves.length,
      unchangedStripeUnitSuites:originalUnit.length,
      originalSqlSuites:originalSql.length,releaseReady:false};
  }finally{
    for(const [file,data] of backups)writeFileSync(file,data);
    if(installedCreated)rmSync(installed,{recursive:true,force:true});
    rmSync(scratch,{recursive:true,force:true});
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(rehearse()));}
  catch(error){console.error('K-3 private adopter: '+error.message);process.exitCode=1;}
}
