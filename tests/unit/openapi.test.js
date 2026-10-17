import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {readFileSync} from 'node:fs';
import { loadPinnedOpenApi, searchOperations, PINNED_VERSION, SOURCE_GIT_BLOB, SOURCE_SHA256 } from '../../scripts/stripe-openapi.mjs';

describe('immutable pinned Stripe API operation catalog', () => {
  const source = loadPinnedOpenApi();
  it('packages all immutable OpenAPI source parts into Vercel serverless routes',()=>{
    const config=JSON.parse(readFileSync('vercel.json','utf8'));
    expect(config.functions?.['api/**/*.js']?.includeFiles)
      .toBe('vendor/stripe-openapi/**');
    expect(config.git.deploymentEnabled).toMatchObject({
      main:false,live:true});
  });
  it('reconstructs the exact published v2556 blob, with its pinned version', () => {
    expect(source.gitBlob).toBe(SOURCE_GIT_BLOB);
    expect(source.spec.info.version).toBe(PINNED_VERSION);
    expect(source.paths).toBe(398);
    expect(source.sha256).toBe(SOURCE_SHA256);
  });
  it('finds the refund and nested subscription operations', () => {
    const refund = searchOperations(source.spec,'create refund');
    expect(refund.some(r=>r.method==='POST' && r.path==='/v1/refunds')).toBe(true);
    const subscription = searchOperations(source.spec,'create subscription');
    expect(subscription.some(r=>r.method==='POST' && r.path==='/v1/subscriptions')).toBe(true);
    expect(searchOperations(source.spec,'')).toEqual([]);
  });
  it('never echoes unexpected secret-like search inputs or their newlines', () => {
    const supplied = 'private-sensitive-fixture-text\\nsecond-secret-line';
    const output = execFileSync(process.execPath, ['scripts/openapi-find.mjs', supplied],
      { encoding: 'utf8', maxBuffer: 128000 });
    expect(output.trim()).toBe('No matching operation.');
    expect(output).not.toContain('private-sensitive-fixture-text');
    expect(output).not.toContain('second-secret-line');
  });
  it('limits output to twenty matching operations and does not dump the spec', () => {
    const results = searchOperations(source.spec,'post',999);
    expect(results.length).toBeLessThanOrEqual(20);
    const output = execFileSync(process.execPath,['scripts/openapi-find.mjs','refund'],
      { encoding:'utf8',maxBuffer:128000 });
    expect(output.split('\n').filter(Boolean).length).toBeLessThanOrEqual(20);
    expect(output).toContain('/v1/refunds');
    expect(output.length).toBeLessThan(4000);
  });
});
