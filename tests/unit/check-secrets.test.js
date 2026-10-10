import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanFiles, scanText } from '../../scripts/check-secrets.mjs';

describe('secrets check', () => {
  it('rejects planted key-shaped secrets in files without showing their value', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stripe-mcp-secret-'));
    try {
      const path = join(dir, 'planted');
      writeFileSync(path, 'sk_' + 'test_' + 'A'.repeat(24));
      expect(scanFiles([path])[0]).toMatchObject({ path, types: ['Stripe key'] });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('allows explicitly fake test credentials', () => {
    expect(scanText('sk_test_FAKEfixture rk_test_FAKEfixture')).toEqual([]);
  });
  it('never exempts live-mode strings merely because they contain FAKE', () => {
    expect(scanText('sk_' + 'live_' + 'FAKE' + 'A'.repeat(24))).toEqual(['Stripe key']);
    expect(scanText('rk_' + 'live_' + 'FAKE' + 'A'.repeat(24))).toEqual(['Stripe key']);
  });
  it('flags non-local database credential URLs and webhook secrets', () => {
    const secret = 'whsec_' + 'A'.repeat(24);
    expect(scanText(secret + ' postgre' + 'sql://u:password@db.example.org/database')).toEqual(['webhook secret', 'database URL']);
  });
});
