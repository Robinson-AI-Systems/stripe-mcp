import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.env.BASE_SHA;
if (!base) {
  console.log('Docs check: no PR base provided; skipped diff-only rule.');
  process.exit(0);
}
if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Invalid BASE_SHA');
const changed = execFileSync('git', ['diff', '--name-only', base, 'HEAD', '--'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const has = (path) => changed.includes(path);
const code = changed.some((path) => /^(src|api|packages)\//.test(path));
const tools = changed.some((path) => path.startsWith('src/tools/'));
const event = process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)
  ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  : null;
const exception = /Docs-update: not needed — .{8,}/.test(event?.pull_request?.body || '');
const missing = [];
if (code && !exception) {
  if (!has('docs/STATUS.md')) missing.push('docs/STATUS.md');
  if (!changed.some((path) => /^docs\/pr-cards\/(?!README|validate-index)/.test(path))) missing.push('a PR card or work-index');
  if (tools && !has('docs/TOOL-CATALOG.md')) missing.push('docs/TOOL-CATALOG.md');
}
if (missing.length) {
  console.error(`Docs check failed: missing ${missing.join(', ')}`);
  process.exitCode = 1;
} else console.log('Docs reconciliation check passed');
