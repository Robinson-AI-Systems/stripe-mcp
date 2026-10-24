import {describe,it,expect} from 'vitest';
import {loadUnifiedSource,validateUnifiedSource,UNIFIED_BLOB_SHA}
  from '../../src/stripe/unified-source.js';
import {buildUnifiedReconciliation,validateUnifiedReconciliation}
  from '../../src/stripe/unified-capability.js';
const deepcopy=x=>structuredClone(x);
describe('official GA source is pinned and v1/v2 gaps are honest',()=>{
  it('validates immutable release source, unique operations, v2 methods and stable output',()=>{
    const source=loadUnifiedSource();
    expect(UNIFIED_BLOB_SHA).toMatch(/^[a-f0-9]{40}$/);
    expect(validateUnifiedSource(source,{expectCount:644})).toEqual({
      operationCount:644,v1:612,v2:32});
    const r=buildUnifiedReconciliation({unified:source});
    expect(validateUnifiedReconciliation(r,{unified:source})).toEqual(r.counts);
    expect(r.operations).toHaveLength(644);
    expect(r.counts.v2).toBe(32);
    for(const op of r.operations.filter(o=>o.apiVersion==='v2')){
      expect(op.sourceStatus).toBe('schema-only-v2-no-generic-dispatch');
      expect(op.verifiedProviderExecution).toBe(false);
      expect(op.nativeTool).toBe(null);
    }
    expect(r.operations.every(o=>Object.values(o.credentials)
      .every(v=>v.disposition==='unknown'))).toBe(true);
  });
  it('rejects duplicate, orphan, unsorted and version-confused operations',()=>{
    const x=loadUnifiedSource();
    const dup=deepcopy(x);dup.operations[1]=deepcopy(dup.operations[0]);
    expect(()=>validateUnifiedSource(dup)).toThrow();
    const bad=deepcopy(x);bad.operations[0].apiVersion='v2';
    expect(()=>validateUnifiedSource(bad)).toThrow();
    const unsorted=deepcopy(x);unsorted.operations.reverse();
    expect(()=>validateUnifiedSource(unsorted)).toThrow();
    const missing=deepcopy(x);missing.operations.pop();
    expect(()=>validateUnifiedSource(missing,{expectCount:644})).toThrow();
    const falseId=deepcopy(x);falseId.operations[0].operationId='';
    expect(()=>validateUnifiedSource(falseId)).toThrow();
  });
  it('refuses invented official/provider evidence or tampered family counts',()=>{
    const source=loadUnifiedSource();
    const report=buildUnifiedReconciliation({unified:source});
    report.operations[0].permission='all';
    expect(()=>validateUnifiedReconciliation(report,{unified:source})).toThrow(/drift/);
  });
});
