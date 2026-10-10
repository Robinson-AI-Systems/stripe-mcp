import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const stripePattern = /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{12,}\b/g;
const webhookPattern = /\bwhsec_[A-Za-z0-9]{12,}\b/g;
const ghPattern = /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/g;
const dbPattern = /postgres(?:ql)?:\/\/[^\s/@:]+:[^\s/@]+@([^/:\s]+)/gi;
export function scanText(text) {
  const found = [];
  for (const [kind, pattern] of [['Stripe key', stripePattern], ['webhook secret', webhookPattern], ['GitHub token', ghPattern]]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (kind === 'Stripe key' && match[0].includes('_FAKE')) continue;
      found.push(kind);
    }
  }
  dbPattern.lastIndex = 0;
  for (const match of text.matchAll(dbPattern)) {
    if (!['localhost', '127.0.0.1', 'example.test', 'example.com'].includes(match[1].toLowerCase())) found.push('database URL');
  }
  return [...new Set(found)];
}
export function scanFiles(paths) {
  const failures = [];
  for (const path of paths) {
    if (!fs.existsSync(path) || !fs.statSync(path).isFile()) continue;
    const bytes = fs.readFileSync(path);
    if (bytes.includes(0)) continue;
    const types = scanText(bytes.toString('utf8'));
    if (types.length) failures.push({ path, types });
  }
  return failures;
}
function main() {
  const paths = process.argv[2] === '--file'
    ? process.argv.slice(3)
    : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const failures = scanFiles(paths);
  if (failures.length) {
    for (const issue of failures) console.error(`Sensitive material detected in ${issue.path}: ${issue.types.join(', ')}`);
    process.exitCode = 1;
  } else console.log(`Secret scan passed (${paths.length} files)`);
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
