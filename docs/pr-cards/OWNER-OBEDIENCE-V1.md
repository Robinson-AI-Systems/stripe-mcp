# OWNER-OBEDIENCE-V1 — LIVE enablement confirmed-action conversion

Status: **IMPLEMENTED IN SOURCE** on branch
`ai/vivienne/owner-obedience-v1` (merge and live proof pending; live
proof closes only at a checked release, CAP-5 queue). Just-in-time
card for conformance row 17,
conversion **V1** in [RAS-MCP-CONFORMANCE](../RAS-MCP-CONFORMANCE.md).
Baseline inspected: `main`
`fbc49e97853d1f58e0cb24d0b4da13093265c413`. This is corrective work
inside the already-merged B-2/B-2b activation choreography; it completes
no predefined batch subsection and must not be counted as one.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| Owner ceremony is the LIVE gate | Passphrase, account-specific consent, a 10-minute intent, and a verified LIVE key all exist, but a deployment flag (`LIVE_MODE_OWNER_APPROVED`) still hard-refuses both LIVE key enrollment and final enablement | Remove only the flag. The per-account owner ceremony remains the IN-06 gate |
| Confirmation binds the evaluated state | The owner checks a consent box; nothing binds the confirmation to the account, credential, environment, or state that was shown | Add a displayed fingerprint of the evaluated state; the owner types it exactly; execution re-evaluates and re-checks it |
| Execution is atomic | `consumeLiveEnableIntent` flips the flag and writes the audit row in one statement, but does not re-check the credential identity that was evaluated | Extend the same statement to require the evaluated key kind/last4 and still-disabled state before consuming the intent |
| Verification is read back | The setup page reports success from the consume result alone | After a successful consume, re-read the account and report enabled only when `live_enabled` and `live_connected` both read back true |
| LIVE key enrollment needs the flag | Enrollment is already protected by origin, CSRF, passphrase, explicit consent, production environment, and exact-account LIVE verification in the key store | Drop the flag condition; keep every other condition |

## Build contract

- `src/tools/live-guard.js`: export a pure
  `liveEnableFingerprint({ intentId, account, environment })` helper.
  Canonical state: intent ID, Stripe account, LIVE key kind, LIVE key
  last4, `live_enabled`, `live_connected`, deployment environment, and
  intent expiry. Format: `LIVE-XXXXX-XXXXX-XXXXX-XXXXX` (20 uppercase
  hex characters of the SHA-256 digest).
- `src/stripe/setup-page.js`:
  - The LIVE intent review panel discloses, in plain words: the exact
    account and label, the enrolled credential kind and last4 (or that
    none is enrolled), the current enabled/connected state, the
    deployment environment, the intent expiry, what enabling means,
    and the server's judgment. It shows the fingerprint and requires
    the owner to type it exactly, in addition to the passphrase and
    the existing account-specific consent checkbox.
  - `enable-live` refuses with no state change when the typed
    fingerprint is absent or does not match a fresh evaluation
    (timing-safe comparison), when consent is missing, when no verified
    LIVE credential is enrolled, or when the account is already
    enabled. A mismatch response re-discloses the current facts and
    current fingerprint so the owner can rule on the state as it now
    stands.
  - `add-live-key` no longer consults `LIVE_MODE_OWNER_APPROVED`. The
    production-environment requirement, explicit enrollment consent,
    exact account shape, and the key store's independent LIVE identity
    verification are unchanged.
- `src/db.js`: `getLiveEnableIntent` also returns the account's
  `live_enabled`, key kind/last4, and connected state.
  `consumeLiveEnableIntent` accepts the expected fingerprint and key
  kind/last4; when they are supplied, the intent is consumed only if
  the account still matches them and is still disabled, and the audit
  summary records the confirmed fingerprint. Callers that supply no
  expectation keep the previous behavior.
- `test/helpers/fake-db.js`: mirror the new intent fields and the
  expected-state consumption rule.
- No tool, profile, pass, money, or provider behavior changes. No LIVE
  key is used, no account is enabled, and no deployment setting is
  changed by this card; source and synthetic-fixture proof only, with
  live proof queued for CAP-5 after a checked release.

## Named tests

- `tests/unit/setup-page.test.js` (B-2b describe): activation succeeds
  with the flag absent after passphrase, consent, and exact fingerprint;
  wrong or missing fingerprint changes nothing and leaves the intent
  usable; a state change between review and confirmation invalidates
  the old fingerprint; production/consent/shape gates for LIVE key
  enrollment are unchanged in shape (flag no longer one of them).
- `tests/unit/live-guard.test.js`: fingerprint is stable for identical
  state and changes when account, key, environment, enabled/connected
  state, intent, or expiry changes.
- `tests/db/live-enable.test.js`: expected-state consumption succeeds
  on a match and refuses — without consuming the intent — on a key or
  state mismatch; legacy no-expectation calls keep working.
- `npm run check` on the assembled tree, then exact-head CI.

## Done when

The flag no longer appears in runtime code; the fingerprint ceremony
above is implemented and covered by the named tests; governing docs
(ARCHITECTURE, DEPLOY, GO-LIVE-CHECKLIST, TOOL-CATALOG, OWNER-INPUTS,
conformance row 17, COMPLETION, STATUS, DECISIONS) describe the new
gate accurately; and the PR records that live proof remains open.
Successors V2–V4 inherit row 17 unchanged.
