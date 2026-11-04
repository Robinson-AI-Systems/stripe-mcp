# OWNER-OBEDIENCE-V4 — Pass/revoke preparation on either mode

Status: **IMPLEMENTED IN SOURCE** on branch
`ai/vivienne/owner-obedience-v4` (merge and live proof pending;
live proof closes only at a checked release, CAP-5 queue).
Just-in-time card for conformance row 17, conversion **V4** in
`docs/RAS-MCP-CONFORMANCE.md` (census row 46; full census text in
the 2026-11-03 refusal census §3 V4). Designed read-only by Lane C
and implemented under the coordinator rulings of 2026-11-03 (the
stateless preparation mechanism is kept as-is; today's full-profile
caller class is preserved; connection typing is CAP-3's work). This
is corrective work inside the already-merged R-1/B-8 owner-handoff
choreography; it completes no predefined batch subsection and must
not be counted as one.

Baseline inspected: `main`
`94813299a8bd077e239504c9df8e22ef616f00db` (after PR #303,
OWNER-OBEDIENCE-V1).

## What is wrong today (verified at baseline)

Two read-only preparation tools in `src/tools/server.js` —
`stripe_create_pass` (handler ~:105-137) and
`stripe_revoke_connection` (~:139-152) — refuse unless the caller is
on a full-profile **TEST** connection:

- `stripe_create_pass`: `connection?.mode!=='test' ||
  connection?.profile!=='full' ||` account shape → `'A selected
  full-profile TEST owner connection is required'`.
- `stripe_revoke_connection`: same mode/profile/account gate plus
  client-ID shape → `'Select an exact client ID from a full-profile
  TEST owner connection'`.

Both tools change nothing. `stripe_create_pass` validates the
proposed pass scope (mode, profile, areas, writes, money ceiling,
rate, lifetime, Hub flag) and returns `owner_confirmation_required`
with a setup-page URL whose query parameters are *untrusted form
suggestions* (`ownerFormSuggestions` in `src/stripe/setup-page.js`
re-validates every value; the page's own comment: "Native tools send
untrusted form suggestions, never credentials or authorization").
`stripe_revoke_connection` likewise returns `revoked:false` and a
prefilled URL. The consequential steps already complete on the
passphrase-authenticated owner page **in either mode**:

- Pass issuance is the page's `issue-owner-rtc-pass` action: the form
  offers TEST or "LIVE (activated account only)", and LIVE issuance
  requires the separate LIVE consent, LIVE write consent, and LIVE
  money-ceiling consent checkboxes plus passphrase and explicit scope
  confirmation.
- Revocation is the page's two-phase `request-revoke` →
  `confirm-revoke` flow (10-minute intent, exact account + client
  match, separate owner consent) and is mode-agnostic — it acts on
  the account's stored connections, whichever mode they serve.

The mode condition on the preparation tools is therefore a veto of
the preparation step only: an owner working through his own full
LIVE connection — the normal posture once LIVE is enabled — cannot
even stage a pass or a revocation for his own review, and must go
find a TEST connection to start paperwork the owner page would
complete in LIVE anyway.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| Preparation stages a server-side owner intent (census §3 V4 wording: "create the same short-lived owner intent") | Neither tool writes anything: no DB row, no intent, no journal entry. The "intent" language describes the *revocation* flow's page-side intent (`requestConnectionRevokeIntent`, created by the owner page itself), and pass issuance has no intent at all — the page form is the ceremony | Keep the existing mechanism exactly. The conversion changes only who may *prepare*; it does not invent a preparation intent, a DB write, or journaling for a step that changes nothing |
| A fingerprint ceremony is needed at preparation (V1/V3 pattern) | The record itself rules this out: "No fingerprint ceremony is needed at the preparation step itself, because preparation changes nothing — the confirmed action already lives on the owner page" | No fingerprint, no new helper. This card deliberately does **not** reuse V1's fingerprint machinery; it reuses V1's *principle* — the owner's completed ceremony outranks a blanket gate — applied at the layer where the ceremony actually lives (the owner page) |
| The profile gate is part of the veto | Both tools are already `profiles:['full']` at the registry level, and the census classifies profile scope as row 13's plan-binding aim check | `profile === 'full'` stays, in both the registry entry and the handler check. Only the mode condition converts |
| Staging a pass for mode X requires a connection in mode X | Today a TEST connection may stage a LIVE pass (the tool's `mode` argument is independent of the connection's mode) and the page enforces LIVE activation + consents at issuance | The staged pass's mode stays independent of the preparing connection's mode, symmetrically in both directions. The page remains the only place mode eligibility is enforced |
| A LIVE full connection is necessarily the owner's own | The handler gate cannot distinguish the owner's own OAuth connection from a delegated full-profile pass; that is equally true on the TEST side today | Out of scope: the conversion preserves today's caller class exactly (full-profile connections) and widens only the mode. See notes.md for the coordinator decision this flags |

## Build contract

All changes are in `src/tools/server.js` (the two handlers) plus
docs and tests. No tool is added, removed, renamed, or re-profiled;
the registry stays at 322 tools; both tools keep
`profiles:['full']`, `writes:false`, and their existing input
schemas, argument validation, and result shapes.

- `stripe_create_pass` handler: replace the mode condition
  `connection?.mode!=='test'` with a membership check
  `!['test','live'].includes(connection?.mode)`. The profile and
  account-shape conditions are unchanged. The refusal text becomes
  `'A selected full-profile owner connection is required'`. Every
  scope validation after the gate (pass mode/profile enums, areas
  against the registry, writes/profile consistency, money ceiling
  bounds, rate and lifetime bounds including the Hub lifetime) is
  byte-for-byte unchanged, as is the result: status
  `owner_confirmation_required`, the staged values echoed, the
  setup-page URL built from `publicOrigin`, and the notice that no
  pass was created and the bearer <redacted> only ever revealed on
  the owner page.
- `stripe_revoke_connection` handler: same mode-condition
  replacement; client-ID shape validation unchanged. Refusal text
  becomes `'Select an exact client ID from a full-profile owner
  connection'`. The result stays `revoked:false` with the prefilled
  `revokeAccount`/`revokeClient` URL and the notice that the owner
  page must authenticate, preview, and independently confirm.
- Nothing else in either handler changes: no DB reads or writes are
  added, no Stripe call is made, no journal entry is written —
  preparation stays exactly as side-effect-free as today, in both
  modes.
- **What must remain owner-page-only (unchanged, and the card's
  acceptance depends on it):** pass issuance and the one-time reveal
  of the bearer <redacted> (`issue-owner-rtc-pass`, `reveal`); every
  LIVE consent for pass issuance (LIVE, LIVE write, LIVE money
  ceiling); the revocation intent creation, preview, and
  confirmation (`request-revoke`, `confirm-revoke` with its separate
  owner consent); and the page's passphrase, Origin, and CSRF checks
  that precede all of them. No MCP tool — in either mode — mints,
  reveals, or revokes a credential after this change, exactly as
  before.
- Governing docs updated in the same PR: `docs/TOOL-CATALOG.md`
  (the pass/revoke preparation entries, if they state the TEST
  condition), `docs/RAS-MCP-CONFORMANCE.md` row 17 V4 bullet (dated
  source-implemented note; live proof still open),
  `docs/COMPLETION.md` row 17, `docs/STATUS.md`,
  `docs/DECISIONS.md`. Listing descriptions are already mode-neutral
  ("Prepare the private owner-confirmed RTC pass issuance form…")
  and stay unchanged.

## Named tests

Extend the R-1 describe in `tests/unit/setup-page.test.js`
(`'R-1 native pass and revoke owner browser handoff'`, whose fixture
already drives both preparation tools and the owner page) and the
page-side suite in `tests/unit/owner-revoke.test.js`:

- **Preparation succeeds on a LIVE full connection:** with
  connection `{stripeAccount:'acct_NATIVE26', mode:'live',
  profile:'full'}`, `stripe_create_pass` staging a LIVE pass
  (and, symmetrically, a TEST pass) returns
  `owner_confirmation_required` with the staged values echoed, a
  setup-page URL on the configured origin, and no `rtc_pass_`
  string anywhere in the result. The URL's prefill opens the owner
  page form with the staged account/mode/profile preselected
  (mirroring the existing TEST assertions).
- **Preparation still refuses the wrong caller in either mode:**
  `read_only` and `everyday` profiles on a LIVE connection →
  `isError:true` for both tools; malformed account and malformed
  client ID refuse in LIVE exactly as in TEST; invalid pass scope
  (writes on a read-only profile, money ceiling without writes,
  out-of-bounds lifetime/rate) refuses identically in both modes.
- **Revocation preparation cannot itself revoke anything:** on a
  LIVE full connection, `stripe_revoke_connection` returns
  `revoked:false`; against the fake DB seeded with access tokens
  for the account (owner-revoke fixture pattern), every token is
  still present afterwards and no `stripe_revoke_connection` audit
  row exists — preparation created no intent, no journal entry, no
  state change of any kind. The same assertion extended to
  `stripe_create_pass` in LIVE: no token/pass rows exist in the
  fake DB after preparation.
- **The consequential step still refuses anywhere but the owner
  page:** there is no MCP call in either mode that issues or revokes
  — asserted by the two tests above (results carry no credential and
  no revocation) — and the page side is unchanged: the existing
  owner-revoke suite (wrong passphrase 401, forged origin/CSRF 403,
  missing final consent 400, intent expiry) passes unmodified, and
  the R-1 test's wrong-passphrase issuance refusal (401) passes
  unmodified. Add one LIVE-flavored page assertion: a revocation
  staged from a LIVE-connection preparation URL completes through
  `request-revoke` → `confirm-revoke` on the page and only then is
  the token gone.
- Full unit suite and `npm run check` on the assembled tree, then
  exact-head CI. No database schema, fake-DB, or stripe-mock changes
  are needed.

## AI-PR-READ-FIRST self-review points (for the implementing PR)

- **Money (1, 1a, 2, 3):** no money tool, approval, cap, or
  idempotency behavior is touched. A staged pass's money ceiling is
  still only a proposal: item 1a's rule that a ceiling is not
  approval is stated on the owner page form itself and is unchanged;
  the ceiling takes effect only if the owner issues the pass there.
- **Secrets (4, 5, 6):** preparation returns no credential material
  in either mode (asserted in tests: no `rtc_pass_` in results);
  one-time secrets still leave only through the owner page's reveal
  flow; no key handling changes.
- **Guards (7, 8, 9):** no write door changes — both tools remain
  `writes:false` preparation only. Item 9 is the reason the profile
  condition stays: widening preparation to `read_only` or `everyday`
  connections is *not* part of this conversion.
- **Login and passes (10, 11, 12, 13):** item 11 is the sensitive
  one: pass *defaults* stay narrow (the tool's staged defaults —
  TEST, read-only, server area, no writes, $0 ceiling, 24 h — are
  unchanged), and nothing about issuance widens: the owner page's
  passphrase, lockout, and explicit per-scope and per-LIVE consents
  are the issuance gate in both modes, exactly as today. Revoked
  tokens and expired passes remain refused by the unchanged auth
  layer. RTC behavior unchanged.
- **Context (14):** no new tools; descriptions unchanged; result
  shapes and budgets unchanged.

## Done when

Both preparation tools work identically on the owner's full TEST and
full LIVE connections; every refusal that existed for profile,
account shape, client shape, and scope validity still fires in both
modes; no credential can be issued, revealed, or revoked through any
MCP call; the named tests pass; the governing docs describe the new
behavior; and the PR records that **live proof remains open** — row
17's V4 closes only on live evidence at a checked release (CAP-5
queue): on the deployed server, preparation from the owner's live
full connection returns the owner-page handoff, and completion still
happens only on the page. No LIVE key is used and no real pass is
issued or revoked by the implementing PR itself.
