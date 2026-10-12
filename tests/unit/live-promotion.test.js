import {describe,it,expect} from 'vitest';
import {REQUIRED_CHECKS,denverDate,validateMainChecks,evaluatePromotion}
  from '../../scripts/promote-live.mjs';

const sha=character=>character.repeat(40);
const runs=()=>({total_count:6,check_runs:REQUIRED_CHECKS.map(name=>({
  name,status:'completed',conclusion:'success',app:{slug:'github-actions'}}))});

describe('daily live promotion security',()=>{
  it('uses America/Denver calendar days on both sides of DST',()=>{
    expect(denverDate(new Date('2026-03-08T06:30:00Z'))).toBe('2026-03-07');
    expect(denverDate(new Date('2026-03-08T08:30:00Z'))).toBe('2026-03-08');
    expect(denverDate(new Date('2026-11-01T05:30:00Z'))).toBe('2026-10-31');
    expect(denverDate(new Date('2026-11-01T08:30:00Z'))).toBe('2026-11-01');
  });
  it('requires all six exact GitHub Actions checks without duplicates or omissions',()=>{
    expect(validateMainChecks(runs())).toBe(true);
    for(const name of REQUIRED_CHECKS){
      const failing=runs();
      failing.check_runs.find(x=>x.name===name).conclusion='failure';
      expect(validateMainChecks(failing)).toBe(false);
    }
    const wrongApp=runs();wrongApp.check_runs[0].app.slug='unknown';
    expect(validateMainChecks(wrongApp)).toBe(false);
    const duplicate=runs();duplicate.check_runs.push({...duplicate.check_runs[0]});
    duplicate.total_count++;
    expect(validateMainChecks(duplicate)).toBe(false);
    const truncated=runs();truncated.total_count=7;
    expect(validateMainChecks(truncated)).toBe(false);
    expect(validateMainChecks(null)).toBe(false);
  });
  it('only allows a new checked fast-forward once on a Colorado date',()=>{
    const input={main:sha('a'),live:sha('b'),
      ancestor:true,checksGood:true,alreadyToday:false};
    expect(evaluatePromotion(input).action).toBe('promote');
    expect(evaluatePromotion({...input,alreadyToday:true}).action).toBe('skip');
    expect(evaluatePromotion({...input,main:input.live}).action).toBe('skip');
    expect(evaluatePromotion({...input,ancestor:false}).action).toBe('refuse');
    expect(evaluatePromotion({...input,checksGood:false}).action).toBe('refuse');
    expect(evaluatePromotion({...input,main:'not-a-commit'}).action).toBe('refuse');
  });
});
