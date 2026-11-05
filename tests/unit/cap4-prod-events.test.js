// CAP-4 PROD-EVENTS — event-area coverage completion. The card's
// outcome is a recorded disposition for all 10 claimed v2 rows;
// this suite pins the facts that disposition rests on:
//
//   * The pinned catalog contains NO /v2 operation at all — the
//     universal door resolves operations from the pinned catalog,
//     so the 10 claimed v2 core event / event_destinations
//     operations cannot be dispatched by any existing surface
//     (disposition: unserved until a v2 dispatch surface is
//     commissioned as its own unit; ruling 3(iv), inherited from
//     PROD-BILLING's disposition (a)).
//   * The area sweep's credited behavior is real: the v1 event
//     reads are D-4's native mode-aware tools with the minimal
//     identity projection (the embedded payload never surfaces),
//     the webhook endpoint reads are the native mode-aware
//     family (signing secret and destination path never
//     projected), and the webhook endpoint writes are D-9
//     native-owns rows naming the native webhook family.
//   * No native tool exists for the v2 rows (the registry pin) —
//     the disposition record is the deliverable, per the card's
//     named-tests line for the disposition path.
//
// Every test in this suite passes at the unit's pristine
// baseline by design: this unit changes no behavior, so the
// pins are named as by-design pins, not new-behavior evidence.
import {describe,expect,it} from 'vitest';
import {catalog} from '../../src/stripe/openapi-index.js';
import {registry} from '../../src/tools/index.js';
import {UNIVERSAL_WRITE_TABLE} from '../../src/stripe/universal-classification.js';
import {eventSafe} from '../../src/tools/events-read.js';
import {webhookSafe} from '../../src/tools/webhooks-read.js';

const CLAIMED=[
  ['GET','/v2/core/events'],['GET','/v2/core/events/{id}'],
  ['GET','/v2/core/event_destinations'],
  ['GET','/v2/core/event_destinations/{id}'],
  ['POST','/v2/core/event_destinations'],
  ['POST','/v2/core/event_destinations/{id}'],
  ['DELETE','/v2/core/event_destinations/{id}'],
  ['POST','/v2/core/event_destinations/{id}/disable'],
  ['POST','/v2/core/event_destinations/{id}/enable'],
  ['POST','/v2/core/event_destinations/{id}/ping']];

describe('CAP-4 PROD-EVENTS — the v2 event surface has no dispatch surface',()=>{
  it('the pinned catalog contains no /v2 operation',()=>{
    const ops=[...catalog().operations.values()];
    expect(ops.length).toBe(559);
    expect(ops.every(o=>o.path.startsWith('/v1/'))).toBe(true);
    expect(ops.filter(o=>o.path.startsWith('/v2/'))).toEqual([]);
  });
  it('none of the 10 claimed v2 paths is in the pinned catalog',()=>{
    const paths=new Set([...catalog().operations.values()].map(o=>o.path));
    for(const [,p] of CLAIMED)expect(paths.has(p)).toBe(false);
  });
  it('none of the 10 claimed v2 method+path pairs is dispatchable',()=>{
    const pairs=new Set([...catalog().operations.values()]
      .map(o=>o.method+' '+o.path));
    for(const [m,p] of CLAIMED)expect(pairs.has(m+' '+p)).toBe(false);
  });
  it('registers no v2 event or event-destination tool; registry unchanged',()=>{
    const names=registry.tools.map(t=>t.name);
    expect(names.length).toBe(344);
    expect(names.some(n=>/destination|_v2|v2_/.test(n))).toBe(false);
  });
});

describe('CAP-4 PROD-EVENTS — area sweep: the pinned families, exactly',()=>{
  it('the v1 events family is exactly the two pinned GETs',()=>{
    const ops=[...catalog().operations.values()]
      .filter(o=>o.path.startsWith('/v1/events'))
      .map(o=>o.method+' '+o.path+' '+o.id).sort();
    expect(ops).toEqual(['GET /v1/events GetEvents',
      'GET /v1/events/{id} GetEventsId']);
  });
  it('the webhook_endpoints family is exactly the five pinned operations',()=>{
    const ops=[...catalog().operations.values()]
      .filter(o=>o.path.startsWith('/v1/webhook_endpoints'))
      .map(o=>o.method+' '+o.path+' '+o.id).sort();
    expect(ops).toEqual([
      'DELETE /v1/webhook_endpoints/{webhook_endpoint} DeleteWebhookEndpointsWebhookEndpoint',
      'GET /v1/webhook_endpoints GetWebhookEndpoints',
      'GET /v1/webhook_endpoints/{webhook_endpoint} GetWebhookEndpointsWebhookEndpoint',
      'POST /v1/webhook_endpoints PostWebhookEndpoints',
      'POST /v1/webhook_endpoints/{webhook_endpoint} PostWebhookEndpointsWebhookEndpoint']);
  });
});

describe('CAP-4 PROD-EVENTS — area sweep: dispositions the table credits',()=>{
  it('the three webhook endpoint writes are D-9 native-owns rows',()=>{
    const rows=UNIVERSAL_WRITE_TABLE
      .filter(r=>r.path.startsWith('/v1/webhook_endpoints'));
    expect(rows.length).toBe(3);
    expect(rows.every(r=>r.disposition==='native-owns'&&
      r.family==='webhook')).toBe(true);
    const update=rows.find(r=>r.method==='POST'&&
      r.path==='/v1/webhook_endpoints/{webhook_endpoint}');
    expect(update.nativeTool).toBe('webhook_add_events');
  });
  it('the native tools the sweep credits are registered, reads read-only',()=>{
    const byName=n=>registry.tools.find(t=>t.name===n);
    for(const n of ['event_list','event_get','event_list_undelivered',
      'webhook_list','webhook_get'])
      expect(byName(n)?.writes).toBe(false);
    for(const n of ['webhook_create','webhook_update','webhook_delete',
      'webhook_add_events','webhook_remove_events'])
      expect(byName(n)).toBeDefined();
  });
  it('eventSafe keeps the D-4 idiom: minimal identity projection, mode-checked',()=>{
    const fixture={id:'evt_PRODEVT1',object:'event',livemode:true,
      created:1760000000,type:'charge.succeeded',pending_webhooks:1,
      api_version:'2025-09-30.clover',
      data:{object:{id:'ch_PRODEVT1',object:'charge',
        receipt_email:'sentinel@example.com',amount:999999}}};
    const out=eventSafe(fixture,{detail:'full',mode:'live'});
    expect(out.objectId).toBe('ch_PRODEVT1');
    expect(out.objectType).toBe('charge');
    expect(JSON.stringify(out)).not.toContain('sentinel');
    expect(JSON.stringify(out)).not.toContain('999999');
    expect(()=>eventSafe({...fixture,livemode:false},{mode:'live'}))
      .toThrow();
  });
  it('webhookSafe is mode-aware and never projects secret or destination path',()=>{
    const fixture={id:'we_PRODEVT1',object:'webhook_endpoint',
      livemode:true,created:1760000000,status:'enabled',
      enabled_events:['charge.succeeded'],
      url:'https://example.com/hooks/PATHSENTINEL',
      secret:'SECRET-SENTINEL-VALUE',api_version:'2025-09-30.clover'};
    const out=webhookSafe(fixture,{detail:'full',mode:'live'});
    expect(out.destinationOrigin).toBe('https://example.com');
    expect(JSON.stringify(out)).not.toContain('SENTINEL');
    expect(()=>webhookSafe(fixture,{mode:'test'})).toThrow();
  });
});
