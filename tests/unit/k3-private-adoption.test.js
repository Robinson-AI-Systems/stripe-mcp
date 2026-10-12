import {describe,it,expect} from 'vitest';
import {assertDisposableDb,validateCandidate,candidateCommit,candidateName,
  candidateSha256,leaves,originalUnit,originalSql} from '../../scripts/k3-private-adoption-rehearsal.mjs';
describe('Stripe-owned immutable private package rehearsal guard',()=>{
  it('refuses any deployed, external or unaudited database',()=>{
    expect(()=>assertDisposableDb({CI:'false',
      TEST_DATABASE_URL:'postgresql://x@127.0.0.1:5432/postgres'})).toThrow();
    for(const url of [
      'postgresql://x@remote.example.test:5432/postgres',
      'postgresql://x@127.0.0.1:5432/production',
      'postgresql://x@127.0.0.1:6432/postgres',
      'postgresql://x@127.0.0.1:5432/postgres?sslmode=require'
    ])expect(()=>assertDisposableDb({CI:'true',TEST_DATABASE_URL:url})).toThrow();
    expect(assertDisposableDb({CI:'true',
      TEST_DATABASE_URL:'postgresql://postgres:local@127.0.0.1:5432/postgres'})).toBe(true);
  });
  it('rejects modified or unpublished artifact identity rather than installing it',()=>{
    const valid={commit:candidateCommit,name:candidateName,
      sha256:candidateSha256,bytes:15000,privateFlag:true};
    expect(validateCandidate(valid)).toBe(true);
    for(const patch of [{commit:'a'.repeat(40)},
      {name:'robinson-mcp-core-9.9.9.tgz'},{sha256:'0'.repeat(64)},
      {bytes:1000000},{privateFlag:false}])
      expect(()=>validateCandidate({...valid,...patch})).toThrow();
  });
  it('pins only proven original imports while retaining owner money/SQL suites',()=>{
    expect(leaves).toEqual(['oauth','crypto','registry','write-contract-check']);
    expect(originalUnit).toContain('tests/unit/oauth-handlers.test.js');
    expect(originalUnit).toContain('tests/unit/rtc-http.test.js');
    expect(originalSql).toContain('tests/db/money-owner-approval.test.js');
    expect(originalSql).toContain('tests/db/owner-money-limit.test.js');
    expect(originalSql).toContain('tests/db/rtc-dual-http.test.js');
  });
});
