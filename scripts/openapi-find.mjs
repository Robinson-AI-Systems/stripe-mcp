#!/usr/bin/env node
import { loadPinnedOpenApi, searchOperations, PINNED_VERSION } from './stripe-openapi.mjs';
const { spec, sha256, paths } = loadPinnedOpenApi();
if (process.argv[2] === '--verify') {
  console.log('Stripe OpenAPI ' + PINNED_VERSION + ', paths=' + paths + ', sha256=' + sha256);
} else {
  const terms = process.argv.slice(2).join(' ').trim();
  if (!terms) {
    console.error('Usage: node scripts/openapi-find.mjs "create refund"');
    process.exitCode = 2;
  } else {
    const results = searchOperations(spec, terms);
    for (const row of results) {
      console.log(row.method + ' ' + row.path + ' — ' + row.summary.slice(0,100) +
        (row.operationId ? ' (' + row.operationId.slice(0,55) + ')' : ''));
    }
    if (!results.length) console.log('No matching operation for: ' + terms);
  }
}
