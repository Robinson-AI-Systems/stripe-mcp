# CAP4-D5-CHECKOUT-READS — checkout, payment-link and portal reads verify in the connection's mode

Status: **SOURCE-IMPLEMENTED.** Family D-5 of CAP-4 (the fifth
CAP-4 family built, in the frozen Phase 1 sequence after D-3,
D-1, D-2 and D-4). Read paths only: no write handler's mode gate,
ceremony or verification moves — the checkout, payment-link and
portal writes (OWNER-OBEDIENCE-V2-CHECKOUT, PR #313) are
untouched, including the hosted-URL aim check the design card
names as a standing boundary — and the money wiring
(`src/core/write.js`, `src/money.js`, `src/db.js`) is
byte-untouched. Baseline: `main`
`408a2bd3529dac1b39b6a1fa0ee8d049b16c14ee` (PR #325, CAP-4 D-4).
Design record: the CAP-4 derivation and card set
(`card-checkout-reads.md`, `census.md`, `sequence.md`) in the
coordinator's design folder.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The census and the design card name 7 tools (`checkout_list_sessions`, `checkout_get_session`, `checkout_list_line_items`, `checkout_list_payment_links`, `checkout_get_payment_link`, `checkout_list_link_line_items`, `checkout_list_portal_configurations`) claiming 8 operations (sessions ×3, payment_links ×3, portal configurations ×2) | The registry's 7 family tools are `checkout_list`, `checkout_get`, `checkout_list_line_items`, `paylink_list`, `paylink_get`, `portal_list_configurations`, `portal_get_configuration` — sessions ×3, payment links ×2, portal configurations ×2 = **7 operations**. No payment-link line-items read exists anywhere in `src/` (`paymentLinks` is referenced only by `checkout.js` and `checkout-writes.js`, and no `paymentLinks.listLineItems` call exists); the card's trace also missed the second portal tool (`portal_get_configuration`) | **Naming and census drift, not a scope change** (the D-4 precedent): same 7 tools, one module (`src/tools/checkout.js`). This card uses the registry names throughout. The claimed eighth operation does not exist to convert; nothing is invented for it |
| One shared helper throws "TEST Stripe provider unavailable" (`checkout.js:86`) and all 7 reads route through it; converting its contract once is the build | Confirmed exactly: the module-local `guarded` refuses every non-TEST connection (and any missing service) with that text at line ~86, and every handler routes through it | Convert the helper to the shared seam (below); each projection then verifies per object |
| The shared helper is the family's only mode gate | **Unenumerated gate found:** the session-ID validator admitted only `cs_test_` IDs (`requiredId(..., 'cs_test')` in `checkout_get` and `checkout_list_line_items`), refusing every LIVE session ID before any provider call — the mode-shaped ID-pattern species. The design card's own drift table missed it | Converted in-family: the pattern becomes `cs_(test|live)_`, the exact pattern the V2 checkout writes already use in their schema (PR #313), and the returned object's livemode is verified by the projection. The malformed-ID refusal text changes once, from `Invalid cs_test id` to `Invalid checkout session id` — the one TEST-visible text change, named here. `plink`, `bpc` and `cus` IDs carry no mode and are unchanged |
| Session projections carry a `mode` field; per the design card it is the checkout session's own mode (payment/subscription), not the connection's | Confirmed: `checkoutSafe` projects `mode: v.mode`; no `livemode` hard-check existed in any read projection | Connection-mode verification is added on `livemode` only; the session-mode field passes through untouched and is never gated on (pinned by a test: a `mode:'subscription'` session reads fine on a LIVE connection) |
| The D-4 projections' verification semantics carry over unchanged | D-4 passed `{required:true}` because its projections had always required `livemode===false` strictly. These four projections carried **no** livemode check at all, and every baseline fixture (including the pre-existing `checkout.test.js` sample) has no `livemode` field | The shared helper's **default** semantics apply (a supplied mode verifies a present `livemode`; an absent one passes), because that is the only semantics under which the mode-supplied TEST acceptance set is byte-identical to baseline. Recorded here as this family's deliberate difference from D-4, driven by the same principle D-4 recorded: byte-identical TEST behavior decides |
| Removing the helper's pre-gate changes nothing else | The pre-gate was also the family's refusal for connections the seam cannot serve at all. After conversion those refusals come from the shared seam's LIVE-enablement path (`selectedAccountClient`) — the same outcome for the correct reason (the D-2/D-4 pattern). The pre-existing suite's LIVE-refusal assertion (`checkout_list` on a live connection) passes unchanged, now produced by the enablement path. One pre-existing fixture change rides along (D-1 precedent): `tests/unit/checkout.test.js`'s fake `retrieve` now returns a `livemode:true` object for a `cs_live_` ID, so its `cs_live_FORBIDDEN` refusal pin is exercised through mode verification — the converted refusal path — instead of the removed pattern gate; real Stripe objects carry `livemode`, so the fixture is strictly more realistic | Recorded; both pre-existing tests pass unchanged in assertion |
| The admin composites that import these handlers are unaffected | `admin-guided.js` and `admin-overview.js` import `portal_list_configurations` with their own contexts (mode `test`); the workflow brand readback uses `checkout_get`/line-item reads on TEST contexts | All such contexts are TEST, where behavior is byte-identical; both composites' suites pass unchanged in the full run |

## Build contract, as built

- `src/tools/checkout.js` — the module header and all seven tool
  descriptions no longer claim TEST. The local `guarded` resolves
  the client through the one shared mode-aware seam (`modeClient`
  in `account-mode.js`): TEST resolves exactly as the helper
  always did, including the historical `TEST Stripe provider
  unavailable` refusal when the service is missing (it is
  `modeClient`'s own TEST-path text); LIVE resolves only through
  the verified selected-account path; the connection mode is
  handed to each handler.
- All four projections (`checkoutSafe`, `itemSafe`, `paylinkSafe`,
  `portalSafe` — now exported, as the sibling projections are)
  take the connection mode as an optional second parameter: a
  supplied mode verifies the object's `livemode` via
  `assertAccountResourceMode` before the historical shape is
  read; no mode keeps the historical behavior exactly. A
  wrong-mode member of a list refuses the whole read. Wrong-mode
  refusal text is the shared `Stripe provider resource mode
  mismatch` (the D-2/D-3 idiom).
- Session IDs validate against `cs_(test|live)_[A-Za-z0-9_]{3,190}`
  (the V2 write-side pattern). `checkout_list_line_items` fetches
  the parent session first, verifies its mode with the same
  assertion, then lists and projects the items with the same
  verification — the design card's named parent-verification
  contract. The provider calls otherwise are baseline-identical
  (same arguments, same paging).
- Verification semantics: a returned object whose `livemode`
  disagrees with the connection mode refuses the whole read;
  wrong-mode is refused in **both** directions.
- Privacy posture unchanged: session projections still never
  carry `client_secret` (proven on LIVE fixtures with a sentinel),
  and no field is added, removed or renamed in either mode.
- **Budget:** the everyday catalog stood at 19,999 tokens against
  the 20,000 cap at this baseline. The seven dual-mode
  descriptions were fitted **inside this family only** (filler
  removed — `hosted`, `with paging` ×2, `Stripe`, one `reusable`,
  `customer feature`, `and permissions` — while both-mode naming
  and every behavior clause, including `without exposing
  secrets`, is retained); the catalog now reads **19,998**. The
  cap did not move and no other family's text was touched.
- No dispatcher, profile, registry or reachability change: the
  same 329 tools, the same profiles; reads that executed at
  baseline execute now, verified. No SQL, no schema, no Stripe
  operation added or removed. **Not done:** session creation and
  portal *session* creation (D-9's refused session-minting class;
  the native writes are V2's), the hosted-URL aim check (untouched
  on the write side), the admin modules' own mode posture (D-7).

## Named tests

New suite `tests/unit/cap4-d5-checkout-reads.test.js` — **18
tests, 14 fail at baseline `408a2bd3`, all 18 pass after**; the
full unit suite and `npm run check` are green on the final tree
(budget step included, 19,998 above). Database tests cannot run
locally on this machine (no PostgreSQL binaries); their proof is
exact-head CI's, as for every sibling family.

- LIVE happy paths (fail at baseline): verified LIVE sessions in
  list and get; the session-mode field projected untouched on a
  LIVE connection; LIVE line items with the parent fetched and
  verified first (provider-call order pinned); verified LIVE
  payment links in list and get; verified LIVE portal
  configurations in list and get.
- Wrong-mode refusals (fail at baseline): a TEST session on a
  LIVE connection refused at the projection (provider called
  first, both list and get); a LIVE session on a TEST connection
  in list and get; a wrong-mode line item refused even when the
  parent matches; wrong-mode payment links refused on both
  connection modes; wrong-mode portal configurations refused on
  both connection modes.
- Privacy (fails at baseline — the LIVE handler call itself
  threw): LIVE session reads never leak the `client_secret`
  sentinel.
- Projection contract (fails at baseline — the projections were
  not exported and carried no mode parameter): supplied mode
  verifies in both directions for all four projections; no-mode
  is historical — including that a no-mode caller still projects
  a LIVE object, this family's recorded difference from D-4.
- Malformed session ID (fails at baseline on the renamed text):
  refused before any provider call with `Invalid checkout
  session id`.
- **Baseline passes, accounted honestly (4):** the two
  byte-identical TEST output pins (session get + line items;
  paylink get + portal get) and the registry pin (exactly the
  seven family tools, all read-only) — proving TEST behavior and
  field sets did not move — and the wrong-mode-parent line-item
  refusal, whose outcome at baseline was produced by the
  cs_test-only ID pattern and after conversion is produced by
  the parent mode verification it names.

## CAP-5 obligation

Live proof for D-5 stands in the CAP-5 queue: one checkout
session read (list or get), one session line-item read, one
payment-link read and one portal-configuration read on the
owner's LIVE connection, each returning the owner's own LIVE
objects with the field sets above. Source completion does not
close it.
