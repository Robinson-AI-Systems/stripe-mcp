# CAP4-CONNECT-SLICE-2 — Connect slice 2: connected-account lifecycle writes

Status: **SOURCE-IMPLEMENTED.** Slice 2 of CAP4-CONNECT (Phase 2
of the frozen CAP-4 sequence). Eleven new native write tools in a
new module, `src/tools/connect-writes.js` (area `connect`), on the
guarded `defineWrite` lifecycle, extending slice 1's module
conventions (`src/tools/connect-reads.js`, PR #324): the same
actor verification (slice 1's `platformAccount`, now exported and
reused verbatim — not a parallel shape), the same safe-fields
projections, the same mode discipline. Baseline: `main`
`8bc4b95b6ca6b36c0664b5b18f173deb777dfa8f` (PR #336,
CAP4-D7b). Design record: the CAP-4 card set (`card-connect.md`,
`coordinator-rulings.md` rulings 3 and 5, the census
reconciliation appendix §CONN) in the coordinator's design
folder; the write contract list is COMPLETION item 3 (preview,
authorized effect, stable replay key, before state, audit,
provider read-back, bounded results).

## The ruled forks, as built (rulings 3 and 5)

1. **Credential class (a), unchanged:** the platform acts only
   via the owner's enrolled connection. The connected account is
   an explicit exact argument on every account-scoped tool —
   never implicit, ambient or defaulted. The platform account
   (the connection's own account) is verified as the actor
   inside every tool's `read()` — after the mode client resolves
   (LIVE only through the verified seam in
   `src/tools/account-mode.js`) and before any call that touches
   a connected account — and is named in every preview and every
   audit record (the audit row's account is the platform
   account). A connection whose provider account is not the
   enrolled platform account refuses before any
   connected-account call; the suite proves this with provider
   spies (no retrieve ever carries the connected account, no
   write method runs).
2. **Slicing:** this PR is lifecycle writes only. Slice 3
   (account delete, reject, unreject, the v2 close) is not in
   this build; no tool here covers it, and a slice-1 suite pin
   now asserts exactly that remainder (see "Baseline pins
   updated" below).
3. **Minting (ruling 5):** `account_links` AND `login_links`
   land in this slice under the minting exception: exact
   connected-account argument, the minted URL shown **once** in
   the confirmed result and nowhere else (see the link
   disposition below). `account_tokens`/`person_tokens` are NOT
   built and stay refused; no door row or refusal text naming
   them is touched — this PR does not edit the universal door
   at all (the accounts-row flip is D-9's, and D-9 lands after
   this slice; recorded here as the expectation per the Connect
   card's coordination note).
4. **v1 first:** canonical v1 paths only. The published-only
   `bank_accounts`/`people` alias spellings stay
   covered-by-canonical; the 15 v2 core operations stay
   covered-by-design-decision (fork 4).

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| New write tools threaten the 20,000-token everyday catalog cap (19,999 at baseline) and might need wording economies | `scripts/check-budgets.mjs` computes the everyday catalog from a modeless synthetic everyday connection for which writes are never admitted — the 19,999 is a reads-only total, so write tools add exactly 0 tokens whatever their descriptions say | No cap move, no shrunk or weakened text; the treatment is recorded with numbers in the budget section below, per the card's instruction to follow the repo's own convention |
| The guarded-door area sets would need an exotic admission for a new area | `src/core/profiles.js`: `connect` was in neither set; the V2 families' own pattern (invoices, files, reports, branding) is an area addition with an explanatory comment, in TEST and LIVE alike | `connect` joins both sets with family-style comments (named in "Registration points") |
| Slice 1's JIT card is at `docs/pr-cards/CAP4-CONNECT-SLICE-1.md` (the commissioning brief's path) | The landed card is `docs/pr-cards/CAP4-CONNECT-SLICE1-READS.md`; this slice's card follows the repo's file convention as `CAP4-CONNECT-SLICE-2.md` | Read the actual card; no content difference |
| Handler refusals raised inside `read()` surface as structured error results | The write adapter formats only genuine Stripe SDK errors (`toStripeToolError`); validation, actor and mode `TypeError`s propagate as throws — the house surface the payment-settings suites assert with `rejects.toThrow()` | The module refuses by `TypeError` throughout, matching the house; the suite asserts each refusal on its actual surface (thrown for pre-apply refusals, structured `done:false` for guard refusals and read-back mismatches) |
| The metadata validator returns the validated metadata object | `validateMetadata` in `billing-shared.js` is a pure validator: it throws on invalid/app-marker metadata and returns `undefined` | `metadataArg` validates, then passes the caller's original object through (the pattern the other families use implicitly); a unit test caught the silent drop — the update preview now names `metadata` in its change set |
| Connect write SDK method names from general API knowledge | Verified against the pinned SDK itself (offline instantiation): `accounts.create/update/createPerson/updatePerson/deletePerson/createExternalAccount/updateExternalAccount/deleteExternalAccount/updateCapability/createLoginLink` and `accountLinks.create` all exist with those exact names | Used as verified; no alias or raw-request fallback needed |

## Scope — the exact operation list, with contract disposition per operation

All eleven operations carry the full write contract (preview
naming the exact connected-account ID and the exact change set;
verified platform actor in preview and audit; stable replay key
— a replay re-presents the original provider result under the
same idempotency key; before-state capture bound into the
preview fingerprint; audit record; provider read-back
verification, a mismatch failing the tool as uncertain, never a
success; bounded results) except where a disposition below says
otherwise with provider evidence.

| Tool | Pinned operation | Disposition |
| --- | --- | --- |
| `connect_create_account` | `POST /v1/accounts` | Full contract. The create parameter set is the subject (the one tool whose connected account does not exist yet): actor verification, mode discipline and read-back (retrieve the created account, verify type + projection) apply unchanged. Change set: type (required), country, business type, business name, default currency, metadata (app-marker keys refused by the shared metadata validator). |
| `connect_update_account` | `POST /v1/accounts/{account}` | Full contract. Change set: business name, business URL, business type, metadata. Read-back compares each requested field on the re-read account. |
| `connect_create_person` | `POST /v1/accounts/{account}/persons` | Full contract, safe-fields posture (below). Change set names fields only in every surface. |
| `connect_update_person` | `POST /v1/accounts/{account}/persons/{person}` | Full contract, safe-fields posture. Verification compares the raw provider state internally; nothing raw is projected. |
| `connect_delete_person` | `DELETE /v1/accounts/{account}/persons/{person}` | Full contract. Read-back: the re-read person must carry `deleted: true`; where the provider instead answers `resource_missing` for the deleted person, the read-back synthesizes the deleted marker for the exact ID (both shapes pinned by test). |
| `connect_create_external_account` | `POST /v1/accounts/{account}/external_accounts` | Full contract. **Tokenized attachment only** — the argument is a `tok_…` token; raw bank/card numbers are refused by argument shape before any provider call (the repo-wide hosted/tokenized rule). The token value never appears in preview, result or audit. |
| `connect_update_external_account` | `POST /v1/accounts/{account}/external_accounts/{id}` | Full contract. Change set: default-for-currency, metadata. Preview carries last4 only — never routing number or fingerprint. |
| `connect_delete_external_account` | `DELETE /v1/accounts/{account}/external_accounts/{id}` | Full contract; delete read-back as for persons (the provider's post-delete `resource_missing` is the expected shape and is pinned). |
| `connect_update_capability` | `POST /v1/accounts/{account}/capabilities/{capability}` | Full contract. Change set: `requested` boolean (request or unrequest). Read-back must show the exact requested state. |
| `connect_create_account_link` | `POST /v1/account_links` | **Minting exception (ruling 5)** — full contract except read-back, which does not exist (disposition below). |
| `connect_create_login_link` | `POST /v1/accounts/{account}/login_links` | **Minting exception (ruling 5)** — as above. Express-only refusal remains the provider's own error, surfaced unchanged. |

**The link disposition (provider-evidenced, per ruling 5).**
Stripe provides no GET, list or revoke for a minted account
link or login link: once created, the URL exists only in the
create response. The tools therefore carry every contract
element except a provider read-back of the link itself, and say
so plainly in the preview, the summary and the result note. In
place of a link read-back, the post-mint verification re-reads
the connected account and proves it unchanged and in-mode, and
the mint response itself is validated in `apply` (object type,
exact account, `https://connect.stripe.com/` URL, expiry for
account links) before it is accepted. The minted URL is
attached to the confirmed result by the handler wrapper (the
webhook-create one-time-artifact precedent) and appears
**exactly once** in that result — never in the preview (a
dry-run mints nothing), never in the audit record (summaries
name the account and the minting, never a URL), never in a log.
A replay under the same request key re-presents the original
result under the same idempotency key, per the standing replay
contract.

**Persons safe-fields posture.** Person previews, summaries and
audit records name the FIELDS being set (`first_name`, `dob`,
`relationship.owner`, …) and the safe projection of the
before-state (verification status, role booleans) — never an
identity value. Verification compares raw provider fields
internally (name, DOB, relationship incl. percent ownership)
without projecting them anywhere. Document data, ID numbers and
addresses are not a tool surface at all: hosted onboarding
through account links collects those from the account holder
directly. The suite pins sentinel absence (names, DOB year, ID
number, SSN fragment, percent-ownership value, email, address)
across preview, result and audit text.

**Mode discipline.** A call acts in the connection's mode only.
Persons, capabilities and external accounts verify `livemode`
against the connection mode (required present) through slice
1's projections at before-state, apply-result and read-back —
a wrong-mode object refuses the whole call, on write and on
read-back (both pinned). Account objects follow the projected
readers' documented tolerance (a present `livemode` must match;
accounts do not reliably publish it — the mode seam itself, the
verified platform read, is the primary proof, exactly as slice
1 recorded).

**Account create's before-state** is the verified creation
descriptor (platform actor + the exact parameter set), bound
into the preview fingerprint; the created account is the
read-back subject.

## Registration points (named exactly)

- `src/tools/index.js`: `connectWrites` namespace imported and
  merged immediately after `connectReads` (tool registration
  only; merge order places the eleven names after the seven
  connect reads in the registry's exact-name list).
- `src/core/profiles.js`: `connect` joins `guardedTestAreas`
  and `guardedLiveAreas`, each with the family-style comment
  the V2 families used (the area was in neither set, so without
  this the writes would be unreachable through every guarded
  door in both modes). This is an admission change, not money
  wiring: the writes move no money (`safety:'P'`,
  non-financial in the LIVE door's terms). `src/tools/write.js`,
  `src/money.js` and `src/db.js` are **untouched**.
- `src/tools/connect-reads.js`: one-word change — slice 1's
  `platformAccount` is exported so the write module reuses the
  exact actor verification. No slice-1 behavior changes; its
  suite passes with only the two baseline-record updates below.

## Registry, listing and budget treatment (with numbers)

- Registry: **329 → 340 tools; 155 → 166 writes** (174
  read-labelled). Visibility: read-only 162 (unchanged),
  everyday 255 (unchanged — the new writes are `full`-profile
  only, like the account-area settings writes), full 340.
- Everyday catalog budget: **19,999 / 20,000 tokens, unmoved.**
  `scripts/check-budgets.mjs` computes the everyday catalog
  from a modeless synthetic everyday connection, for which
  writes are not admitted at all — the catalog counts reads
  only, so new write tools add exactly 0 tokens regardless of
  wording; no cap was moved, no other tool's text was shrunk,
  and every new description is accurate at ≤160 chars (95–118).
  Per-tool input schemas are each far under the 1,500-token
  budget (the largest, the person tools, carry 15 properties).
- Guarded doors: all eleven writes are admitted by
  `stripe_call`'s TEST door and, on an owner-approved LIVE
  connection, the LIVE door (pinned by test); compact listing
  is unaffected (writes are never compact-listed).

## Tests and honest baseline accounting

New suite `tests/unit/cap4-connect-slice2-writes.test.js`
(29 tests) in the slice-1 suite's house style, over a stateful
fake provider world (creates land in maps, updates merge,
deletes mark/remove, idempotency keys replay the original
response): per-tool preview accuracy (exact account + exact
change set), no-confirm never writes, confirm = one idempotent
write + independent read-back + audit pair, replay returns the
original result with no second resource, read-back mismatch
fails the tool, actor refusal before any connected-account
call (provider spies), wrong-mode refusal on write and on
read-back, persons sentinel pinning across preview/result/
audit, TEST lifecycle round-trips (persons and external
accounts create → update → delete, incl. the provider-404
delete read-back), the link once-only proof (URL count in the
result text is exactly 1; absent from preview and every audit
summary; no-read-back stated), and LIVE fixture legs (update,
person create, login link execute through the verified seam;
missing owner grant and database-disabled account refuse with
zero provider writes). The generic seven-case helper
(`tests/helpers/write-contract.js`) is not reused: its provider
counters assume `read` and `readAfter` are distinct provider
methods and an app-owned metadata target, neither of which
fits the Connect surface; the same seven checks are proven
per tool explicitly, and the generic machinery suite itself is
untouched and green.

**Baseline accounting.** Against a pristine checkout of
`8bc4b95b` the new suite fails at import — the module does not
exist there — so all 29 tests are red as **tool-missing**,
none as behavior. The guard pins that pass at baseline pass
because the machinery already refuses: the universal door's 13
pinned Connect write classifications (slice-1 suite, unedited
door pins) and the generic defineWrite contract suite are
green at baseline and remain green here, because this PR does
not touch the door or the machinery.

**Baseline pins updated (2, both baseline records slice 2
necessarily supersedes; no behavior pin moved):**
`tests/unit/registry.test.js` (exact-name list +11, writes
155 → 166) and `tests/unit/profiles.test.js` (home total
329 → 340) carry the new counts as plain edits in the
inventory files' own style. In the slice-1 suite, the two
registry-total assertions (329/155 → 340/166) and the closing
assertion "no native write tool covers any slice 2-3
operation" — the latter narrowed to slice 3's exact remainder
(no `connect_delete_account` / `connect_reject_account` /
`connect_unreject_account` exists) with the door-classification
pins above it untouched. Slice 1's read-behavior tests are
unedited and pass.

**Results on the final tree (this VM, TMPDIR under
`~/workspace`):** full unit suite **212 files / 2,338 tests
passing** (baseline 211 / 2,309; +1 file, +29 tests, all in the
new suite); `npm run check` green (secret scan, docs check,
work-index validation, lint, write-contract checks, budgets at
19,999/20,000, OpenAPI verify, capability reports, developer
evidence, session check); whole-tree conflict-marker grep
empty.

## Untouched, on purpose

- The `dev-connect-*` TEST substrate simulations: unfenced-from
  and unmodified.
- The universal door's refusal table and hand-built map:
  D-9 owns the accounts-row flip and lands after this slice.
- Money wiring (`src/tools/write.js`, `src/money.js`,
  `src/db.js`): no change.
- Slice 3 (account delete / reject / unreject / v2 close):
  remains unbuilt and refused, named here as the Connect
  remainder.

## CAP-5 queue addition

Slice-2 acceptance joins the CAP-5 queue: **one lifecycle
round-trip on the testing surface only** (create a person and
an external account on a TEST platform's test connected
account, update both, delete both, each step read back through
the slice-1 readers; one account link and one login link
minted and shown once), against the deployed testing app —
never a real connected account, never LIVE Connect data.
