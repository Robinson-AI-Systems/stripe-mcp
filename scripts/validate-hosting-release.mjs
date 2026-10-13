// Exact, repository-owned checks that prevent deployment-policy drift in PR CI.
// Does not contact Vercel, Neon or Stripe or invoke a deployment.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function releasePolicyViolations({vercel,ci,targets,promote}){
  const errors=[];
  let cfg;
  try{cfg=JSON.parse(vercel);}catch{errors.push('vercel.json must be JSON');return errors;}
  const branches=cfg?.git?.deploymentEnabled;
  if(!branches||branches['**']!==false||branches.main!==false||branches.live!==true||
    Object.keys(branches).some(branch=>!['**','main','live'].includes(branch)))
    errors.push('Only the live branch may start Vercel Git builds');
  if(!/pull_request\s*:/.test(ci)||!/branches:\s*\[main\]/.test(ci)||
      !/contents:\s*read/.test(ci)||!/rtc-reference:/.test(ci)||
      !/db:/.test(ci)||!/mock:/.test(ci)||!/unit:/.test(ci))
    errors.push('The original checks and main CI policy must remain enabled');
  if(!/types:\s*\[opened, synchronize, reopened, edited\]/.test(targets)||
     !/^\s*target-main:\s*$/m.test(targets)||
     !/test "\$BASE_BRANCH" = main/.test(targets))
    errors.push('PR-target gate must reject non-main targets, including edits');
  const cron=promote.match(/^\s*- cron:\s*['"]([^'"]+)['"]/gm)??[];
  if(cron.length!==1||!/cron:\s*['"]1 0 \* \* \*['"]/.test(cron[0])||
     !/- cron:\s*['"]1 0 \* \* \*['"][^\n]*\n\s+timezone:\s*America\/Denver\s*\n/.test(promote)||
     /workflow_dispatch\s*:|workflow_call\s*:|\bpush\s*:/.test(promote)||
     !/contents:\s*write/.test(promote)||
     !/checks:\s*read/.test(promote)||
     !/run:\s*node scripts\/promote-live\.mjs/.test(promote))
    errors.push('Release workflow must remain scheduled-only and use checked promotion script');
  // Both release actions are immutable SHAs, not mutable marketplace tags.
  const actions=[...promote.matchAll(/^\s*- uses:\s*actions\/(checkout|setup-node)@([^\s#]+)/gm)];
  if(actions.length!==2||actions.some(([, ,ref])=>!/^[0-9a-f]{40}$/.test(ref)))
    errors.push('Release action dependencies must remain pinned to exact commits');
  return errors;
}

export function verifyRepositoryReleasePolicy(root=process.cwd()){
  const read=path=>readFileSync(root+'/'+path,'utf8');
  const failures=releasePolicyViolations({
    vercel:read('vercel.json'),ci:read('.github/workflows/ci.yml'),
    targets:read('.github/workflows/pr-target.yml'),
    promote:read('.github/workflows/promote-live.yml')
  });
  if(failures.length)throw Error('Release policy check failed: '+failures.join('; '));
  return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{verifyRepositoryReleasePolicy();console.log('Release policy: live-only, checked daily promotion');}
  catch(error){console.error(error.message);process.exitCode=1;}
}
