#!/usr/bin/env node
// Exact offline CAP-1 audit. No Stripe credentials, network or customer mutations.
import {buildOperationEvidenceReport,validateOperationEvidenceReport}
  from '../src/stripe/operation-evidence-report.js';

const mode=process.argv[2]??'--verify';
if(process.argv.length>3||!['--verify','--gaps','--json','--families'].includes(mode)){
  console.error('Usage: node scripts/operation-evidence-report.mjs [--verify|--gaps|--json|--families]');
  process.exitCode=2;
}else{
  const report=buildOperationEvidenceReport();
  const proof=validateOperationEvidenceReport(report);
  if(mode==='--json')console.log(JSON.stringify(report,null,2));
  else if(mode==='--families')console.log(JSON.stringify({
    officialSource:report.officialSource,counts:report.counts,
    families:report.families,outsidePublishedScope:report.outsidePublishedScope
  },null,2));
  else if(mode==='--gaps')console.log(JSON.stringify({
    officialSource:report.officialSource,counts:report.counts,
    first50PriorityGaps:report.priorities.slice(0,50),
    totalPriorities:report.priorities.length,
    limitations:report.outsidePublishedScope,interpretation:report.interpretation
  },null,2));
  else console.log('CAP-1 pinned source/evidence consistent: '+
    proof.gaOperations+' published GA operations, '+proof.families+
    ' families ('+proof.v1+' v1 / '+proof.v2+
    ' v2). Credentials/entitlements/remote provider passes NOT established.');
}
