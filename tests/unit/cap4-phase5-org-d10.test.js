// CAP-4 Phase 5 — ORG stages 1–2 (track 2a) + D-10 decisions.
// This unit is research-and-records: it changes no source
// behavior. The pins below make the facts its dispositions
// rest on re-runnable rather than prose:
//
//   * organization context is outside the pinned schema:
//     OUTSIDE_PINNED_SCHEMA carries exactly one
//     organization_context entry, dispositioned
//     not-in-this-pinned-v1-inventory;
//   * the pinned catalog (559 operations) contains zero
//     organization paths, zero /v2/ paths, and zero
//     data-pipeline / warehouse-export paths — the census
//     zero for ORG and S-9 is structural;
//   * D-10's substrate: the pinned catalog's Sigma surface
//     is exactly the two scheduled-query-run GETs; the one
//     operation the census claims for D-10
//     (POST /v1/sigma/saved_queries/{id}) is published-only
//     and absent from the pinned catalog;
//   * the CAP-1 credential-evidence layer recognizes the
//     organization_secret credential kind and names its
//     required Stripe-Context + Stripe-Version header —
//     recognition in evidence, not an operable connection.
//
// Baseline accounting: every test in this suite passes at
// pristine baseline b08cbb913 by design. These are pins,
// named as pins; the unit's evidence is the memo and the
// records, not behavior change.
import {describe,it,expect} from 'vitest';
import {catalog} from '../../src/stripe/openapi-index.js';
import {OUTSIDE_PINNED_SCHEMA}
  from '../../src/stripe/capability-inventory.js';
import {CREDENTIAL_TYPES,CREDENTIAL_TYPE_SOURCES}
  from '../../src/stripe/credential-context.js';

const allOps=[...catalog().operations.values()];
const key=o=>o.method+' '+o.path;

describe('CAP-4 Phase 5 — organization context substrate pins',()=>{
  it('organization_context sits in OUTSIDE_PINNED_SCHEMA, outside the pinned v1 inventory',()=>{
    const rows=OUTSIDE_PINNED_SCHEMA.filter(
      r=>r.family==='organization_context');
    expect(rows).toHaveLength(1);
    expect(rows[0].disposition)
      .toBe('not-in-this-pinned-v1-inventory');
    expect(rows[0].note).toContain('Stripe-Context');
  });

  it('the pinned catalog holds no organization operation — the census zero is structural',()=>{
    expect(allOps).toHaveLength(559);
    expect(allOps.filter(o=>/organization/i.test(o.path)))
      .toHaveLength(0);
    expect(allOps.filter(o=>o.path.startsWith('/v2/')))
      .toHaveLength(0);
  });

  it('the credential-evidence layer recognizes organization_secret and its required header',()=>{
    expect(CREDENTIAL_TYPES).toContain('organization_secret');
    const src=CREDENTIAL_TYPE_SOURCES.organization_secret;
    expect(src.context).toBe('organization-account');
    expect(src.requiredHeader)
      .toBe('Stripe-Context + Stripe-Version');
    expect(src.verifiedPermission).toBe('unknown');
  });
});

describe('CAP-4 Phase 5 — D-10 substrate pins (Sigma S-8, Data Pipeline S-9)',()=>{
  it('the pinned Sigma surface is exactly the two scheduled-query-run GETs',()=>{
    expect(allOps.filter(o=>o.path.includes('sigma')).map(key)
      .sort()).toEqual([
      'GET /v1/sigma/scheduled_query_runs',
      'GET /v1/sigma/scheduled_query_runs/{scheduled_query_run}']);
  });

  it('the one D-10 census operation is published-only: absent from the pinned catalog',()=>{
    expect(allOps.map(key)).not.toContain(
      'POST /v1/sigma/saved_queries/{id}');
    expect(allOps.filter(o=>o.path.includes('saved_queries')))
      .toHaveLength(0);
  });

  it('the pinned catalog holds no Data Pipeline / bulk-export operation at all',()=>{
    expect(allOps.filter(o=>
      /data_pipeline|pipeline|warehouse/i.test(o.path)))
      .toHaveLength(0);
  });
});
