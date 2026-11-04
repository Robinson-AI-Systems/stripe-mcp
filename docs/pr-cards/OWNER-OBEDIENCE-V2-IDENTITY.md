# OWNER-OBEDIENCE V2 — IDENTITY (family 8)

Status: **SOURCE-IMPLEMENTED 2026-11-04; live proof remains open in the CAP-5
queue.** This card converts the Identity write family from TEST-only to the
connection's mode under conversion V2 (conformance row 17, convertible veto:
LIVE write allowlists / TEST-only handlers). It completes no predefined batch
subsection in `docs/pr-cards/README.md` — the README keeps its existing V2 row
until the coordinator's closeout, as with the Money, Disputes, Payments,
Invoices, Billing, Checkout and Radar cards.

## Scope

Three tools in the `identity` area:

- `identity_create_session` (`src/tools/identity-sessions.js`);
- `identity_cancel_session` and `identity_redact_session`
  (`src/tools/identity-lifecycle.js`) — two **independent** operations with
  separate confirmations; the conversion keeps them independent and does not
  merge their flows.

These tools create a hosted identity-verification session for a real person,
cancel a pending one, and irreversibly redact (destroy) a session's collected
data. No money moves through this family — the money wiring
(`src/tools/write.js`, `src/money.js`, `src/db.js`) is untouched. The Identity
*read* tools (`identity_list_sessions`, `identity_get_session`) are **not**
converted here: their LIVE reachability is the conformance record's
unclassified item (1), owned by CAP-4's gap derivation. They stay TEST-only,
byte-identical.

## Baseline and drift check

Design baseline: current `main` after PRs #303–#313 (V1, the V2 shared
machinery, V4, Money, Disputes, CI speed, Payments, Invoices, Billing,
Checkout); the branch was rebased onto PR #314 (Radar, family 7) before
landing, as the coordinator's brief requires when main moves during a
build, with the shared-doc interleaves resolved by keeping both families'
records. The design card (`card-identity.md`, written against `94813299`)
and the census (family 8) were checked against that baseline before editing.
Material drift found and resolved:

| Design-card assumption | Baseline truth | Resolution |
| --- | --- | --- |
| Dispatcher admission may be needed for the family | The `identity` area is already in `guardedLiveAreas` (and `guardedTestAreas`) in `src/core/profiles.js` | No dispatcher or `profiles.js` change |
| Removing the three handler gates and parameterizing the lifecycle modules' `livemode===false` invariants is sufficient | A fourth, hidden TEST gate sits in the shared safe projection: `identitySafe()` in `identity-sessions.js` required `livemode === false`, and it backs the create read-back verification and both lifecycle preflights/verifications — a LIVE session could never verify even with the handler gates removed | The projection takes an optional `mode` argument (the Billing `discountSafe(v, mode)` and Radar `checked()` precedents): a session verifies only when its `livemode` equals the supplied mode. The write paths pass their connection's mode; the read handlers call without one, so read behavior is byte-identical to before |
| Fingerprint confirmation works once the core declares `previewFingerprint` | Both modules validate arguments with the shared `validateFields` (billing-shared), which rejects any field outside the per-tool property set — `previewFingerprint` included — so a fingerprint confirmation would throw before reaching the core check | Family-local resolution (the Payments/Radar idiom): both modules strip `previewFingerprint` from a shallow copy before validation, and both control schemas declare it |
| Mode-shaped ID patterns may exist (the Checkout species) | None: the session pattern `^vs_[A-Za-z0-9]{2,100}$` is mode-neutral | Nothing to widen; recorded as checked |
| "TEST unchanged" for summaries (design card's named tests) | The pre-existing suites assert the TEST preview text (`TEST ONLY`, `does not erase`, `NOT completed erasure`) | TEST summaries for create and cancel stay byte-identical; LIVE summaries carry the new plain-words disclosures. The redact summary gains the "destroys the collected identity documents and verified details" sentence in both modes (asserted phrases preserved verbatim) and the retention-judgment sentence in LIVE |
| A decision entry is needed | None was, beyond the drift resolutions above | `docs/DECISIONS.md` unchanged |

## Build contract (as built)

- **Handler gates removed.** The three handler-layer TEST refusals are
  deleted: `identity_create_session` in `identity-sessions.js`, and
  `identity_cancel_session` / `identity_redact_session` in
  `identity-lifecycle.js`. Handlers now dispatch directly. Under a LIVE
  connection the guarded-write pipeline's existing rules decide: `full`
  profile only, catalog listing, customer context, a live-enabled and
  live-connected account, owner-approved LIVE, and a binding preview
  fingerprint. A bare LIVE connection (and any read-only profile) is refused
  by the core LIVE-enablement guard / profile check before anything
  executes — the pre-existing guard tests assert exactly that outcome,
  unchanged.
- **Mode invariants, both directions.** Every evaluated object — the
  provider-reachability probe's listed sessions on create (each asserted
  with `assertAccountResourceMode`), the create response, the target session
  on cancel/redact — and every read-back verification demands equality with
  the connection's mode, through `identitySafe(v, mode)`. A TEST session
  under a LIVE connection, or a LIVE session under a TEST connection, stops
  the call before any write, or leaves it unconfirmed when the mismatch
  appears in the provider's create response.
- **Verified facts still gate the write.** Cancel still requires a session
  awaiting input; redact still requires an input-pending or verified,
  unredacted session; a session in any other state is refused in both modes.
  The verified hosted-URL check is unchanged: the session URL is surfaced
  only when it verifies as Stripe-hosted (`verify.stripe.com/start/…`), and
  only after independent read-back.
- **Disclosure.** Every tool description is mode-neutral and ≤ 160
  characters. Summaries state the plain-words consequence in the
  connection's mode:
  - create (LIVE): a real person will be asked to submit identity documents
    to Stripe to verify who they are;
  - cancel (LIVE): the person can no longer complete this verification, and
    canceling does not erase the session's records;
  - redact (both modes, retention sentence in LIVE): redaction is
    irreversible, destroys the collected identity documents and verified
    details Stripe holds for the session, processing is NOT completed
    erasure, associated reports/events/records are also affected, and
    whether the business must keep verification records for its own legal
    or compliance reasons is the owner's to judge — the preview discloses
    the destruction and keeps no copy. The server discloses; it does not
    veto on retention grounds.
- **Privacy invariant preserved — not widened.** The safe projection's field
  set is exactly what TEST exposed before this card: id, type, status,
  creation time, redaction status, action-required. `client_secret`,
  verified outputs (names, document data), verification report IDs, document
  links and full metadata appear in no preview, result or audit record, in
  either mode — proven by the new LIVE tests with sentinel values, including
  an audit read-back. No design-card wording asked for more, and none was
  added.
- **Money discipline.** No money wiring is touched; a name-only diff over
  `src/tools/write.js`, `src/money.js` and `src/db.js` is empty.

## Named tests

- `tests/unit/identity-live-conversion.test.js` (9 new tests): the
  projection verifies a session only in its own mode and keeps the TEST-only
  check for no-mode callers; LIVE create — preview discloses real-person
  document collection and issues a fingerprint, confirmation creates exactly
  once and returns only the verified hosted URL, no sentinel in the result
  or the audit; a fabricated fingerprint refuses with the fresh fingerprint
  and creates nothing; a wrong-mode create response leaves the write
  unconfirmed with no URL surfaced; LIVE cancel — preview states the person
  can no longer complete the verification, confirmation cancels exactly
  once; fingerprint drift refusal on cancel (provider state changes after
  preview → refused with a fresh fingerprint, zero provider writes, the
  fresh fingerprint then confirms); LIVE redact — preview discloses
  irreversibility, destruction and the owner retention judgment,
  confirmation redacts exactly once; wrong-mode sessions refused in both
  directions with zero provider writes; a session in a non-redactable state
  refused in LIVE as in TEST.
- `tests/unit/identity-sessions.test.js` (6 tests) and
  `tests/unit/identity-lifecycle.test.js` (6 tests): **all pre-existing
  expectations unchanged** — TEST behavior, the verbatim TEST summary
  assertions, the privacy sentinel assertions, and the bare-LIVE /
  read-only guard outcomes (now refused by the core LIVE-enablement guard
  instead of the deleted wrapper gates, same asserted results).
- `tests/unit/profiles.test.js` passes: the registry instrument — no caller
  outside this family changed reachability. The only shared-function change
  (`identitySafe`'s optional `mode`) is backward-compatible for its no-mode
  callers, proven by the unchanged read assertions in the sessions suite.
- Full unit suite and `npm run check` green on the final tree; the
  conflict-marker grep is empty and `git diff --check` is clean. DB and mock
  suites are exact-head CI's route on this machine (no local PostgreSQL).

## Done when / acceptance

- [x] All three tools preview and confirm in both modes under the existing
  guarded-write rules, with mode invariants on every evaluated object and
  read-back, in both directions.
- [x] The three handler-layer TEST gates and the hidden safe-projection TEST
  gate are gone for writers; reads stay TEST-only under CAP-4's ownership;
  every pre-existing refusal (profile, bare LIVE, wrong state, already
  redacted, app-owned target, unsafe hosted URL, uncertain outcome) still
  fires.
- [x] Summaries disclose the plain-words consequence in the connection's
  mode — real-person document collection on create, completion loss on
  cancel, irreversibility/destruction/retention judgment on redact — and no
  personal data surfaces beyond the pre-existing safe projections.
- [x] No money wiring touched; `src/core/profiles.js` untouched; no caller
  outside this family changed reachability (the profiles registry test is
  the instrument and passes).
- [ ] Live proof: a real LIVE verification session created (and, where the
  owner elects, canceled or redacted) under an owner-approved LIVE
  connection — **left open in the CAP-5 queue; no real person's documents
  were involved in this card's acceptance.** Source implementation is not
  live acceptance.
