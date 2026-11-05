import test from 'node:test';
import assert from 'node:assert/strict';
import { checksPass, checksFailed, decide, denverDay, run } from './promote-live.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const main = 'a'.repeat(40), live = 'b'.repeat(40);
const good = { id: 1, name: 'ci', head_sha: main, app: { slug: 'github-actions' },
  status: 'completed', conclusion: 'success' };
test('Actions repository identity matches the deployed policy', () => {
  const path = new URL('./unused-policy.json', import.meta.url);
  if (process.env.GITHUB_REPOSITORY && existsSync(path)) {
    const policy = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(policy.repository, process.env.GITHUB_REPOSITORY);
    assert.ok(policy.requiredChecks.includes('release-policy'));
  }
});
test('Denver calendar dates honor midnight and DST', () => {
  assert.equal(denverDay(new Date('2026-10-12T05:59:59Z')), '2026-10-11');
  assert.equal(denverDay(new Date('2026-10-12T06:00:00Z')), '2026-10-12');
  assert.equal(denverDay(new Date('2026-12-12T06:59:59Z')), '2026-12-11');
});
test('requires successful latest exact-head trusted checks', () => {
  assert.equal(checksPass([good], ['ci'], main), true);
  for (const change of [{ conclusion: 'failure' }, { conclusion: 'skipped' },
    { status: 'in_progress' }, { head_sha: live }, { app: { slug: 'other' } }])
    assert.equal(checksPass([{ ...good, ...change }], ['ci'], main), false);
  assert.equal(checksPass([], ['ci'], main), false);
  assert.equal(checksPass([good, { ...good, id: 2, conclusion: 'failure' }], ['ci'], main), false);
  assert.equal(checksPass([good], ['ci', 'missing'], main), false);
  assert.equal(checksFailed([{ ...good, conclusion: 'failure' }], ['ci'], main), true);
  assert.equal(checksFailed([{ ...good, status: 'in_progress', conclusion: null }], ['ci'], main), false);
  assert.equal(checksFailed([{ ...good, head_sha: live, conclusion: 'failure' }], ['ci'], main), false);
});
test('matrix shard check names satisfy a required check only when every shard is green', () => {
  const shard = (id, suffix, extra = {}) => ({ ...good, id, name: `unit ${suffix}`, ...extra });
  const shards = [shard(11, '(1)'), shard(12, '(2)'), shard(13, '(3)')];
  assert.equal(checksPass(shards, ['unit'], main), true);
  assert.equal(checksPass(shards.slice(0, 2), ['unit'], main), true,
    'posted-set semantics: the ci summary job in the required list proves every shard ran');
  assert.equal(checksPass([shard(11, '(1)'), shard(12, '(2)', { conclusion: 'failure' })], ['unit'], main), false);
  assert.equal(checksFailed([shard(11, '(1)'), shard(12, '(2)', { conclusion: 'failure' })], ['unit'], main), true);
  assert.equal(checksPass([shard(11, '(1)', { status: 'in_progress', conclusion: null })], ['unit'], main), false);
  assert.equal(checksFailed([shard(11, '(1)', { status: 'in_progress', conclusion: null })], ['unit'], main), false);
  // A newer green rerun of one shard supersedes its older failure.
  assert.equal(checksPass([shard(11, '(1)', { conclusion: 'failure' }), shard(21, '(1)')], ['unit'], main), true);
  // Shard names of a different job never count ('unit2 (1)' is not 'unit').
  assert.equal(checksPass([{ ...good, id: 31, name: 'unit2 (1)' }], ['unit'], main), false);
  // Plain names still work alongside shards for other required checks.
  assert.equal(checksPass([good, ...shards], ['ci', 'unit'], main), true);
});
test('one checked fast-forward daily; reruns and unchanged heads skip', () => {
  const state = { main, live, ancestor: true, green: true, alreadyToday: false };
  assert.equal(decide(state), 'promote');
  assert.equal(decide({ ...state, alreadyToday: true }), 'skip');
  assert.equal(decide({ ...state, live: main }), 'skip');
  assert.throws(() => decide({ ...state, ancestor: false }), /rewrite/);
  assert.throws(() => decide({ ...state, green: false }), /checks/);
  assert.throws(() => decide({ ...state, main: 'main' }), /identity/);
});
test('real atomic git promotion, read-back and second same-day update refusal', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-policy-'));
  const cwd = process.cwd(), fetchBefore = globalThis.fetch;
  const keys = ['GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_EVENT_NAME', 'GITHUB_TOKEN'];
  const before = keys.map(k => process.env[k]);
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('init', '--bare', join(dir, 'remote.git'));
    git('init', '-b', 'main');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Release test');
    git('remote', 'add', 'origin', join(dir, 'remote.git'));
    writeFileSync(join(dir, 'fixture.txt'), 'first');
    git('add', 'fixture.txt'); git('commit', '-m', 'first');
    git('push', 'origin', 'main', 'main:live');
    const original = git('rev-parse', 'HEAD');
    writeFileSync(join(dir, 'fixture.txt'), 'second');
    git('commit', '-am', 'second'); git('push', 'origin', 'main');
    const second = git('rev-parse', 'HEAD');
    writeFileSync(join(dir, 'fixture.txt'), 'concurrent agent');
    git('commit', '-am', 'concurrent main');
    const checked = git('rev-parse', 'HEAD');
    git('checkout', '--detach', original);
    Object.assign(process.env, { GITHUB_REPOSITORY: 'example/repo', GITHUB_REF: 'refs/heads/main',
      GITHUB_EVENT_NAME: 'schedule', GITHUB_TOKEN: 'fixture' });
    process.chdir(dir);
    const policy = { repository: 'example/repo', requiredChecks: ['ci'] };
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ total_count: 1,
      check_runs: [{ ...good, head_sha: second, conclusion: 'failure' }] }) });
    await assert.rejects(run(policy), /check failed/);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], original);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ total_count: 0, check_runs: [] }) });
    await assert.rejects(run(policy, { attempts: 2, pause: async () => {} }), /window exhausted/);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], original);
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) git('push', 'origin', checked + ':refs/heads/main');
      return { ok: true, json: async () => ({ total_count: 1, check_runs: [{ ...good,
        head_sha: calls === 1 ? second : checked,
        status: calls === 2 ? 'in_progress' : 'completed' }] }) };
    };
    await run(policy, { attempts: 3, pause: async () => {} });
    assert.equal(calls, 3);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], checked);
    assert.equal(git('ls-remote', 'origin', 'refs/tags/live-promotion/' + denverDay()).split(/\s+/)[0], checked);
    git('checkout', 'main');
    writeFileSync(join(dir, 'fixture.txt'), 'third');
    git('commit', '-am', 'third'); git('push', 'origin', 'main');
    await run({ repository: 'example/repo', requiredChecks: ['ci'] });
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], checked);
    process.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
    await assert.rejects(run({ repository: 'example/repo', requiredChecks: ['ci'] }), /Scheduled/);
  } finally {
    process.chdir(cwd); globalThis.fetch = fetchBefore;
    keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bounded schedule backups preserve the evening block, daily marker and owner recovery', () => {
  const workflow = readFileSync(new URL('../.github/workflows/promote-live.yml', import.meta.url), 'utf8');
  const crons = [...workflow.matchAll(/cron: '([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(crons, ['53 20 * * *', '9 21 * * *', '9 22 * * *', '29 2 * * *', '35 9 * * *']);
  assert.equal((workflow.match(/timezone: America\/Denver/g) || []).length, 4);
  assert.match(workflow, /recover_missed_daily:/);
  assert.match(workflow, /default: false/);
  assert.match(workflow, /github.actor == 'christcr2012'/);
  assert.match(workflow, /RECOVER_MISSED_DAILY:/);
  assert.match(workflow, /cancel-in-progress: false/);
});
test('recovery requires explicit owner, expected repository, main and elapsed midnight', async () => {
  const { authorizedReleaseInvocation } = await import('./promote-live.mjs');
  const env = { GITHUB_REPOSITORY: 'example/repo', GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_ACTOR: 'christcr2012', GITHUB_TRIGGERING_ACTOR: 'christcr2012',
    RECOVER_MISSED_DAILY: 'true', GITHUB_TOKEN: 'fixture' };
  const time = new Date('2026-10-14T11:00:00Z');
  assert.equal(authorizedReleaseInvocation(env, 'example/repo', time), true);
  for (const change of [{ GITHUB_TRIGGERING_ACTOR: 'other' }, { GITHUB_TRIGGERING_ACTOR: undefined }, { GITHUB_ACTOR: 'other' }, { RECOVER_MISSED_DAILY: 'false' },
    { RECOVER_MISSED_DAILY: undefined }, { GITHUB_REF: 'refs/heads/live' },
    { GITHUB_REPOSITORY: 'other/repo' }, { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_TOKEN: '' }])
    assert.equal(authorizedReleaseInvocation({ ...env, ...change }, 'example/repo', time), false);
  assert.equal(authorizedReleaseInvocation(env, 'example/repo', new Date('2026-10-14T06:00:00Z')), false);
  assert.equal(authorizedReleaseInvocation(env, 'example/repo', new Date('2026-12-14T07:00:00Z')), false);
  assert.equal(authorizedReleaseInvocation(env, 'example/repo', new Date('2026-12-14T07:01:00Z')), true);
  assert.equal(authorizedReleaseInvocation({ ...env, GITHUB_EVENT_NAME: 'schedule' }, 'example/repo', time), true);
});

test('unexpected schedules and unguarded dispatch fail hosting policy', async () => {
  const { releasePolicyViolations } = await import('./validate-hosting-release.mjs');
  const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const good = { vercel: read('vercel.json'), ci: read('.github/workflows/ci.yml'),
    targets: read('.github/workflows/pr-target.yml'), promote: read('.github/workflows/promote-live.yml') };
  assert.deepEqual(releasePolicyViolations(good), []);
  for (const promote of [
    good.promote.replace('9 21 * * *', '10 21 * * *'),
    good.promote.replace("    - cron: '35 9 * * *'\n", ''),
    good.promote.replace("    - cron: '35 9 * * *'", "    - timezone: America/Denver\n      cron: '37 0 * * *'\n    - cron: '35 9 * * *'"),
    good.promote.replace('timezone: America/Denver', 'timezone: UTC'),
    good.promote.replace('default: false', 'default: true'),
    good.promote.replace("github.actor == 'christcr2012'", "github.actor == 'other'"),
    good.promote.replace('inputs.recover_missed_daily == true', 'true'),
    good.promote.replace('  contents: write', '  contents: read'),
    good.promote + '\n  workflow_dispatch:\n'
  ]) assert.match(releasePolicyViolations({ ...good, promote }).join(' '), /Release workflow/);
});

test('successful no-change run records a receipt and suppresses later development', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-no-change-'));
  const cwd = process.cwd(), fetchBefore = globalThis.fetch;
  const tokenKey = 'GITHUB_TOKEN';
  const keys = ['GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_EVENT_NAME', tokenKey];
  const before = keys.map(k => process.env[k]);
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('init', '--bare', join(dir, 'remote.git'));
    git('init', '-b', 'main');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Release test');
    git('remote', 'add', 'origin', join(dir, 'remote.git'));
    writeFileSync(join(dir, 'fixture.txt'), 'initial');
    git('add', 'fixture.txt'); git('commit', '-m', 'initial');
    git('push', 'origin', 'main', 'main:live');
    const original = git('rev-parse', 'HEAD');
    Object.assign(process.env, { GITHUB_REPOSITORY: 'example/repo',
      GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'schedule', [tokenKey]: 'fixture' });
    process.chdir(dir);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ total_count: 1,
      check_runs: [{ ...good, head_sha: original }] }) });
    const policy = { repository: 'example/repo', requiredChecks: ['ci'] };
    await run(policy, { attempts: 1 });
    assert.equal(git('ls-remote', 'origin', 'refs/tags/live-promotion/' + denverDay()).split(/\s+/)[0], original);
    writeFileSync(join(dir, 'fixture.txt'), 'later development');
    git('commit', '-am', 'later'); git('push', 'origin', 'main');
    await run(policy, { attempts: 1 });
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], original);
  } finally {
    process.chdir(cwd); globalThis.fetch = fetchBefore;
    keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('owner-ordered release requires explicit owner and carries no time-of-day gate', async () => {
  const { authorizedReleaseInvocation, isOwnerReleaseInvocation, ownerReleaseMarker } =
    await import('./promote-live.mjs');
  const env = { GITHUB_REPOSITORY: 'example/repo', GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_ACTOR: 'christcr2012',
    GITHUB_TRIGGERING_ACTOR: 'christcr2012', OWNER_RELEASE: 'true', GITHUB_TOKEN: 'fixture' };
  // 2026-12-14T07:00:00Z is exactly Denver midnight: missed-daily recovery is
  // refused there by the elapsed-midnight rule, but the owner's own order is
  // not time-gated — his authority, not the clock, is the gate.
  const midnight = new Date('2026-12-14T07:00:00Z');
  assert.equal(isOwnerReleaseInvocation(env), true);
  assert.equal(authorizedReleaseInvocation(env, 'example/repo', midnight), true);
  assert.equal(authorizedReleaseInvocation({ ...env, OWNER_RELEASE: 'false' }, 'example/repo', midnight), false);
  for (const change of [{ GITHUB_ACTOR: 'other' }, { GITHUB_TRIGGERING_ACTOR: 'other' },
    { GITHUB_TRIGGERING_ACTOR: undefined }, { OWNER_RELEASE: undefined },
    { GITHUB_EVENT_NAME: 'schedule' }, { GITHUB_EVENT_NAME: 'push' }])
    assert.equal(isOwnerReleaseInvocation({ ...env, ...change }), false);
  for (const change of [{ GITHUB_REF: 'refs/heads/live' }, { GITHUB_REPOSITORY: 'other/repo' },
    { GITHUB_TOKEN: '' }, { GITHUB_ACTOR: 'other' }])
    assert.equal(authorizedReleaseInvocation({ ...env, ...change }, 'example/repo', midnight), false);
  const head = 'abcdef0123456789abcdef0123456789abcdef01';
  assert.equal(ownerReleaseMarker(head, new Date('2026-11-04T12:00:00Z')),
    'owner-release/2026-11-04-abcdef01');
});

test('owner release dispatch is owner-gated in the workflow beside recovery', () => {
  const workflow = readFileSync(new URL('../.github/workflows/promote-live.yml', import.meta.url), 'utf8');
  assert.match(workflow, /owner_release:/);
  assert.match(workflow, /inputs\.owner_release == true && github\.actor == 'christcr2012' && github\.triggering_actor == 'christcr2012'/);
  assert.match(workflow, /OWNER_RELEASE: \$\{\{ inputs\.owner_release \}\}/);
});

test('unguarded owner-release dispatch fails hosting policy', async () => {
  const { releasePolicyViolations } = await import('./validate-hosting-release.mjs');
  const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const good = { vercel: read('vercel.json'), ci: read('.github/workflows/ci.yml'),
    targets: read('.github/workflows/pr-target.yml'), promote: read('.github/workflows/promote-live.yml') };
  assert.deepEqual(releasePolicyViolations(good), []);
  for (const promote of [
    good.promote.replace('inputs.owner_release == true', 'true'),
    good.promote.replace("(github.event_name == 'workflow_dispatch' && inputs.owner_release == true && github.actor == 'christcr2012'",
      "(github.event_name == 'workflow_dispatch' && inputs.owner_release == true && github.actor == 'other'"),
    good.promote.replace('OWNER_RELEASE: ${{ inputs.owner_release }}', 'OWNER_RELEASE: true'),
    good.promote.replace("description: 'Owner-only checked release ordered by the owner'", "description: 'Release'")
  ]) assert.match(releasePolicyViolations({ ...good, promote }).join(' '), /Release workflow/);
});

test('owner-ordered release promotes past a consumed daily marker and receipts per head', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'owner-release-'));
  const cwd = process.cwd(), fetchBefore = globalThis.fetch;
  const keys = ['GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_EVENT_NAME', 'GITHUB_TOKEN',
    'GITHUB_ACTOR', 'GITHUB_TRIGGERING_ACTOR', 'OWNER_RELEASE', 'RECOVER_MISSED_DAILY'];
  const before = keys.map(k => process.env[k]);
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  const { ownerReleaseMarker } = await import('./promote-live.mjs');
  try {
    git('init', '--bare', join(dir, 'remote.git'));
    git('init', '-b', 'main');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Release test');
    git('remote', 'add', 'origin', join(dir, 'remote.git'));
    writeFileSync(join(dir, 'fixture.txt'), 'first');
    git('add', 'fixture.txt'); git('commit', '-m', 'first');
    git('push', 'origin', 'main', 'main:live');
    const original = git('rev-parse', 'HEAD');
    // The day's automatic promotion already happened: the daily marker is
    // consumed at the original head while main has since advanced.
    git('push', 'origin', 'main:refs/tags/live-promotion/' + denverDay());
    writeFileSync(join(dir, 'fixture.txt'), 'second');
    git('commit', '-am', 'second'); git('push', 'origin', 'main');
    const second = git('rev-parse', 'HEAD');
    process.chdir(dir);
    const policy = { repository: 'example/repo', requiredChecks: ['ci'] };
    const greenFor = sha => async () => ({ ok: true, json: async () => ({ total_count: 1,
      check_runs: [{ ...good, head_sha: sha }] }) });
    Object.assign(process.env, { GITHUB_REPOSITORY: 'example/repo', GITHUB_REF: 'refs/heads/main',
      GITHUB_EVENT_NAME: 'schedule', GITHUB_TOKEN: 'fixture' });
    globalThis.fetch = greenFor(second);
    // The automatic path stands down on the consumed marker: live stays put.
    await run(policy, { attempts: 1, pause: async () => {} });
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], original);
    // A non-owner dispatch carrying owner_release is refused closed.
    Object.assign(process.env, { GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_ACTOR: 'other', GITHUB_TRIGGERING_ACTOR: 'other', OWNER_RELEASE: 'true' });
    await assert.rejects(run(policy, { attempts: 1, pause: async () => {} }), /Scheduled/);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], original);
    // The owner's dispatch promotes the checked head past the consumed
    // marker and writes only its own per-head receipt.
    Object.assign(process.env, { GITHUB_ACTOR: 'christcr2012', GITHUB_TRIGGERING_ACTOR: 'christcr2012' });
    await run(policy, { attempts: 1, pause: async () => {} });
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], second);
    assert.equal(git('ls-remote', 'origin', 'refs/tags/' + ownerReleaseMarker(second)).split(/\s+/)[0], second);
    assert.equal(git('ls-remote', 'origin', 'refs/tags/live-promotion/' + denverDay()).split(/\s+/)[0], original);
    // Re-running the same owner release at the same head is a no-op.
    await run(policy, { attempts: 1, pause: async () => {} });
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], second);
    // A further owner-ordered head with a failing check is refused.
    writeFileSync(join(dir, 'fixture.txt'), 'third');
    git('commit', '-am', 'third'); git('push', 'origin', 'main');
    const third = git('rev-parse', 'HEAD');
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ total_count: 1,
      check_runs: [{ ...good, head_sha: third, conclusion: 'failure' }] }) });
    await assert.rejects(run(policy, { attempts: 1, pause: async () => {} }), /check failed/);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], second);
    // Pending checks exhaust the release window without moving live.
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ total_count: 1,
      check_runs: [{ ...good, head_sha: third, status: 'in_progress', conclusion: null }] }) });
    await assert.rejects(run(policy, { attempts: 2, pause: async () => {} }), /window exhausted/);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/live').split(/\s+/)[0], second);
    // A diverged live branch refuses even under an owner order, and no
    // receipt is written for the unreleased head.
    git('checkout', '-b', 'side', original);
    writeFileSync(join(dir, 'fixture.txt'), 'divergent');
    git('commit', '-am', 'divergent'); git('push', '--force', 'origin', 'HEAD:live');
    git('checkout', 'main');
    globalThis.fetch = greenFor(third);
    await assert.rejects(run(policy, { attempts: 1, pause: async () => {} }), /diverged/);
    assert.equal(git('ls-remote', 'origin', 'refs/tags/' + ownerReleaseMarker(third)), '');
  } finally {
    process.chdir(cwd); globalThis.fetch = fetchBefore;
    keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; });
    rmSync(dir, { recursive: true, force: true });
  }
});
