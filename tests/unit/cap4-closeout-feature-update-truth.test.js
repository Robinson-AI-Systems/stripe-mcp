// CAP-4 CLOSEOUT Part 3 — the feature-update door refusal tells
// the truth.
//
// PROD-ENTITLEMENTS observed, out of its own scope: POST
// /v1/entitlements/features/{id} is D-9 native-owns to the
// catalog family, but no native feature-UPDATE tool exists — the
// catalog family serves feature_create and
// feature_attach_to_product only. At this unit's baseline the
// door refused the update with the shared native-owns text
// ("the native catalog family owns this surface"), implying a
// native route a consumer would look for and not find — a
// truthfulness defect in a refusal, the consumer test's own
// FAIL class ("a refusal whose reason is wrong").
//
// The fix is text-only and row-only: the update row's reason now
// names the owning family and the absence plainly. The create
// row — where the claim is true — and every other refusal in
// the table stay byte-identical, pinned below.
//
// Baseline accounting: the two truthfulness tests fail at
// pristine baseline 0a4213cb (the update row carried the shared
// text); the byte-identity pins pass at baseline by design and
// are named as pins.
import {describe,it,expect} from 'vitest';
import {registry} from '../../src/tools/index.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {classificationFor}
  from '../../src/stripe/universal-classification.js';
import {getOperation} from '../../src/stripe/openapi-index.js';

const SHARED=`Native-owns: the native catalog family owns this surface (the catalog family's app-ownership guard (V3) governs this surface); the universal door keeps refusing so the native guards are not bypassed`;
const TRUTHFUL=`Native-owns: this surface belongs to the native catalog family (the catalog family's app-ownership guard (V3) governs the catalog surface), but no native feature-update tool exists — the catalog family serves feature create and feature attach, not feature update; the universal door keeps refusing so the native guards are not bypassed, and the absent native route is recorded here, not implied`;

const updateRow=()=>classificationFor(
  getOperation('PostEntitlementsFeaturesId'));
const createRow=()=>classificationFor(
  getOperation('PostEntitlementsFeatures'));

describe('CAP-4 closeout — feature-update refusal truthfulness',()=>{
  it('the native catalog surface has create and attach, and no feature-update tool',()=>{
    const names=registry.tools.map(t=>t.name);
    expect(names).toContain('feature_create');
    expect(names).toContain('feature_attach_to_product');
    expect(names.some(n=>/feature.*update|update.*feature/
      .test(n))).toBe(false);
  });
  it('the update row\u2019s reason names the family and the absence plainly',()=>{
    expect(updateRow().disposition).toBe('native-owns');
    expect(updateRow().reason).toBe(TRUTHFUL);
    expect(updateRow().reason).toContain('no native feature-update tool exists');
    expect(updateRow().reason).not.toBe(SHARED);
  });
  it('the door serves the truthful text for the update, before any provider call',async()=>{
    let calls=0;
    const db=createFakeDb({accounts:[{id:'acct_P3FAKE'}]});
    const ctx={connection:{mode:'test',profile:'full',
        stripeAccount:'acct_P3FAKE'},connectionId:'p3-fixture',db,
      services:{stripeForConnection:async()=>({
        rawRequest:async()=>{calls++;
          throw new Error('provider must not be called');}})}};
    const out=await registry.handlers.api_write({
      op:getOperation('PostEntitlementsFeaturesId').id,
      pathParams:{id:'feat_P3FAKE'},body:{name:'Renamed'}},ctx);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(TRUTHFUL);
    expect(calls).toBe(0);
  });
  // Pins (pass at baseline by design): nothing else moved.
  it('PIN: the feature-create row keeps the shared text byte-identically — its claim is true',()=>{
    expect(createRow().disposition).toBe('native-owns');
    expect(createRow().reason).toBe(SHARED);
  });
  it('PIN: the door serves the shared text for feature create, unchanged',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_P3FAKE'}]});
    const ctx={connection:{mode:'test',profile:'full',
        stripeAccount:'acct_P3FAKE'},connectionId:'p3-fixture',db,
      services:{stripeForConnection:async()=>({
        rawRequest:async()=>{
          throw new Error('provider must not be called');}})}};
    const out=await registry.handlers.api_write({
      op:getOperation('PostEntitlementsFeatures').id,
      body:{name:'F',lookup_key:'f'}},ctx);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(SHARED);
  });
});
