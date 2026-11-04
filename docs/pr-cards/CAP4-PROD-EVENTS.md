# CAP4-PROD-EVENTS — event-area coverage completion (the v2 disposition, inherited and re-proven; the area sweep)

**Status: source-implemented** on branch
`ai/vivienne/cap4-prod-events` from baseline `main`
`3828b42c22ef0690cf259d7a370e92a18dfa31ad` (PR #341,
PROD-BILLING; the coordinator publishes). Unit
**PROD-EVENTS** of CAP-4 Phase 4 (the product-gap cards),
built per `card-product-events.md`. As with PROD-BILLING,
the honest outcome is a recorded disposition plus a
verified area sweep, not new tools: **no native tool is
built and no source file changes.** The unit's deliverables
are (1) the recorded disposition for all 10 claimed v2
rows, with the inheritance re-proven at this baseline;
(2) the standing build posture those rows will inherit if
they are ever built, recorded now so a future build does
not re-decide it silently; (3) the re-run area sweep
(7 pinned operations + the 10 claimed v2, zero
unclassified); and (4) a pin suite proving the facts the
dispositions rest on. Registry unchanged at 343 tools;
the everyday catalog stays 19,999 / 20,000 — also an
independent bar to any new everyday native tool in this
unit: one token of headroom admits no tool description,
and no other tool's text was touched to make room.

## The 10 claimed rows — disposition: unserved until a v2 dispatch surface is commissioned as its own unit

All 10 rows take the fleet's settled v2 answer, inherited
per the frozen card's own fork text ("the coordinator's
ruling on the Connect fork governs here unless this card's
PR names a reason it differs" — **no differing reason is
named, because none was found**) and ruling 3(iv):

| # | Operation | Disposition |
| --- | --- | --- |
| 1 | `GET /v2/core/events` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 2 | `GET /v2/core/events/{id}` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 3 | `GET /v2/core/event_destinations` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 4 | `GET /v2/core/event_destinations/{id}` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 5 | `POST /v2/core/event_destinations` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 6 | `POST /v2/core/event_destinations/{id}` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 7 | `DELETE /v2/core/event_destinations/{id}` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 8 | `POST /v2/core/event_destinations/{id}/disable` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 9 | `POST /v2/core/event_destinations/{id}/enable` | Unserved — dispositioned out until a v2 dispatch unit exists |
| 10 | `POST /v2/core/event_destinations/{id}/ping` | Unserved — dispositioned out until a v2 dispatch unit exists |

### Fresh evidence at this baseline, re-derived — not copied from PROD-BILLING

- **(i) The pinned-catalog check, re-run by PROD-BILLING's
  pin method at `3828b42c`.** Method: enumerate
  `catalog().operations` from
  `src/stripe/openapi-index.js` (the pinned catalog the
  universal door resolves every operation from) and
  inspect method + path for every record. Result at this
  baseline: **559 operations, zero of them `/v2/` paths —
  every pinned operation is a `/v1/` path**, and none of
  the 10 claimed method+path pairs is among them (script-
  derived at this baseline and test-pinned in this unit's
  suite). The 10 operations cannot even be named by the
  door. The result is identical in count to PROD-BILLING's
  baseline (559 / zero) because no catalog re-pin
  intervened; the numbers here were re-derived from the
  current tree, not carried over.
- **No dispatch seam exists outside the catalog either.**
  The only `rawRequest` caller in `src/` is the door
  itself (`src/tools/universal.js`), bound to catalog
  records, and the door's request builder
  (`checkedRequest` in `src/stripe/openapi-index.js`)
  accepts only paths matching `/^\/v1\//`. The only two
  `/v2/` strings in `src/` are a credential-context shape
  validator for published operations
  (`src/stripe/credential-context.js`) and a tenancy URL
  check (`src/tenancy/store.js`) — neither dispatches a
  provider call (re-verified at this baseline; the same
  two strings PROD-BILLING found).
- **(ii) The consumer search — the card's named reopening
  condition — finds no consumer.** Searched at this
  baseline for `event_destination`, `eventDestinations`,
  `EventDestination`, `core/events` and `core/event`,
  across `src/`, `tests/`, `scripts/`, `docs/` (designs,
  implementation guides, acceptance, audits, roadmap and
  master roadmap, the work index, all JIT cards) and
  `.github/workflows/`: **zero hits in the tree.** The 10
  rows exist only in census/classification records (the
  census appendix's PROD-EVENT bucket). The near-misses
  were examined and are not consumers of this surface:
  the native webhook family's "destination" is the v1
  webhook endpoint's URL (its origin is projected, its
  path never shown); `workflow_webhook_health` and the
  developer event tools consume v1 webhook endpoints and
  v1 events (`event_list_undelivered`), not v2 event
  destinations; no design, roadmap entry, work-index unit
  or workflow asks for the v2 destinations shapes, and
  no unit commissions a v2 dispatch surface. The
  reopening condition is therefore **not triggered**, and
  the disposition stands for all 10 rows — no row is
  flagged or built.
- **(iii) The inheritance is the program's standing
  answer, applied identically three times now.** Ruling
  3(iv): the v2 core operations are
  "covered-by-design-decision until a v2 dispatch unit
  exists; the product cards (billing/events/entitlements)
  inherit this answer for their v2 rows." The Connect
  slices applied it (the v2 close row: "unreachable
  entirely (no dispatch surface)… until a v2 dispatch
  unit exists"); PROD-BILLING took it as disposition (a)
  for the v2 billing meter events (PR #341, merged at
  this unit's baseline). This card inherits it verbatim
  for the event rows, so the three product surfaces
  cannot diverge.
- **Reopening condition, in the frozen card's own
  terms:** this disposition reopens the day **a v2
  dispatch surface is commissioned as its own unit (the
  v2 dispatch decision), or a consumer lands that needs
  event destinations specifically** — row 15's living
  duty, as with every disposition in this program.

## The standing build posture, recorded now for if the rows are ever built

The frozen card states the posture; recording it here, in
the repo's own record, prevents a future build from
re-deciding it silently:

- **Event destinations are webhook-class
  infrastructure.** A build follows the native webhook
  family's contracts: the full write contract (preview /
  effect / replay-key / before-state / audit / read-back /
  bounded results), and the signing-secret posture —
  **the secret is shown once via the one-time route and
  never journaled (census row 36's boundary)**. The
  native precedent is `webhook_create`
  (`src/tools/webhook-create.js`): Stripe returns the
  signing secret only on creation; the tool hands it to
  the owner-only one-time store, records "Never audit
  it" in the code, and returns `secretShownInTool:false`
  — the tool result itself never carries the value.
- **v2 event reads follow the D-4 idiom**
  (`CAP4-D4-DISPUTE-EVENT-READS`, `eventSafe` in
  `src/tools/events-read.js`): a minimal identity
  projection — event id, type, creation time, and the
  embedded data object's id and type only — with the
  object's `livemode` verified against the connection
  mode (`{required:true}`). **The event payload posture
  does not widen**: the embedded payload, the request
  object and the account field are never surfaced, in
  either mode.

Nothing here re-opens D-4's reads, the webhook family's
contracts, or D-9's classifications; the posture is a
record for a future unit, not a change to any of them.

## The area sweep (re-run at this baseline, final tree)

Method: every pinned-catalog operation under the two
sweep families (`/v1/events`, `/v1/webhook_endpoints`)
was re-classified from current-tree evidence — verified
native read tools govern their exact GET paths, D-9's
classification table governs POST/DELETE (its rows are
counted D-9; all three webhook rows are native-owns, so
the door refuses in the native family's favor), and the
claimed v2 rows are counted Out under the disposition
above. **17 operations examined (7 pinned v1 + the 10
claimed v2), zero unclassified.**

| Family | Ops | Native | Door | D-9 | Money (row 35) | Out |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v1 events | 2 | 2 | 0 | 0 | 0 | 0 |
| webhook_endpoints | 5 | 2 | 0 | 3 | 0 | 0 |
| v2 core events & event_destinations (claimed) | 10 | 0 | 0 | 0 | 0 | 10 |
| **Total** | **17** | **4** | **0** | **3** | **0** | **10** |

Per path, with the evidence each row rests on:

| Operation | Class | Evidence |
| --- | --- | --- |
| `GET /v1/events` | Native | D-4's `event_list` (`src/tools/events-read.js`); `event_list_undelivered` shares the same list path |
| `GET /v1/events/{id}` | Native | D-4's `event_get`; both reads mode-verified with the minimal identity projection (D-4 card) |
| `GET /v1/webhook_endpoints` | Native | `webhook_list` — the native webhook family is mode-aware (`webhooks-read.js`, `webhook-mode.js`); the projection publishes destination origin only, never the path or a secret |
| `GET /v1/webhook_endpoints/{webhook_endpoint}` | Native | `webhook_get`, same family and posture |
| `POST /v1/webhook_endpoints` | D-9 native-owns | D-9 table row (family `webhook`): "the native webhook family owns this surface (endpoint creation carries the signing-secret one-time rule)"; the native tool is `webhook_create` |
| `POST /v1/webhook_endpoints/{webhook_endpoint}` | D-9 native-owns | D-9 table row naming the redirect `webhook_add_events`; the native family also carries `webhook_remove_events` and `webhook_update` on this operation |
| `DELETE /v1/webhook_endpoints/{webhook_endpoint}` | D-9 native-owns | D-9 table row (family `webhook`); the native tool is `webhook_delete` |

The expected outcome holds, stated with evidence:
**fully native/door/classified** — in fact fully native
and D-9-classified, with no row needing the generic door:
the v1 event reads are D-4's, the webhook reads are
mode-aware native, and the webhook endpoint writes are
D-9 native-owns naming the native family. Two counting
notes, recorded not silently absorbed:

- The webhook GETs are counted Native because a verified
  native read governs each exact path (the PROD-BILLING
  precedent); the census appendix's own wording for these
  rows is "served by guarded universal read **and/or**
  mode-aware native reads" — both routes exist, the
  native route is the governed one.
- **The signing-secret posture rows are classified as
  the census has them**, not re-bucketed: there is no
  secret/Out row for webhook endpoints in the census.
  The endpoint writes sit in the appendix's D-9 bucket
  and the reads in its served bucket; the D-9 table's
  door-side `secret` field for the write rows is `none`
  precisely because the door never carries the value (it
  refuses), while the native create's secret lives under
  row 36's one-time boundary in the native family. The
  census's refused-secret rows are the `apps/secrets`
  operations — a different family, untouched here.

Reconciliation with the census appendix, per bucket: the
appendix's **D-4 bucket** names the 2 v1 event GETs —
both land Native here. Its **served bucket** names the 2
webhook GETs — both land Native here (above). Its
**D-9 bucket** names the 3 webhook POST/DELETE rows —
all land D-9 native-owns here. Its **PROD-EVENT bucket**
names exactly the 10 claimed v2 rows — all land Out
here. 2 + 2 + 3 + 10 = 17: the sweep and the appendix
agree row for row.

## Tests and baseline accounting

New suite `tests/unit/cap4-prod-events.test.js`
(10 tests) pins the facts the dispositions rest on:

- **The v2 pins (4):** the pinned catalog holds 559
  operations, every one a `/v1/` path, zero `/v2/`; none
  of the 10 claimed v2 paths is in it; none of the 10
  claimed method+path pairs is dispatchable; no native
  v2 event or event-destination tool is registered and
  the registry stands at 343 tools.
- **The sweep-set pins (2):** the pinned v1 events family
  is exactly the two GETs (`GetEvents`, `GetEventsId`)
  and the pinned webhook_endpoints family is exactly the
  five operations the sweep tabulates, operationIds
  included.
- **The disposition-credit pins (4):** the three webhook
  endpoint write rows in D-9's table are native-owns,
  family `webhook`, the update row redirecting to
  `webhook_add_events`; the native tools the sweep
  credits are registered (the five reads read-only, the
  five webhook writes present); `eventSafe` keeps the
  D-4 idiom on a LIVE fixture (source id/type projected,
  payload sentinel and amount absent, a wrong-mode object
  refused); `webhookSafe` is mode-aware on a LIVE fixture
  (destination origin only — the URL path sentinel and
  the signing-secret sentinel never projected — and the
  same object refused under the other mode).
- **Baseline accounting, stated plainly: all 10 pass at
  pristine baseline `3828b42c`, and all 10 are by-design
  pins.** This unit changes no behavior — the v2 surface
  was already undispatched and the sweep families were
  already native/classified — so there are no behavior
  failures to report; the suite's value is that the
  dispositions now rest on pinned, re-runnable facts
  rather than prose. Full unit suite green on the final
  tree (**217 files / 2,431 tests** — baseline 216 /
  2,421 plus this suite's file and its 10 pins) and
  `npm run check` green (registry 343 tools, everyday
  budget 19,999 / 20,000 unmoved).

## Drift check

- **The frozen card's cross-references reproduce at this
  baseline.** Webhook reads are already mode-aware
  (verified in `webhooks-read.js` / `webhook-mode.js`);
  webhook endpoints are NATIVE-OWNS in D-9 (the three
  table rows above, landed by PR #339 after the card was
  frozen); v1 event reads are D-4's (PR-converted,
  mode-verified, minimal projection). The card was
  baselined at `19766344`; Connect slices 1–3, D-9,
  PROD-PAYMENT and PROD-BILLING landed between that
  baseline and this build, and none of them touches the
  10 claimed rows — D-9 and PROD-BILLING in fact supply
  part of this card's evidence, exactly as the frozen
  card's inheritance fork anticipated.
- **No claimed row moved family.** The 10 rows were
  PROD-EVENT's alone in the appendix; the v1 rows the
  sweep touches were D-4's, the served bucket's and
  D-9's, and are re-derived, not re-claimed. The other
  Phase 4 cards' claims (payment, billing, Tax,
  entitlements) are untouched.

## CAP-5 obligation

Nothing was built, so no tool live-proof row is owed.
The dispositions carry one **disposition-verification
row**: on the deployed server at a checked release, the
v2 operations still cannot be named — no operation
exists to call through the door (the pinned catalog the
deployed server resolves from holds no `/v2/` operation)
and the tool list carries no v2 event or
event-destination tool — recorded here and in the
COMPLETION passage; the dispositioned rows also join the
conformance addendum through the conformance passage in
this PR.

## Untouched

Every source file: no tool, door, classifier, policy or
money-wiring change; D-4's merged reads and card (the
D-4 idiom is inherited by quotation here, not edited
there); the native webhook family's modules and
contracts; D-9's classification table (quoted, not
edited); PROD-BILLING's and the Connect slices' merged
cards (their v2 answers are inherited, not re-decided).
Local verification ran on the coordinator's VM (the
standing declared deviation for this program); no
database work in this unit.
