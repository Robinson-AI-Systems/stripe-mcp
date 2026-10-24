import {describe,it,expect} from 'vitest';
import {buildUnifiedReconciliation} from '../../src/stripe/unified-capability.js';
import {operationEvidence,verifyOperationEvidence,evidenceForOperations}
  from '../../src/stripe/operation-evidence.js';
import {buildOperationEvidenceReport,validateOperationEvidenceReport}
  from '../../src/stripe/operation-evidence-report.js';

const sample={method:'POST',path:'/v1/refunds',apiVersion:'v1',
  officialOperationId:'PostRefunds',sourceStatus:'mapped-native-source-candidate',
  nativeTool:'payment_create_refund',summary:'Create a refund'};
const deepcopy=x=>structuredClone(x);
describe('CAP-1 complete source and explicit acceptance evidence schema',()=>{
  it('separates registered source candidate, unknown authority and sensitive effect',()=>{
    const a=operationEvidence(sample);
    expect(a.source).toMatchObject({
      disposition:'registered-native-handler-candidate',
      executableProviderCoverage:'unverified'});
    expect(a.effect.class).toBe('financial-or-irreversible-review-required');
    expect(a.effect.actualMoneyMoved).toBe('not-executed');
    expect(a.auth.requiredProviderScope).toBe('unknown');
    expect(a.auth.roleOrOrganizationMembership).toBe('unknown');
    expect(a.auth.productCountryEntitlement).toBe('unknown');
    expect(Object.values(a.auth.documentedCredentialKinds)
      .every(x=>x.disposition==='unknown')).toBe(true);
    expect(a.testEvidence.unit.disposition).toBe('not-linked');
    expect(a.independentDeployedAcceptance.deployedRevision).toBe(null);
    expect(verifyOperationEvidence(a,sample).providerAcceptance).toBe('unverified');
  });
  it('does not infer source execution from an official v2 path or GET',()=>{
    const v2=operationEvidence({method:'POST',path:'/v2/core/accounts',
      apiVersion:'v2',officialOperationId:'PostV2CoreAccounts',
      sourceStatus:'schema-only-v2-no-generic-dispatch'});
    expect(v2.source.disposition).toBe('not-implemented-by-this-evidence');
    expect(v2.effect.class).not.toBe('read');
    const read=operationEvidence({method:'GET',path:'/v2/core/accounts',
      apiVersion:'v2',officialOperationId:'GetV2CoreAccounts',
      sourceStatus:'schema-only-v2-no-generic-dispatch'});
    expect(read.effect.class).toBe('read');
    expect(read.source.executableProviderCoverage).toBe('unverified');
  });
  it('rejects fake provider PASS, test file, permission or source mapping',()=>{
    const a=operationEvidence(sample);
    for(const mutator of [
      x=>{x.auth.requiredProviderScope='admin';},
      x=>{x.testEvidence.provider.disposition='passed';},
      x=>{x.independentDeployedAcceptance.disposition='PASSED';},
      x=>{x.source.handlerRegistered=false;},
      x=>{x.effect.actualMoneyMoved='yes';}
    ]){
      const changed=deepcopy(a);mutator(changed);
      expect(()=>verifyOperationEvidence(changed,sample)).toThrow(/claim changed/);
    }
    expect(()=>operationEvidence({...sample,path:'/outside'})).toThrow();
    expect(()=>evidenceForOperations([sample,sample])).toThrow(/duplicate/);
  });
  it('enumerates every official v1/v2 row without provider success claims',()=>{
    const report=buildOperationEvidenceReport();
    expect(validateOperationEvidenceReport(report)).toMatchObject({
      gaOperations:644,v1:612,v2:32});
    expect(report.evidence).toHaveLength(644);
    expect(report.priorities).toHaveLength(644);
    expect(report.counts.providerScopeUnknown).toBe(644);
    expect(report.counts.deployedProviderUnverified).toBe(644);
    expect(report.families.reduce((n,x)=>n+x.operations,0)).toBe(644);
    expect(report.neverClaimed.percentage).toBe(null);
    expect(report.evidence.every(x=>x.auth.effectiveProviderPermission==='unverified'))
      .toBe(true);
  });
  it('reports deterministic gaps and rejects inflated source/real acceptance',()=>{
    const report=buildOperationEvidenceReport();
    const again=buildOperationEvidenceReport();
    expect(again).toEqual(report);
    const inflated=deepcopy(report);
    inflated.counts.providerScopeUnknown--;
    expect(()=>validateOperationEvidenceReport(inflated)).toThrow(/drift/);
    const fabricated=deepcopy(report);
    fabricated.evidence[0].testEvidence.mock.references=['made-up-file'];
    expect(()=>validateOperationEvidenceReport(fabricated)).toThrow(/drift/);
    const removed=deepcopy(report);
    removed.evidence.pop();
    expect(()=>validateOperationEvidenceReport(removed)).toThrow(/drift/);
  });
  it('reports genuine native lookup candidates only from source registry',()=>{
    const source=buildUnifiedReconciliation();
    const e=evidenceForOperations(source.operations);
    const candidate=e.filter(x=>x.source.disposition==='registered-native-handler-candidate');
    expect(candidate.length).toBeGreaterThan(0);
    expect(candidate.every(x=>x.source.handlerRegistered&&
      typeof x.source.claimedNativeTool==='string')).toBe(true);
    expect(e.filter(x=>x.providerVersion==='v2')
      .every(x=>x.source.disposition==='not-implemented-by-this-evidence')).toBe(true);
  });
});
