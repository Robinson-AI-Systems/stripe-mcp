import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'vendor/stripe-openapi');
export const SOURCE_GIT_BLOB = '509de1b4510d2c03ad8755d06778c1deb5619c7f';
export const PINNED_VERSION = '2026-09-30.endive';

export function loadPinnedOpenApi() {
  const names = fs.readdirSync(DIR).filter(n => /^spec3\.sdk\.part\d{3}$/.test(n)).sort();
  if (names.length !== 23 || names.some((name,i)=> name !== 'spec3.sdk.part' + String(i).padStart(3,'0'))) {
    throw new Error('Pinned Stripe OpenAPI source is missing or reordered');
  }
  const contents = names.map(name => fs.readFileSync(path.join(DIR,name), 'utf8')).join('');
  const gitBlob = createHash('sha1').update('blob ' + Buffer.byteLength(contents,'utf8') + '\0')
    .update(contents).digest('hex');
  if (gitBlob !== SOURCE_GIT_BLOB) throw new Error('Pinned Stripe OpenAPI checksum mismatch');
  const spec = JSON.parse(contents);
  if (spec.info?.version !== PINNED_VERSION || Object.keys(spec.paths || {}).length < 300) {
    throw new Error('Stripe OpenAPI version or paths do not match the pinned release');
  }
  return { spec, sha256: createHash('sha256').update(contents).digest('hex'),
    paths: Object.keys(spec.paths).length, gitBlob };
}

export function searchOperations(spec, query, max = 20) {
  const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results = [];
  for (const [endpoint, entries] of Object.entries(spec.paths)) {
    for (const method of ['get','post','put','patch','delete']) {
      const value = entries[method];
      if (!value) continue;
      const summary = String(value.summary || '').replace(/\s+/g,' ').trim();
      const operationId = String(value.operationId || '');
      const key = [method, endpoint, summary, operationId].join(' ').toLowerCase();
      if (!terms.every(term => key.includes(term))) continue;
      results.push({ method: method.toUpperCase(), path: endpoint, summary, operationId });
    }
  }
  results.sort((a,b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return results.slice(0,Math.min(20,Math.max(1,max)));
}
