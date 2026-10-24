#!/usr/bin/env node
// Offline CAP-1 inventory. Does not contact Stripe or infer deployed/provider acceptance.
import { buildCapabilityInventory, validateCapabilityInventory } from '../src/stripe/capability-inventory.js';
const args = process.argv.slice(2);
const valid = ['', '--verify', '--json', '--gaps'];
if (args.length > 1 || !valid.includes(args[0] ?? '')) {
  console.error('Usage: node scripts/capability-report.mjs [--verify|--json|--gaps]');
  process.exitCode = 2;
} else {
  const inventory = buildCapabilityInventory();
  const proof = validateCapabilityInventory(inventory);
  if (args[0] === '--json') console.log(JSON.stringify(inventory,null,2));
  else if (args[0] === '--gaps') console.log(JSON.stringify({
    source:inventory.source,limits:inventory.outsidePinnedSchema,
    families:inventory.families,
    unmappedRegisteredTools:inventory.registeredTools.filter(t=>
      t.mappedPinnedOperations.length===0)},null,2));
  else console.log('CAP-1 schema/registry consistent: '+proof.operationCount+
    ' pinned API operations in '+proof.familyCount+
    ' families; provider credentials and live acceptance NOT verified.');
}
