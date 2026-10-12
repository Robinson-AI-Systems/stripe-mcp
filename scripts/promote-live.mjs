// GitHub Actions' sole daily live promotion path.
// Atomic branch+daily-marker push: even a rerun cannot promote twice in one
// America/Denver calendar day. No force push, no Vercel credentials, no LIVE keys.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const REQUIRED_CHECKS=Object.freeze([
  'check','unit','db','mock','rtc-reference','ci'
]);

export function denverDate(instant=new Date()){
  const parts=Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
  const get=type=>parts.find(part=>part.type===type)?.value;
  return [get('year'),get('month'),get('day')].join('-');
}

export function validateMainChecks(payload){
  if(!payload||!Array.isArray(payload.check_runs)||
    !Number.isInteger(payload.total_count)||
    payload.total_count!==payload.check_runs.length||
    payload.total_count>100)return false;
  return REQUIRED_CHECKS.every(name=>{
    const matching=payload.check_runs.filter(run=>run.name===name);
    return matching.length===1&&matching[0].status==='completed'&&
      matching[0].conclusion==='success'&&
      matching[0].app?.slug==='github-actions';
  });
}

export function evaluatePromotion({main,live,ancestor,checksGood,alreadyToday}){
  if(!/^[a-f0-9]{40}$/.test(main)||!/^[a-f0-9]{40}$/.test(live))
    return {action:'refuse',reason:'Unverified commit identity'};
  if(main===live)return {action:'skip',reason:'Already at latest main'};
  if(alreadyToday)return {action:'skip',reason:'Already promoted today'};
  if(!ancestor)return {action:'refuse',reason:'live cannot fast-forward to main'};
  if(!checksGood)return {action:'refuse',reason:'Main CI is not fully green'};
  return {action:'promote',reason:'Checked fast-forward permitted'};
}

function git(args){
  return execFileSync('git',args,{encoding:'utf8',
    stdio:['ignore','pipe','pipe']}).trim();
}
function existsRemoteTag(name){
  return git(['ls-remote','--tags','origin','refs/tags/'+name]).length>0;
}
async function getChecks(repo,sha,token){
  const response=await fetch('https://api.github.com/repos/'+repo+
    '/commits/'+sha+'/check-runs?per_page=100',{
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'}});
  if(!response.ok)throw Error('Cannot verify GitHub checks');
  return response.json();
}
async function run(){
  if(process.env.GITHUB_EVENT_NAME!=='schedule'||
    process.env.GITHUB_REF!=='refs/heads/main'||
    process.env.GITHUB_REPOSITORY!=='Robinson-AI-Systems/stripe-mcp'||
    !process.env.GITHUB_TOKEN)
    throw Error('Only scheduled owner-repository main workflow may promote live');
  const repo=process.env.GITHUB_REPOSITORY;
  git(['fetch','--no-tags','origin',
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/heads/live:refs/remotes/origin/live']);
  const main=git(['rev-parse','refs/remotes/origin/main']);
  const live=git(['rev-parse','refs/remotes/origin/live']);
  const date=denverDate();
  const marker='live-promotion/'+date;
  const alreadyToday=existsRemoteTag(marker);
  let ancestor=false;
  try{git(['merge-base','--is-ancestor',live,main]);ancestor=true;}catch{/* not FF */}
  const checksGood=main===live?true:
    validateMainChecks(await getChecks(repo,main,process.env.GITHUB_TOKEN));
  const decision=evaluatePromotion({main,live,ancestor,checksGood,alreadyToday});
  console.log('Daily live gate: '+decision.action+' — '+decision.reason);
  if(decision.action==='refuse')throw Error(decision.reason);
  if(decision.action==='skip')return;
  // Reconfirm refs after the expensive CI query. Never promote stale or
  // diverged revisions, or trust a cached already-taken day marker.
  const mainNow=git(['ls-remote','origin','refs/heads/main']).split(/\\s+/)[0];
  const liveNow=git(['ls-remote','origin','refs/heads/live']).split(/\\s+/)[0];
  if(mainNow!==main||liveNow!==live||existsRemoteTag(marker))
    throw Error('Remote branch or promotion marker changed; retry next day');
  // GitHub supports atomic ref updates: if either branch or date tag cannot
  // advance, neither does. No fallback that drops the once/day guarantee.
  git(['push','--atomic','origin',
    main+':refs/heads/live',main+':refs/tags/'+marker]);
  console.log('Daily live promotion committed with Denver-day marker '+date);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  run().catch(()=>{console.error('Daily live promotion safely refused. Inspect CI and branch permissions.');
    process.exitCode=1;});
}
