// Rehearse K-3 inside THIS source checkout; never add private core at runtime.
// CI-only, immutable Hub commit and independently recorded archive SHA256.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createProfileOverlay} from './k3-profile-overlay.mjs';
import {createMcpAuthOverlay} from './k3-mcp-auth-overlay.mjs';
import {createOAuthProtocolOverlay} from './k3-oauth-overlay.mjs';

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
  if(r.error||r.status!==0){
    // CI's nested original-service tests are captured to prevent raw tokens
    // leaking through ordinary stdout. On failure emit only test titles,
    // assertion type and source location, redacting credential-sized strings.
    const failures=(String(r.stdout||'')+'\n'+String(r.stderr||''))
      .replace(/\x1b\[[0-9;]*m/g,'').split('\n')
      .filter(line=>/FAIL |AssertionError|Test Files|Tests\s+\d|(?:❯|at )\s*tests\//.test(line))
      .slice(-24).map(line=>line.slice(0,280)
        .replace(/[A-Za-z0-9_-]{30,}/g,'[redacted]'));
    throw Error('K-3 CI-only verification command failed: '+
      bin.split('/').at(-1)+' ('+String(r.status)+')'+
      (failures.length?'\n'+failures.join('\n'):''));
  }
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
    // A real service-owned adapter, original Stripe SQL, two independent DB
    // connections and both directions of preexisting AAD interoperability.
    // Imported only after private archive identity/install proof.
    const oneTimeAdapterSql=JSON.parse(cmd('node',
      ['scripts/k3-private-secret-adapter.mjs'],root,60000));
    // Rewire only the generic profile methods against this exact installed
    // private archive; preserve and execute Stripe's own TEST/write/list policy.
    const profilesPath=join(root,'src/core/profiles.js');
    const profilesOriginal=readFileSync(profilesPath,'utf8');
    let profileAdapterProof;
    try{
      writeFileSync(profilesPath,createProfileOverlay(profilesOriginal));
      const profileUnit=[
        'tests/unit/profiles.test.js','tests/unit/server-tools.test.js',
        'tests/unit/rtc-http.test.js','tests/unit/rtc-batch-preflight.test.js',
        'tests/unit/registry.test.js','tests/unit/write-core.test.js'];
      const profileDb=[
        'tests/db/rtc-real-http.test.js','tests/db/rtc-dual-http.test.js',
        'tests/db/oauth-real-mcp-wire.test.js','tests/db/money-owner-approval.test.js',
        'tests/db/owner-money-limit.test.js'];
      cmd('npx',['--no-install','vitest','run','--config','vitest.config.js',
        ...profileUnit],root,180000);
      cmd('npm',['run','test:db','--',...profileDb],root,240000);
      profileAdapterProof={adaptedExport:'profiles',
        originalUnitSuites:profileUnit.length,originalSqlSuites:profileDb.length,
        ownerListingPolicyPreserved:true,rawCallerWriteGrantNeverSufficient:true,
        stripeSourceRestored:true,liveRuntimeChanged:false};
    }finally{writeFileSync(profilesPath,profilesOriginal);}
    // Portable bearer is deliberately adapted: Stripe retains local durable
    // token DB projection and RFC case-insensitive single-Authorization scheme.
    // All smoke and original HTTP suites execute with true portable core code
    // through the original source service entry point, then restore it.
    const bearerProof=JSON.parse(cmd('node',
      ['scripts/k3-private-bearer-evidence.mjs'],root,60000));
    if(bearerProof.originalSchemeParity!==4||
      bearerProof.duplicateAndGetterDenials!==3||
      bearerProof.foreignKindAndModeDenials!==3||
      bearerProof.storageOutageSanitized503!==true||
      bearerProof.activeGetterExecutions!==0)
      throw Error('K-3 portable bearer differential not proved');
    const bearerPath=join(root,'src/core/mcp-auth.js');
    const originalBearer=readFileSync(bearerPath,'utf8');
    let bearerServiceProof;
    try{
      writeFileSync(bearerPath,createMcpAuthOverlay(originalBearer));
      const bearerUnit=[
        'tests/unit/oauth-handlers.test.js','tests/unit/server-tools.test.js',
        'tests/unit/browser-cors.test.js','tests/unit/profiles.test.js'];
      const bearerDb=[
        'tests/db/oauth-auth-wire.test.js','tests/db/oauth-real-mcp-wire.test.js',
        'tests/db/oauth-persistent.test.js','tests/db/rtc-dual-http.test.js',
        'tests/db/money-owner-approval.test.js','tests/db/owner-money-limit.test.js'];
      cmd('npx',['--no-install','vitest','run','--config','vitest.config.js',
        ...bearerUnit],root,180000);
      cmd('npm',['run','test:db','--',...bearerDb],root,240000);
      bearerServiceProof={adaptedExport:'mcp-auth',originalUnitSuites:bearerUnit.length,
        originalSqlSuites:bearerDb.length,originalModuleRestored:true,
        sqlOwnsTokenRotationAndRevocation:true,moneyOwnerApprovalStillStripeOwned:true,
        sourceStandaloneStillDeployed:true};
    }finally{writeFileSync(bearerPath,originalBearer);}
    // The portable OAuth token protocol is adapted only within the original
    // service. Retain Stripe's registered-client defaults, owner login UI,
    // explicit TEST account selection and source-owned durable refresh logic.
    const oauthPath=join(root,'src/core/oauth-handlers.js');
    const originalOAuth=readFileSync(oauthPath,'utf8');
    const sidecar=join(root,'src/core/k3-oauth-original-private.js');
    let oauthProtocolProof;
    try {
      if(existsSync(sidecar))throw Error('Private source sidecar unexpectedly exists');
      writeFileSync(sidecar,originalOAuth,{flag:'wx'});
      writeFileSync(oauthPath,createOAuthProtocolOverlay(originalOAuth));
      const units=['tests/unit/oauth-handlers.test.js',
        'tests/unit/k3-oauth-protocol-seams.test.js'];
      const suites=['tests/db/oauth-real-mcp-wire.test.js',
        'tests/db/oauth-persistent.test.js','tests/db/oauth-auth-wire.test.js'];
      cmd('npx',['--no-install','vitest','run','--config','vitest.config.js',
        ...units],root,180000);
      cmd('npm',['run','test:db','--',...suites],root,240000);
      oauthProtocolProof={portableToken:true,sourceOwnerLogin:true,
        sourceClientRegistration:true,sourceSqlRefresh:true,
        originalUnitSuites:units.length,originalSqlSuites:suites.length,
        deployedDependency:false};
    } finally {
      writeFileSync(oauthPath,originalOAuth);
      rmSync(sidecar,{force:true});
    }
    if(oneTimeAdapterSql.schema!=='actual-stripe-one_time_secrets'||
      oneTimeAdapterSql.pools!==2||
      oneTimeAdapterSql.legacyIssuedPortableConsumed!==true||
      oneTimeAdapterSql.portableIssuedLegacyConsumed!==true||
      oneTimeAdapterSql.singleUseRace!==true||
      oneTimeAdapterSql.accountAndModeAadTamperRefused!==true||
      oneTimeAdapterSql.expiredRefused!==true||
      oneTimeAdapterSql.providerCalls!==0)
      throw Error('K-3 original SQL one-time adapter proof incomplete');
    return {oauthProtocolProof,bearerProof,bearerServiceProof,profileAdapterProof,oneTimeAdapterSql,hubCommit:candidateCommit,sha256,private:true,published:false,
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
