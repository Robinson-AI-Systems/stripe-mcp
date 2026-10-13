import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {releasePolicyViolations,verifyRepositoryReleasePolicy}
  from '../../scripts/validate-hosting-release.mjs';
const read=p=>readFileSync(p,'utf8');
function inputs(){return {
  vercel:read('vercel.json'),
  ci:read('.github/workflows/ci.yml'),
  targets:read('.github/workflows/pr-target.yml'),
  promote:read('.github/workflows/promote-live.yml')
};}
describe('owner hosting cost / daily live policy',()=>{
  it('enforces real checked-in deployment configuration',()=>{
    expect(verifyRepositoryReleasePolicy()).toBe(true);
    expect(releasePolicyViolations(inputs())).toEqual([]);
  });
  it('rejects main, wildcard, and unrelated automatic Git deployments',()=>{
    for(const branches of [
      {'**':true,main:false,live:true},
      {'**':false,main:true,live:true},
      {'**':false,main:false,live:false},
      {'**':false,main:false,live:true,feature:true}
    ]){
      const x=inputs();const obj=JSON.parse(x.vercel);
      obj.git.deploymentEnabled=branches;x.vercel=JSON.stringify(obj);
      expect(releasePolicyViolations(x)).not.toEqual([]);
    }
  });
  it('rejects a renamed, retargeted or manually triggered release',()=>{
    const x=inputs();x.promote+='\nworkflow_dispatch:\n';
    expect(releasePolicyViolations(x)).not.toEqual([]);
    const y=inputs();y.targets=y.targets.replace('= main','= live');
    expect(releasePolicyViolations(y)).not.toEqual([]);
    const z=inputs();z.promote=z.promote.replace(/checkout@[0-9a-f]{40}/,'checkout@v4');
    expect(releasePolicyViolations(z)).not.toEqual([]);
  });
  it('rejects bypassing required historical CI coverage',()=>{
    const x=inputs();x.ci=x.ci.replace('rtc-reference:','deleted-reference:');
    expect(releasePolicyViolations(x)).not.toEqual([]);
    const y=inputs();y.targets=y.targets.replace('reopened, edited','reopened');
    expect(releasePolicyViolations(y)).not.toEqual([]);
  });
  it('requires one daily 00:01 Denver schedule rather than a fixed UTC offset',()=>{
    for(const change of [
      s=>s.replace('timezone: America/Denver','timezone: UTC'),
      s=>s.replace('      timezone: America/Denver\n',''),
      s=>s.replace('1 0 * * *','0 10 * * *'),
      s=>s.replace('      timezone: America/Denver','      timezone: America/Denver\n    - cron: \'1 0 * * *\'')
    ]){
      const x=inputs();x.promote=change(x.promote);
      expect(releasePolicyViolations(x)).not.toEqual([]);
    }
  });
});
