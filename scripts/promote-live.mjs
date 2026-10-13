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
export const denverDay = denverDate;

export function checksPass(runs, required, sha) {
  return required.every(name => {
    const run = runs.filter(r => r.name === name && r.app?.slug === 'github-actions' &&
      r.head_sha === sha).sort((a, b) => b.id - a.id)[0];
    return run?.status === 'completed' && run.conclusion === 'success';
  });
}

export function checksFailed(runs, required, sha) {
  return required.some(name => {
    const run = runs.filter(r => r.name === name && r.app?.slug === 'github-actions' &&
      r.head_sha === sha).sort((a, b) => b.id - a.id)[0];
    return run?.status === 'completed' && run.conclusion !== 'success';
  });
}

export function decide({ main, live, alreadyToday, ancestor, green }) {
  if (![main, live].every(s => /^[a-f0-9]{40}$/.test(s))) throw Error('Invalid commit identity');
  if (alreadyToday || main === live) return 'skip';
  if (!ancestor) throw Error('live has diverged; refusing to rewrite history');
  if (!green) throw Error('Main checks are missing, pending or failed');
  return 'promote';
}

export async function run(policy = { repository: 'Robinson-AI-Systems/stripe-mcp', requiredChecks: REQUIRED_CHECKS },
  { attempts = 20, pause = () => new Promise(resolve => setTimeout(resolve, 30000)) } = {}) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (process.env.GITHUB_EVENT_NAME !== 'schedule' || process.env.GITHUB_REF !== 'refs/heads/main' ||
      repo !== policy.repository || !process.env.GITHUB_TOKEN) throw Error('Scheduled owner main only');
  const deadline = Date.now() + 10 * 60 * 1000;
  const marker = 'live-promotion/' + denverDay();
  const tagged = () => git(['ls-remote', '--tags', 'origin', 'refs/tags/' + marker]) !== '';
  const remoteHead = ref => git(['ls-remote', 'origin', 'refs/heads/' + ref]).split(/\s+/)[0];
  for (let attempt = 0; attempt < attempts && Date.now() < deadline; attempt++) {
    if (attempt) await pause();
    if (tagged()) { console.log('Already promoted today'); return; }
    git(['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main',
      '+refs/heads/live:refs/remotes/origin/live']);
    const main = git(['rev-parse', 'origin/main']);
    const live = git(['rev-parse', 'origin/live']);
    if (tagged() || main === live) { console.log('No promotion needed today'); return; }
    let ancestor = false;
    try { git(['merge-base', '--is-ancestor', live, main]); ancestor = true; } catch { /* fail closed */ }
    const runs = [];
    // Paginate; never silently ignore checks after page one.
    for (let page = 1; page <= 20; page++) {
      const response = await fetch('https://api.github.com/repos/' + repo + '/commits/' + main +
        '/check-runs?filter=latest&per_page=100&page=' + page, {
        headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
          Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw Error('Cannot verify main checks');
      const payload = await response.json();
      if (!Array.isArray(payload.check_runs)) throw Error('Invalid check response');
      runs.push(...payload.check_runs);
      if (runs.length >= payload.total_count) break;
      if (page === 20 || !payload.check_runs.length) throw Error('Incomplete check inventory');
    }
    if (remoteHead('main') !== main || remoteHead('live') !== live) {
      console.log('Branches moved; refreshing release candidate'); continue;
    }
    if (checksFailed(runs, policy.requiredChecks, main)) throw Error('Required main check failed for ' + main);
    if (!checksPass(runs, policy.requiredChecks, main)) {
      console.log('Waiting for required checks on ' + main); continue;
    }
    const action = decide({ main, live, alreadyToday: tagged(), ancestor,
      green: checksPass(runs, policy.requiredChecks, main) });
    if (action !== 'promote') return;
    if (remoteHead('main') !== main || remoteHead('live') !== live || tagged())
      continue;
    // A rerun or racing job cannot advance live twice in a Denver calendar day.
    // Atomic push refuses both updates if the marker already exists or live diverges.
    git(['push', '--atomic', 'origin', main + ':refs/heads/live', main + ':refs/tags/' + marker]);
    if (remoteHead('live') !== main || !tagged()) throw Error('Promotion read-back failed');
    console.log('Promoted checked main to live for ' + denverDay());
    return;
  }
  throw Error('Release window exhausted; main kept moving or required checks stayed pending. live unchanged.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  run().catch(error=>{console.error(error.message);
    process.exitCode=1;});
}
