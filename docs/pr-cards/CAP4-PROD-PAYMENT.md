# CAP4-PROD-PAYMENT — payment-area coverage completion (verification and disposition, one door fix)

**Status: source-implemented** on branch
`ai/vivienne/cap4-prod-payment` from baseline `main`
`6b75f37f63f12f5e0ab6e73d7113aab450f3af63` (the coordinator
publishes). Unit **PROD-PAYMENT** of CAP-4 Phase 4 (the
product-gap cards), built per `card-product-payment.md`. The
card's expectation holds: the honest outcome for this area is
verification and disposition, not new tools — the payment
surface is the server's most-built area. **No native tool is
built.** Three of the four claimed operations are dispositioned
on door evidence; the fourth exposed a live door defect, fixed
surgically in this unit (below). Registry unchanged at 343
tools; the everyday catalog stays 19,999 / 20,000 — which is
also an independent bar to any new everyday native read in
this unit: one token of headroom admits no tool description,
and no other tool's text was touched to make room.

## The four claimed operations

### `GET /v1/payment_records` and `GET /v1/payment_records/{id}` — native coverage deliberately out; guarded universal read serves

The family closes as a unit with D-9 under one coherent
reason. D-9 refused all seven `payment_records` POSTs as
**refused-third-party** ("acts on a third party's data or
consent flow and no workflow in this server consumes it;
deliberately out until a consumer exists, when row 15's
living duty reopens it; additionally 0/7 read-back"). The
reads stand on the same ground:

- **Third-party subject.** The pinned `payment_record` object
  reports a payment processed by *another* processor:
  per-processor payment-method detail for ~50 method types
  (the card variant carries `fingerprint`, `iin` and a
  `network_token` object), `customer_details` and
  billing/shipping blocks carrying email, name, phone and
  address, and `processor_details`. A native safe-fields
  projection for this object is a large design surface.
- **No consumer.** A tree search finds no workflow in this
  server that reads a payment record; the only references
  are D-9's classification rows.
- **Precedent.** The census appendix already carries this
  exact disposition for the other third-party family:
  financial-connections GETs are "guarded universal read
  serves; native coverage deliberately out (third-party
  subject)" (appendix lines 457–462). Payment records take
  the same words.

Door behavior, probe- and test-proven: the by-id GET serves
on a matching-mode connection and refuses a mode-mismatched
record ("Provider response does not match authenticated
account mode"); the list serves. The door does not
mode-verify list *items* — the recorded door limitation the
financial-connections rows share, accepted here by the same
precedent rather than cured by a native build for a
consumer-less family.

### `GET /v1/mandates/{mandate}` — door-sufficiency

- **The pinned catalog holds exactly one mandate operation**
  — this GET. No list operation exists, so the door's
  per-object mode verification (the gap native list reads
  exist to close) is *complete* for this family: probe- and
  test-proven in both directions (LIVE object on a TEST
  connection refuses; TEST object on a LIVE connection
  refuses; matching modes serve in both modes).
- **The object is thin where it matters.** Ten top-level
  fields; the per-type details are references, not
  credentials (sepa_debit: `reference` + hosted `url`;
  us_bank_account: `collection_method` only). Bank numbers
  and IBANs live on the payment method, which has its own
  native and door coverage — not on the mandate.
- **No consumer** in this server reads a mandate (the only
  mandate code is the TEST-substrate creation path in the
  developer tools).
- Recorded breadth, not hidden: at `detail:'full'` the door
  passes the mandate's `customer_acceptance.online`
  (`ip_address`, `user_agent`) through, as it does for every
  durable first-party object; the default summary does not
  surface it and callers can narrow with `fields`. A native
  build is additionally unavailable in this unit on the
  budget fact above. Row 15's living duty reopens the
  question the day a workflow consumes mandate reads.

### `GET /v1/confirmation_tokens/{confirmation_token}` — no native read; the door's sensitive refusal made effective (the unit's one source change)

**No native read — argued from the pinned fields, as the
card required.** The `confirmation_token` object is a
pre-confirmation snapshot minted client-side by Stripe.js
and consumed once, by id, in a confirm call:

- `payment_method_preview` is a *full* payment-method shape:
  per-type details for ~65 method types (card: brand, exp
  month/year, `fingerprint`, last4) plus `billing_details`
  (name, email, phone, full address).
- `mandate_data.customer_acceptance.online` carries the
  customer's `ip_address` and `user_agent`;
  `shipping` carries name, phone and address.
- It is short-lived (`expires_at`), single-purpose, and
  **no workflow in this server re-reads one** (the only
  confirmation-token code in the tree is D-9's native-owns
  row for the TEST-helper creation POST). A safe native
  projection would reduce to id/expiry/link scaffolding
  around a payload that is payment detail and PII in every
  field group — the projection design itself proves "no
  native read" is the safer disposition.

**The door defect the enumeration proved.** The card offered
door-sufficiency as the alternative; the door's actual
behavior disqualifies it. `api_read`'s sensitive-family
screen names `tokens`, intending this class refused — but
its pattern is `\b(secret|ephemeral_keys|tokens|…)\b`, and
the underscore in `confirmation_tokens` is a word character,
so no word boundary precedes `tokens` and the screen never
fires for this family. Probe-proven at baseline:
`api_read` served the GET, and at `detail:'full'` returned
the complete preview above — fingerprint, billing
name/email/phone/address, acceptance IP and user agent —
under credential redaction only. An over-exposure already
on `main` is fixed in this PR per the repo rule, surgically:
`rejectSecret` names the family explicitly
(`record.path.startsWith('/v1/confirmation_tokens/')`)
alongside the unchanged pattern, with a comment recording
why. No other family's screen behavior changes (the pattern
is untouched; the TEST-helper creation path is a different
path and a D-9 native-owns row, unaffected). The refusal is
the screen's standing text; the card records that for this
family no specialized native reader exists by design — the
text names the route for the families that have one.
Verification rows for CAP-5 below.

## The area sweep (re-run at this baseline, final tree)

Method: every pinned-catalog operation in the eleven
families was re-classified from current-tree evidence — D-9
table rows govern POST/DELETE where a row exists (the row's
reason is what a caller receives; D-9's partition proves the
92 money-class operations have no rows), the row-35 money
classification covers the rest of POST/DELETE, verified
native read tools govern their exact GET paths, and the
amended sensitive screen governs the remainder. **69 pinned
operations, zero unclassified**, reconciling with the census
appendix family by family (the appendix's D-2 bucket names
13 GET *subjects*; per path, the charges-scoped refund alias
paths and the intent amount-details line-items path are
door-served — the native refund tools address the canonical
`/v1/refunds` paths — which is how the table below counts
them).

| Family | Ops | Native | Door | D-9 | Money (row 35) | Out |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| charges | 8 | 3 | 2 | 0 | 3 | 0 |
| payment_intents | 12 | 3 | 1 | 0 | 8 | 0 |
| refunds | 5 | 2 | 0 | 0 | 3 | 0 |
| setup_intents | 7 | 7 | 0 | 0 | 0 | 0 |
| payment_methods | 8 | 6 | 2 | 0 | 0 | 0 |
| sources | 11 | 7 | 4 | 0 | 0 | 0 |
| mandates | 1 | 0 | 1 | 0 | 0 | 0 |
| confirmation_tokens | 1 | 0 | 0 | 0 | 0 | 1 |
| payment_records | 9 | 0 | 2 | 7 | 0 | 0 |
| payment_attempt_records | 2 | 0 | 2 | 0 | 0 | 0 |
| three_d_secure | 5 | 0 | 2 | 3 | 0 | 0 |
| **Total** | **69** | **28** | **16** | **10** | **14** | **1** |

The two expected rows are proven, not presumed:
`payment_attempt_records` GETs are door-served (2/2), and
`three_d_secure` splits door (its 2 GETs) / D-9 (its 3
POSTs, refused-third-party) — no family unexamined.

## Tests and baseline accounting

New suite `tests/unit/cap4-prod-payment.test.js` (10 tests)
pins the three door-behavior dispositions through the real
`api_read` handler with a fake provider:

- **Behavior at baseline: 2 failures** — the
  confirmation-token refusal tests (TEST and LIVE) fail
  against pristine-baseline source (the door serves the
  read there, provider called) and pass with the screen
  fix, which refuses before any provider call
  (provider-call count asserted 0).
- **By-design passes at baseline: 8** — the registry pin
  (no native confirmation-token or payment-record tool
  exists), the four mandate door pins (serve TEST, serve
  LIVE, refuse wrong-mode both directions) and the three
  payment-record door pins (serve by id, refuse wrong-mode,
  serve list). These pin existing door behavior the
  dispositions rely on; they are named as by-design, not
  counted as new-behavior evidence.
- Neighboring door suites (`universal`,
  `cap4-d9-universal-door`, `cap4-connect-slice1-reads`)
  pass unedited: 62/62. Full unit suite and
  `npm run check` are green on the final tree (registry 343
  tools, everyday budget 19,999 / 20,000 unmoved).

## Drift check

- **Re-derivation at `6b75f37f` reconciles with the frozen
  card.** The card and the census appendix were measured at
  `19766344`; between that baseline and this build, Connect
  slices 1–3 and D-9 landed. None of them touches the four
  claimed operations: the appendix's PROD-PAY bucket still
  names exactly these four rows, and the sweep above
  re-derives every payment-family destination from the
  current tree (D-9's table, the row-35 money
  classification, the live registry) rather than copying
  the appendix. Family totals match the appendix's
  destinations; the one per-path refinement (charges-scoped
  refund alias paths and the intent line-items path are
  door-served, where the appendix names D-2 *subjects*) is
  recorded in the sweep section, not silently absorbed.
- **The one baseline fact that moved is this unit's own
  finding.** At the frozen baseline the confirmation-token
  GET was, in the census's terms, simply "no native read";
  its door treatment was unexamined because the screen's
  `tokens` alternative was assumed to refuse the family.
  The probe in this unit proved the assumption false at
  every baseline since the screen was written (the word
  boundary cannot fire after an underscore). The card's
  disposition records the corrected fact; no other family's
  screen behavior was re-derived or changed.
- **No claimed row moved family.** The 295 dispositioned-out
  rows and the other Phase 4 cards' claims are untouched;
  the payment-records closure is recorded here and in the
  conformance passage by reference to D-9's card, which is
  not edited, exactly as the frozen card instructed.

## CAP-5 obligation

Nothing was built, so no new live-proof row is owed for a
tool. The one behavior change carries a
**disposition-verification row**: on the deployed server at
a checked release, `api_read` refuses
`GetConfirmationTokensConfirmationToken` with the
sensitive-family text, and the mandate and payment-record
door reads answer on the owner's connection — recorded
here and in the COMPLETION passage; the dispositioned rows
also join the conformance addendum through the conformance
passage in this PR.

## Untouched

Every native tool and its behavior; the D-9 classification
table and policy; the money wiring (`src/tools/write.js`,
`src/money.js`, `src/db.js`); the door's write path
(`rejectSecret`'s read-side family list gains one explicit
prefix; the shared pattern and the write path's other gates
are byte-identical); D-9's merged card (the payment-records
family closure is recorded here and in the conformance
passage, by reference, as the card instructed). Local
verification ran on the coordinator's VM (the standing
declared deviation for this program); no database work in
this unit.
