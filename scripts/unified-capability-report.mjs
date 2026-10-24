#!/usr/bin/env node
// Offline, pinned, fully public GA Stripe API metadata only. Zero provider I/O.
import {buildUnifiedReconciliation,validateUnifiedReconciliation}
  from '../src/stripe/unified-capability.js';
const flag=process.argv[2]??'--verify';
if(process.argv.length>3||!['--verify','--json','--gaps'].includes(flag)){
  console.error('Usage: node scripts/unified-capability-report.mjs [--verify|--gaps|--json]');
  process.exitCode=2;
}else{
  const report=buildUnifiedReconciliation();
  validateUnifiedReconciliation(report);
  if(flag==='--json')console.log(JSON.stringify(report,null,2));
  else if(flag==='--gaps')console.log(JSON.stringify({
    officialSource:report.officialSource,derivedBlobSha:report.derivedBlobSha,
    counts:report.counts,families:report.families,legacyOnly:report.legacyOnly,
    unmappedNativeTools:report.unmappedNativeTools,
    note:report.note
  },null,2));
  else console.log('Unified Stripe GA pinned source: '+
    report.counts.operationCount+' operations ('+report.counts.v1+
    ' v1, '+report.counts.v2+' v2), legacy-only '+
    report.counts.legacyWithoutPublished+
    '; unknown credentials and actual provider acceptance remain unverified.');
}
