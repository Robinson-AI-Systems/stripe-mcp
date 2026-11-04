// GitHub Actions' sole live promotion path: the daily schedule and its
// recovery under the daily marker, plus owner-ordered releases under their
// own per-head receipts. Atomic branch+receipt push: even a rerun cannot
// promote twice over the same receipt. No force push, no Vercel credentials,
// no LIVE keys.
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

// The durable receipt of one owner-ordered release: the Denver day plus the
// released head, so every owner release is recorded individually and a rerun
// at the same head is recognizable without touching the daily marker.
export function ownerReleaseMarker(main, instant = new Date()) {
  return 'owner-release/' + denverDate(instant) + '-' + main.slice(0, 8);
}

export function denverMinute(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  return Number(parts.find(p => p.type === 'hour')?.value) * 60 +
    Number(parts.find(p => p.type === 'minute')?.value);
}

// An owner-ordered release: the owner directs an additional checked release
// beyond the one automatic daily promotion. His authority is the gate — the
// actor and the triggering actor must both be the owner and the dispatch
// must carry owner_release. No time-of-day condition applies: the
// elapsed-midnight rule belongs to missed-daily recovery semantics, not to
// the owner's own order (owner ruling, 2026-11-04: the daily cap binds
// automatic releases only; the machinery encodes his permission scheme,
// never its own cap on owner-ordered releases).
export function isOwnerReleaseInvocation(env) {
  return env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_ACTOR === 'christcr2012' && env.GITHUB_TRIGGERING_ACTOR === 'christcr2012' &&
    env.OWNER_RELEASE === 'true';
}

export function authorizedReleaseInvocation(env, repository, now = new Date()) {
  if (env.GITHUB_REPOSITORY !== repository ||
    env.GITHUB_REF !== 'refs/heads/main' || !env.GITHUB_TOKEN) return false;
  if (env.GITHUB_EVENT_NAME === 'schedule') return true;
  if (isOwnerReleaseInvocation(env)) return true;
  // No default dispatch or automated production override; GitHub owner only.
  return env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_ACTOR === 'christcr2012' && env.GITHUB_TRIGGERING_ACTOR === 'christcr2012' &&
    env.RECOVER_MISSED_DAILY === 'true' && denverMinute(now) >= 1;
}

// A required check may be posted under its plain job name ('unit') or, when
// the job runs as a matrix (CI-SPEED, PR #309: unit x3 shards, db x2), under
// shard names ('unit (1)', 'unit (2)', ...). Group the trusted exact-head
// runs by their posted name and judge each posted name by its latest run.
// Pass requires at least one posted name and every posted name's latest run
// green; the 'ci' summary job in the required list only goes green when
// every shard completed, so a not-yet-posted shard cannot slip through.
function latestPerPostedName(runs, name, sha) {
  const latest = new Map();
  for (const run of runs) {
    if (run.app?.slug !== 'github-actions' || run.head_sha !== sha) continue;
    if (run.name !== name && !(typeof run.name === 'string' &&
        run.name.startsWith(name + ' (') && run.name.endsWith(')'))) continue;
    const prior = latest.get(run.name);
    if (!prior || run.id > prior.id) latest.set(run.name, run);
  }
  return [...latest.values()];
}

export function checksPass(runs, required, sha) {
  return required.every(name => {
    const posted = latestPerPostedName(runs, name, sha);
    return posted.length > 0 &&
      posted.every(run => run.status === 'completed' && run.conclusion === 'success');
  });
}

export function checksFailed(runs, required, sha) {
  return required.some(name =>
    latestPerPostedName(runs, name, sha).some(run =>
      run.status === 'completed' && run.conclusion !== 'success'));
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
  if (!authorizedReleaseInvocation(process.env, policy.repository))
    throw Error('Scheduled or explicitly owner-recovered main only');
  const owner = isOwnerReleaseInvocation(process.env);
  const deadline = Date.now() + 10 * 60 * 1000;
  const marker = 'live-promotion/' + denverDay();
  const tagged = () => git(['ls-remote', '--tags', 'origin', 'refs/tags/' + marker]) !== '';
  const ownerTagged = main => git(['ls-remote', '--tags', 'origin',
    'refs/tags/' + ownerReleaseMarker(main)]) !== '';
  const remoteHead = ref => git(['ls-remote', 'origin', 'refs/heads/' + ref]).split(/\s+/)[0];
  for (let attempt = 0; attempt < attempts && Date.now() < deadline; attempt++) {
    if (attempt) await pause();
    // The daily marker stands down only the automatic and recovery paths.
    // An owner-ordered release carries its own per-head receipt, which
    // cannot be checked until main has been read below.
    if (!owner && tagged()) { console.log('Already promoted today'); return; }
    git(['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main',
      '+refs/heads/live:refs/remotes/origin/live']);
    const main = git(['rev-parse', 'origin/main']);
    const live = git(['rev-parse', 'origin/live']);
    if (!owner && tagged()) { console.log('Already processed today'); return; }
    if (owner && ownerTagged(main)) {
      console.log('Owner release already recorded for ' + main); return;
    }
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
    // A successful no-op at the primary time also consumes this Denver day's
    // release opportunity. Otherwise a fallback could deploy a later merge
    // even though the primary schedule succeeded with no changes.
    if (main === live) {
      if (owner) {
        // The ordered head is already live (for example the daily promotion
        // carried it first). Record the owner release's own receipt; the
        // owner path never writes the daily marker and never moves live here.
        if (remoteHead('main') !== main || remoteHead('live') !== live) continue;
        try {
          git(['push', 'origin', main + ':refs/tags/' + ownerReleaseMarker(main)]);
        } catch (error) {
          if (!ownerTagged(main)) throw error; // Ref conflict is safe only if another run won.
        }
        if (!ownerTagged(main)) throw Error('Owner release receipt read-back failed');
        console.log('Recorded owner release of already-live ' + main);
        return;
      }
      if (tagged()) return;
      if (remoteHead('main') !== main || remoteHead('live') !== live) continue;
      try {
        git(['push', 'origin', main + ':refs/tags/' + marker]);
      } catch (error) {
        if (!tagged()) throw error; // Ref conflict is safe only if another run won.
      }
      if (!tagged()) throw Error('No-op daily receipt read-back failed');
      console.log('Recorded checked no-op for ' + denverDay());
      return;
    }
    const action = decide({ main, live, alreadyToday: owner ? false : tagged(), ancestor,
      green: checksPass(runs, policy.requiredChecks, main) });
    if (action !== 'promote') return;
    if (remoteHead('main') !== main || remoteHead('live') !== live ||
      (owner ? ownerTagged(main) : tagged()))
      continue;
    // A rerun or racing job cannot advance live twice over the same receipt.
    // Atomic push refuses both updates if the receipt already exists or live diverges.
    git(['push', '--atomic', 'origin', main + ':refs/heads/live',
      main + ':refs/tags/' + (owner ? ownerReleaseMarker(main) : marker)]);
    if (remoteHead('live') !== main || (owner ? !ownerTagged(main) : !tagged()))
      throw Error('Promotion read-back failed');
    console.log(owner ? 'Promoted checked main to live under an owner-ordered release for ' + denverDay()
      : 'Promoted checked main to live for ' + denverDay());
    return;
  }
  throw Error('Release window exhausted; main kept moving or required checks stayed pending. live unchanged.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  run().catch(error=>{console.error(error.message);
    process.exitCode=1;});
}
