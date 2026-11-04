# OWNER-OBEDIENCE-V2-SHARED — shared machinery for the V2 conversions

Status: **IMPLEMENTED IN SOURCE** on branch
`ai/vivienne/owner-obedience-v2-shared` (merge pending; see the
acceptance note below on live proof). Just-in-time card for
conformance row 17, conversion **V2** in
[RAS-MCP-CONFORMANCE](../RAS-MCP-CONFORMANCE.md) — the shared
machinery step (1) of the frozen V2 implementation sequence. It
converts no family itself; the per-family conversions (Money,
Disputes, Payments, Invoices & credit notes, Billing, Checkout,
Radar, Identity, Files, Reports, Branding, Projects provider-write
half) build on this card. This completes no predefined batch
subsection and must not be counted as one.
Baseline inspected: `main`
`94813299a8bd077e239504c9df8e22ef616f00db`.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| `defineWrite` confirmation binds the evaluated state | The confirm path re-reads and re-summarizes, but never compares the previewed state with the execution state; `confirm: true` plus the stable `rmcp_` key binds account/mode/tool/arguments, not evaluated target state | Add a preview fingerprint over the evaluated before-state and the prepared preview facts, returned with every preview and re-verified whenever a confirmation presents it |
| Fingerprint confirmation might be LIVE-only | Coordinator ruling 5 (2026-11-03): uniform, all modes — one rule, one review surface, no mode-conditional ceremony | The binding lives in the mode-agnostic core lifecycle (`src/core/write.js`) and applies identically in TEST and LIVE |
| Three TEST-only provider-client helpers gate six families | `client(ctx)` in `src/tools/billing-shared.js` and the identical `getStripe` shapes in `src/tools/payment-writes.js` and `src/tools/checkout-writes.js` all throw `TEST Stripe provider unavailable` for any non-TEST mode | Replace all three with one shared mode-aware helper, `modeClient` in `src/tools/account-mode.js`, modeled on the proven `selectedAccountClient` composition already used by `customer-mode.js`, `catalog-mode.js` and `webhook-mode.js` |
| The seam change could silently open LIVE execution | Every V2 write family retains an independent refusal after this change (module wrapper `gone(...)` refusals and/or dispatcher area admission), verified family by family against the V2 census | The seam resolves clients only; family cards remove the remaining refusals. Two caller groups DO change reachability and are named in the conformance/STATUS record and the PR: the money family's `defineWrite` reads/applies (already dispatcher-admitted and `authorizeLiveWrite`-gated; their exact-approval and cap contract is untouched and now reachable end-to-end on an owner-enabled account) and read-only callers of `client()`, which gain verified LIVE *read* resolution on an owner-enabled account |
| Every door can present the fingerprint | All doors (MCP, `stripe_call`, HTTPS) pass caller arguments to the same handler untouched — the same path `confirm` and `requestKey` already travel; the dispatcher performs no schema stripping | No door change needed. The two families with whole-argument local validators (`payment-writes.js`, `checkout-writes.js`) accept `previewFingerprint` as a control field and declare it in their tool schemas under this card; the remaining legacy families' `additionalProperties: false` schemas are updated by their own family cards as they convert |

## Build contract

- `src/core/write-fingerprint.js` (new): pure
  `writePreviewFingerprint({ tool, account, mode, before, prepared })`.
  Canonical state: the operation (tool name), the Stripe account, the
  connection mode, the handler-read before-state (deterministically
  canonicalized: object keys sorted recursively, Dates as ISO
  strings), and the prepared preview facts (`previewLine`,
  `amountCents`, `currency`, `direction`, each null when the write
  has none). Format mirrors V1's fingerprint:
  `WRITE-XXXXX-XXXXX-XXXXX-XXXXX` (20 uppercase hex characters of the
  SHA-256 digest). The digest input contains no secret.
- `src/core/write.js`:
  - Every preview response (dry-run and prompt paths) carries
    `previewFingerprint`, computed once from the evaluated state of
    that call; the prompt instructs the caller to confirm with it.
  - On a confirm call that presents `previewFingerprint`, the handler
    re-computes it against the freshly read state; a mismatch refuses
    with an error that discloses the fresh preview and the fresh
    fingerprint, and executes nothing (no provider write, no money
    reservation — the check precedes `beforeApply` and the PENDING
    audit record).
  - **A direct confirmation with no preview presented behaves exactly
    as before this card** — same arguments, same audit records, same
    outcomes. The binding governs confirmations that follow a
    preview; it does not retroactively require a preview.
  - A non-string `previewFingerprint` is an invalid-arguments refusal,
    consistent with the existing flag validation. The core tool schema
    declares the new optional property.
- `src/tools/account-mode.js`: export `modeClient(ctx)`. TEST
  resolution is byte-for-byte the historical helpers: the connection's
  own service client, no extra provider read, and the historical
  `TEST Stripe provider unavailable` refusal when the service is
  missing or the mode is neither TEST nor LIVE. LIVE resolution goes
  only through `selectedAccountClient` (production deployment,
  independently enabled and connected account, verified provider
  account/mode read). The helper lives here — beside
  `selectedAccountClient` and the other mode-selection helpers
  (`customer-mode.js`, `catalog-mode.js`, `webhook-mode.js`) — because
  it orchestrates connection services and account state; it is not
  part of the SDK client module (`src/stripe/client.js`), which owns
  the Stripe SDK construction and idempotency keys.
- `src/tools/billing-shared.js`: `client(ctx)` keeps its name and
  signature for its existing importers and delegates to `modeClient`.
- `src/tools/payment-writes.js`, `src/tools/checkout-writes.js`: the
  local `getStripe` helpers are deleted; all call sites use
  `modeClient`. Their argument validators and summary field filters
  treat `previewFingerprint` as a control field (like `confirm`,
  `dryRun`, `requestKey`), and their tool schemas declare it.
- No dispatcher admission, profile, wrapper refusal, money rule, or
  provider behavior changes under this card. No LIVE key is used and
  no account is enabled; proof is unit/synthetic only.

## Named tests

- `tests/unit/write-fingerprint.test.js`: preview→confirm happy path
  executes exactly once with the presented fingerprint; drift between
  preview and confirm refuses with the fresh fingerprint disclosed
  and nothing executed (and the fresh fingerprint then confirms);
  a fingerprint issued for a different target is refused; a fabricated
  fingerprint is refused and a non-string one is invalid; a direct
  confirm with no preview presented is unchanged; the helper is
  stable for identical state (including key order) and changes with
  tool, account, mode, before-state, or any prepared money fact; a
  money preview's fingerprint moves when the provider-derived amount
  moves.
- `tests/unit/mode-client.test.js`: TEST resolution returns the
  connection's service client unchanged through both `modeClient` and
  `client()`; the historical TEST refusal is preserved; LIVE
  resolution returns the verified selected-account client and refuses
  a disabled account and a non-production deployment; the seam alone
  does not open LIVE execution in payments or checkout (their wrapper
  refusals answer first); a payment write's preview→confirm flow
  carries the fingerprint end to end in TEST.
- Existing suites that must stay green untouched in assertion:
  `tests/unit/write-core.test.js`, the seven-case write-contract
  suites (billing, checkout, customer, invoice, payment),
  `tests/unit/setup-page.test.js`, `tests/unit/live-guard.test.js`.
- `npm run check` on the assembled tree, then exact-head CI (the
  database CI job remains the proof route for DB tests; this card
  changes no database code).

## Done when

The fingerprint binding and the one shared client seam are
implemented and covered by the named tests; no existing assertion is
weakened; the reachability changes named in the drift check are
recorded in STATUS and the PR body; and each family card can now
assume both pieces of shared machinery exist.

## Acceptance / live proof

Live proof is **not applicable** to this infrastructure card beyond
unit/mock proof: it enables no family, admits no tool at the
dispatcher, and removes no wrapper refusal. The two reachability
changes named above become exercisable only on an owner-enabled LIVE
account, which does not exist yet; their live evidence belongs to
the Money family card (for the money `defineWrite` paths) and the
CAP-5 knock-test queue (for LIVE reads), not to this card.
