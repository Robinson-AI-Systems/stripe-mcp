# CAP4-CONNECT-SLICE1-READS — Connect slice 1: native projected reads for connected accounts

Status: **SOURCE-IMPLEMENTED.** Slice 1 of CAP4-CONNECT (Phase 2
of the frozen CAP-4 sequence, running parallel to Phase 1; D-3
PR #321 and D-1 PR #322 are merged). New native construction, not
a conversion: the seven pinned v1 Connect GETs gain hand-built
projected readers in a new module, `src/tools/connect-reads.js`
(area `connect`). Slices 2 (lifecycle writes) and 3
(destructive/terminal) are **not** in this build and remain
exactly as refused as at baseline (proven below). Baseline:
`main` `e14e791a0b2dba3eed52a9c146ddca2af1449bb3` (PR #322,
CAP4-D1-MONEY-READS). Design record: the CAP-4 card set
(`card-connect.md`, `census.md`, `census-reconciliation-appendix.md`
§CONN, `sequence.md` Phase 2 and cross-cutting rules,
`coordinator-rulings.md` ruling 3) in the coordinator's design
folder.

## The ruled forks, as built (coordinator ruling 3)

1. **Credential class (a):** the platform acts only via the
   owner's enrolled connection. The connected account is an
   explicit exact argument (`accountId`) on every account-scoped
   tool — never implicit, ambient or defaulted; a missing or
   inexact argument refuses before any provider call. The
   platform account (the connection's own account) is verified
   as the actor before any connected-account call, via the
   verified-account readers in the connection's mode (the money
   bank reads' `authenticatedAccount` precedent).
2. **Slicing:** reads first — this PR. Lifecycle writes and
   destructive/terminal operations land as their own later PRs
   under the same card; no slice is described as "Connect done".
3. **Minting:** slice 1 mints nothing. `account_links` is a
   later slice's ruled native exception; `account_tokens` and
   `person_tokens` stay refused. No tool in this build is named
   for, or can mint, a link or token.
4. **v1 first:** the 15 v2 core operations are
   covered-by-design-decision (recorded in the trace below), not
   built, until a v2 dispatch unit exists.

## Scope — the exact operation list, with census traceability

Seven new read tools, one per pinned v1 GET row the
reconciliation appendix assigns to the Connect card (§CONN,
"accounts GET family" plus the persons row):

| Tool | Pinned operation | Appendix row |
| --- | --- | --- |
| `connect_list_accounts` | `GET /v1/accounts` | accounts GET family |
| `connect_get_account` | `GET /v1/accounts/{account}` | accounts GET family |
| `connect_list_capabilities` | `GET /v1/accounts/{account}/capabilities` | accounts GET family |
| `connect_get_capability` | `GET /v1/accounts/{account}/capabilities/{capability}` | accounts GET family |
| `connect_get_external_account` | `GET /v1/accounts/{account}/external_accounts/{id}` | accounts GET family |
| `connect_list_persons` | `GET /v1/accounts/{account}/persons` | accounts GET family |
| `connect_get_person` | `GET /v1/accounts/{account}/persons/{person}` | persons: Connect owns |

Not built, by the same trace:

- **The other 13 pinned v1 rows** (appendix "accounts
  POST/DELETE family") belong to slices 2–3: `POST /v1/accounts`,
  `POST /v1/accounts/{account}`,
  `DELETE /v1/accounts/{account}`,
  `POST /v1/accounts/{account}/capabilities/{capability}`,
  `POST /v1/accounts/{account}/external_accounts`,
  `POST /v1/accounts/{account}/external_accounts/{id}`,
  `DELETE /v1/accounts/{account}/external_accounts/{id}`,
  `POST /v1/accounts/{account}/login_links`,
  `POST /v1/accounts/{account}/persons`,
  `POST /v1/accounts/{account}/persons/{person}`,
  `DELETE /v1/accounts/{account}/persons/{person}`,
  `POST /v1/accounts/{account}/reject`,
  `POST /v1/accounts/{account}/unreject`.
- **10 published-only v1 aliases** (`bank_accounts`/`people`
  spellings): covered-by-canonical, per the card — the canonical
  paths above are the built surface.
- **15 v2 core operations** (accounts ×12 incl. persons and
  person_tokens, account_links ×1, account_tokens ×2):
  covered-by-design-decision under fork 4.
- **`GET /v1/accounts/{account}/external_accounts` (the list)**
  is D-1's row, not this card's — see the drift table.

Registry delta, accounted exactly: **322 → 329 tools** (318 →
325 hand-built plus the 4 `api_*` tools); writes unchanged at
155; reads 167 → 174. Read visibility per profile 155/156/167 →
162/163/174; declared visibility 155/248/322 → 162/255/329;
guard-filtered TEST catalog listings 155/242/320 → 162/249/327
(all measured from the registry at both heads); compact listings
unchanged at 16/16/26 (no Connect tool enters the compact set).

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| "The GETs are door-served guarded reads" (card drift table) | Six of the seven are door-served in raw provider shape. The seventh — `GET /v1/accounts/{account}/persons/{person}` — is **refused** by the door's sensitive-family rule (`rejectSecret` matches the `{person}` path segment), which names a specialized native reader. The persons **list** is door-served only because the same rule does not match the `persons` segment | All seven gain native projected readers here. The door itself is untouched (D-9 owns door edits; per the card, the accounts rows' reason-text flip belongs to whichever of D-9/Connect lands second — D-9 lands later, so the flip is D-9's, recorded here so it is not lost). The door's person-by-id refusal is pinned by test as unchanged |
| Fork 2's slice-1 wording includes "external-accounts list/get" | The reconciliation appendix assigns the external-accounts **list** row to D-1 (own-account subject; built as `money_list_bank_accounts` in PR #322) and the **get-by-id** row to this card; the card's own census trace claims 7 GETs, and the list is not one of them | Slice 1 builds the get-by-id row. A connected-account external-accounts **list** tool would double-dispatch D-1's row under a second subject; it is **not built** and is flagged to the coordinator as the one wording tension in the card set — if it is ever wanted, it needs its own named disposition, not a silent second claim on the row |
| Adding 7 read tools is listing-neutral | The designed everyday-catalog budget (BATCH-C C6: fail at ≥20,000 tokens) stood at 19,190; the family as first written brought it to 20,217 — a breach of a designed product constraint, not a number to widen | Fitted honestly to **19,975** without touching the cap: the tools declare `detailFieldsSupported:false` (their projections are fixed safe-field sets that caller field-selection must not reshape; precedent in `catalog-extras`, `catalog-metered`, `tax-native`, `quote-native`), descriptions are tightened (all ≤160 chars, all naming both modes), and the three list **cursor** schemas carry type+length while the handlers enforce the exact cursor patterns (paging + per-family ID checks); primary ID arguments keep their full patterns in schema. Recorded here because it is a deliberate trade, not an accident |
| Persons projections have an existing field set to copy | The Identity family's posture exists (`identitySafe`: state + minimal identity, never documents/PII), but no person projection existed | The field set is pinned by test: `{id, account, createdAt, verificationStatus, relationship{owner, director, representative, executive}, requirements{currentlyDue, eventuallyDue, pastDue, pendingVerification, disabledReason}}`. Role **booleans** are the structural minimum (who represents/owns the account); `percent_ownership` is a person's data value and is excluded. Requirement lists project Stripe's field **names** only (e.g. `dob.day`), never values. Names, dates of birth, addresses, contact details, document data and ID numbers are never projected — the pinning test loads the fixture with sentinels for each and asserts absence |
| Every returned object can be mode-verified the same way | An Account object does not reliably publish `livemode` (the verified-account readers' documented stance) | The account projection follows the money bank summary precedent: a present `livemode` must equal the connection mode, absence is tolerated. Capability, person and external-account objects publish `livemode`, so those projections verify with `assertAccountResourceMode(..., {required:true})` — refused in both directions, and a wrong-mode member refuses a whole list read |
| The platform actor is already verified by the shared seam | On LIVE the seam (`selectedAccountClient`) verifies the connection's own account; on TEST it does not | Every handler additionally runs the verified-account readers keyed on the connection mode (the money bank reads precedent), so the actor check is uniform in both modes: the provider's view of the credential must be the enrolled platform account with independent mode evidence, before any connected-account call. The card's named actor-verification test pins both the identity-mismatch and mode-evidence-mismatch refusals, with spies proving no connected-account provider method was called |
| Registry inventories elsewhere are dynamic | `tests/unit/meta.test.js` hardcodes the read-only catalog length (155) and `tests/unit/profiles.test.js` the home tool count (322) | Updated to the measured 162 and 329 (inventory updates in the established pattern); no assertion is weakened — both still assert exact equality against the live registry |
| A DECISIONS.md entry is expected for design choices | The choices above are interpretations of the card and its rulings, recorded in this table | No `docs/DECISIONS.md` entry, per the V2-BILLING / D-3 / D-1 precedent |

## Build contract, as built

- `src/tools/connect-reads.js` (new) — the seven tools above,
  area `connect`, `writes:false`, all profiles. Every handler:
  validates its exact argument set first; resolves the shared
  `guarded` seam (TEST exactly as always; LIVE only through the
  verified selected-account path); verifies the platform actor;
  calls exactly one pinned provider read through the official
  SDK (`accounts.list`, `accounts.retrieve`,
  `accounts.listCapabilities`, `accounts.retrieveCapability`,
  `accounts.retrieveExternalAccount`, `accounts.listPersons`,
  `accounts.retrievePerson`); verifies the returned object's
  identity (exact ID and owning-account match) and mode; and
  projects safe fields only.
- Projections: account — ID, type, country, default currency,
  business type/name, charges/payouts/details-submitted flags,
  creation time, requirement name-lists. **Never:** email,
  company (its `tax_id`), individual (person data), settings,
  metadata, external-account details, TOS acceptance.
  Capability — name, status, requested flag/time, requirement
  name-lists. External account — masked `last4` only, bank name
  or card brand/expiry; **never** routing/account numbers or
  fingerprints. Person — the pinned set in the drift table.
- `src/tools/index.js` — the module joins the registry
  (immediately before the universal namespace, like every family
  before it). No dispatcher, profile, door, classification or
  hand-built-map file is in the diff: the universal door's
  behavior for every accounts operation — served GETs and
  refused POST/DELETEs alike — is byte-untouched.
- No SQL, no schema, no money wiring, no write handler touched.
  Slice 1 mints nothing and moves no money.

## Named tests

New suite `tests/unit/cap4-connect-slice1-reads.test.js`
(22 tests):

- **Registration:** exactly the seven names, all `writes:false`,
  area `connect`, all profiles, descriptions ≤160 chars naming
  both modes, no link/token tool; registry 329 total / 155
  writes.
- **Happy paths, both owner-connection modes, all seven tools:**
  projected shapes asserted per tool on TEST and on LIVE
  (platform account verified through the LIVE seam's fake-DB
  route).
- **Privacy:** account fixture carries email, `company.tax_id`,
  individual name, metadata and business-profile contact
  sentinels — none appear; bank fixture carries routing number
  and fingerprint sentinels — none appear; card fingerprint
  absent; the person field-set pinning test (exact key sets at
  every level; sentinel first/last name, email, phone, DOB,
  address, ID number, SSN fragment, document file IDs and
  `percent_ownership` all absent).
- **Mode verification:** wrong-mode capability, person and
  external account refused in **both** directions (by the
  mode-mismatch verification, asserted by message); a
  wrong-mode member refuses the accounts list.
- **Identity:** returned account/capability/person/external
  account whose ID or owning account differs from the exact
  argument refuses.
- **Explicit argument:** missing, malformed and extra arguments
  refuse before any provider call (spy-asserted).
- **Actor verification (the card's named test):** a provider
  whose own-account read is not the enrolled platform account
  refuses before any connected-account call; a TEST connection
  whose independent balance evidence says LIVE refuses the same
  way; a modeless connection is refused at the shared seam.
- **Slices 2–3 regression (baseline record):** all 13 pinned
  POST/DELETE operations still refuse through the door's own
  classification with their exact baseline reasons (6
  financial-class, 7 classification-gap — computed through
  `classifyUniversalWrite` with the door's own
  `financialDecision` input, and `preferredNative` null for
  every one); the door's person-by-id GET refusal
  ("Sensitive universal family…") still fires before any
  provider call; no native write tool exists in area `connect`.
- **Inventories:** `registry.test.js` (exact name list + 155
  writes), `profiles.test.js` (home count 329) and
  `meta.test.js` (read-only catalog 162; budgets green —
  everyday catalog 19,975 under the designed 20,000 cap) updated
  and passing.

Database tests are exact-head CI's route: this build environment
has no local PostgreSQL binaries (`session:prepare` reports
`localPostgresBinaries: false`), and no database code changes
here.

## Acceptance

- All seven Connect read operations serve TEST and LIVE
  platform connections with per-object mode verification, exact
  explicit connected-account arguments, verified platform actor,
  and safe-fields projections; third-party personal and financial
  identifiers never enter a result.
- Slices 2 and 3 remain exactly as refused as at baseline
  (door classification pinned per operation; no native write
  coverage added).
- **Live proof stays open in the CAP-5 queue** (per the
  Connect card's Done-when): Connect acceptance rows on the
  **testing** surface only — for this slice, one projected read
  round (account + person) against a TEST platform connection
  with a test connected account; platform operations on real
  connected accounts are never an acceptance probe. This card
  claims source implementation only.
- The CAP-4 work-index entry names this card while Connect
  slice 1 is the current unit (the D-3/D-1 registration
  pattern); COMPLETION's CAP-4 section and the conformance
  progress note record slice 1 with slices 2–3 remaining.

## Done when

- The seven readers are registered and green under the full
  unit suite and `npm run check`, the slice 2–3 refusal proof
  stands, and the docs named in this card are updated. The
  successor inherits: Connect slice 2 (lifecycle writes) under
  this same parent card, in the frozen Phase 2 order; D-9's
  accounts-row reason-text flip is recorded in the drift table
  above for the D-9 build.
