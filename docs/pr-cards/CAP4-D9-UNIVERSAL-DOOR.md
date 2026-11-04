# CAP4-D9-UNIVERSAL-DOOR — the universal door, classified (one table, 215 rows, reasons that tell the truth)

**Status: source-implemented** on branch
`ai/vivienne/cap4-d9-universal-door` from baseline `main`
`580fde28de4d104853fb2f3a154f263385bbc8c2` (the coordinator
publishes). Unit **D-9** of the CAP-4 census (§4), built exactly
per `card-universal-door.md`: classification-first, the table is
the unit, behavior changes only where the table says
generic-allow.

## The table

`src/stripe/universal-classification.js` — data, not code paths:
one row per pinned POST/DELETE operation that is not in the money
class, each carrying ownership class, cost class, secret class,
read-back route, and disposition. The module header carries the
re-derivation procedure (on every catalog re-pin the table is
re-derived and the drift test re-run; published-only operations
enter only when a re-pin adopts them). A drift test fails CI if
the pinned catalog and the table disagree — a new operation is
unclassified is a build failure, never a silent generic refusal.

`classifyUniversalWrite` consults the table after its two
preserved head branches (metadata-only updates first, the money
class second — see Untouched). Generic-allow rows pass under the
existing guarded-write contract; every other row refuses with its
class reason, replacing the single generic line-26 text. In
`api_write`'s `safeWrite`, a classified refusal row serves its
reason ahead of the older gates that would otherwise have spoken
first (the sensitive-family screen, the money heuristic); native
redirects (`preferredNative`, 14 rows) keep their own route, and
metadata-only updates keep theirs.

**The partition, machine-proven:** 307 pinned POST/DELETE
operations = 92 money-class (not rows; the transfer branch
refuses them first, byte-identically) + 215 rows:

| Disposition | Rows | Notes |
| --- | --- | --- |
| allow | 39 | 10 baseline whitelist rows (unchanged) + 29 new: terminal readers/configurations CRUD (6), billing meters/alerts/feedback config (11), tax registrations/locations/settings (4), Radar value lists & items (5), payment-method configuration create + domain update + review approve (3) |
| native-owns | 122 | incl. the 14 `preferredNative` redirect rows and the 14 flipped Connect rows (§ below) |
| refused-third-party | 22 | identity 4, financial-connections actions 4, three_d_secure 3, climate 3, forwarding 1, payment_records 7 (also 0/7 read-back, named in its reason) |
| refused-session-minting | 9 | account/customer/portal/financial-connections sessions, ephemeral_keys ×2, tokens (reason also names the card-data rule), terminal connection tokens, terminal onboarding links |
| refused-device-action | 8 | Terminal reader actions (below) |
| refused-no-readback | 5 | invoice rendering templates ×2, balance_settings, payment-method-domain validate, Radar payment evaluations — each with its own stated evidence |
| other-unit | 3 | Stripe Apps installs → CAP-3 (recorded in the table so completeness is total; D-9 builds none of CAP-3's work) |
| refused-secret | 2 | `apps/secrets` ×2 — census row 36's boundary |
| refused-ingestion | 2 | meter_events + meter_event_adjustments (decision below) |
| money-adjacent | 2 | customer `balance_transactions` create/update — reason names census rows 20/23/35 and the row-35 card |
| refused-payload-shape | 1 | file upload |

Allow kinds: create 14, update 11, delete 6, action 7, settings 1.

## The Connect accounts-row flip (the card's one stale passage, corrected)

`card-universal-door.md` was written when the 13 `v1/accounts`
rows were OTHER-UNIT and its reason text "must not promise a
date". The date arrived: Connect slices 1–3 are merged. The table
therefore does **not** ship OTHER-UNIT text for those rows; each
carries NATIVE-OWNS with a native-redirect reason naming the
Connect tool, verified against the slice 1–3 tools on main:

| Operation | Disposition | Native tool |
| --- | --- | --- |
| `POST /v1/account_links` | native-owns | connect_create_account_link |
| `POST /v1/accounts` | native-owns | connect_create_account |
| `POST /v1/accounts/{account}` | native-owns | connect_update_account |
| `DELETE /v1/accounts/{account}` | native-owns | connect_delete_account |
| `POST /v1/accounts/{account}/capabilities/{capability}` | native-owns | connect_update_capability |
| `POST /v1/accounts/{account}/external_accounts` | native-owns | connect_create_external_account |
| `POST /v1/accounts/{account}/external_accounts/{id}` | native-owns | connect_update_external_account |
| `DELETE /v1/accounts/{account}/external_accounts/{id}` | native-owns | connect_delete_external_account |
| `POST /v1/accounts/{account}/login_links` | native-owns | connect_create_login_link |
| `POST /v1/accounts/{account}/persons` | native-owns | connect_create_person |
| `POST /v1/accounts/{account}/persons/{person}` | native-owns | connect_update_person |
| `DELETE /v1/accounts/{account}/persons/{person}` | native-owns | connect_delete_person |
| `POST /v1/accounts/{account}/reject` | native-owns | connect_reject_account |
| `POST /v1/accounts/{account}/unreject` | native-owns | connect_unreject_account |

`POST /v1/account_links` flips with them: the frozen card listed
account links under the session-minting class, but slice 2 built
`connect_create_account_link` natively under ruling 5's minting
exception, so the truthful disposition is the native redirect.
The rows with no native counterpart by design are not in this
table because they are not POST/DELETE door operations:
`account_tokens`/`person_tokens` are GET-shaped token reads —
they stay refused under ruling 3(iii) exactly as slices 1–3 left
them; the v2 close is covered-by-design-decision (fork 4).

**Person-GET asymmetry — disposition.** The write rows above now
name the Connect person tools. The person-by-id **GET**
(`GetAccountsAccountPersonsPerson`) is not a table row (the table
is POST/DELETE only) and its door treatment is **unchanged**:
`api_read` still refuses it as a sensitive family, with slice 1's
`connect_get_person` / `connect_list_persons` as the specialized
native readers — the asymmetry the program's notes recorded is
closed on the write side by this flip and retained by design on
the generic read side, because the native reader is the
specialized route. The slice-1 suite's pin of that read refusal
stands unedited; its write-side pin is updated to this flip.

## The meter_events decision (the card's one bounded fork)

**Kept refused**, as an explicit ingestion class, citing E-3.
Meter-event ingestion has no meaningful per-call read-back (the
provider has no GET for a meter event) and its idempotency is by
the event's own `identifier`, not by request. E-3 (PR #274,
merged) already owns this surface natively: `meter_record_usage`
reserves the identifier in a durable account-scoped ledger
*before* ingestion and refuses replays of a reserved identifier.
Admitting the raw operation through the generic door would offer
a strictly weaker idempotency than the native route that exists —
the opposite of this card's direction. The row's reason names
`meter_record_usage`. `meter_event_adjustments` stands in the
same class (it rewrites an ingested event by identifier; no
read-back route exists), also named in its row.

Billing meters/alerts/feedback **configuration** nevertheless
goes generic-allow per derivation §B.2 — the classification of
record — even though E-3 also built curated native shapes for
parts of it (`meter_create`, `alert_create`, …). The door's
contract is not guard-less (preview, confirm, journal, app-
ownership target guard, read-back all apply), and §B.2 was
written with E-3 already merged. The coexistence is recorded
here so a future card can re-decide it on evidence rather than
by accident.

## Machinery notes (what generic-allow needed, nothing more)

The baseline kinds (create/update/delete) cover most allow rows
unchanged. Two classified shapes needed expression, both
table-driven and inert for every other row:

- **action** — a POST to an action segment on an item (alert
  activate/archive/deactivate, meter deactivate/reactivate,
  feedback-option deactivate, review approve). The read and
  read-back target the item path; verify requires the row's
  expected state (`status` / `closed_reason`) from the pinned
  spec's own enums, plus deep body comparison.
- **settings** — a singleton settings object (tax settings).
  Its identity is the account; its pinned `livemode` marker is
  the mode evidence; verify is deep body comparison against the
  re-read settings.

Classified objects whose pinned shape has no metadata surface
(terminal configurations, billing meters/alerts/feedback, tax
registrations/settings, value-list items, payment-method
domains…) record `metadataSurface:false`; the door then runs the
app-ownership check on the object itself instead of refusing for
an absent field the provider never sends. Baseline rows and
metadata-only calls keep the original shallow verify and the
original metadata demand, byte-identically.

Per-row verify data, from pinned-spec evidence: reader create
omits `registration_code` from read-back comparison (the provider
consumes it; it is not a resource field), tax-registration rows
omit `active_from` (the provider resolves `now` to a timestamp),
all new rows omit `expand`. Radar rows carry `previewBody`:
§B.2 requires a value-level preview, and the baseline generic
preview does **not** show the body — so for those two families
only, the summary appends the exact request body (bounded);
every other family's summary is byte-identical.

**Reader registration secret treatment.** The row is classified
secret-bearing (`registration-secret`). Pinned-spec evidence:
the create **response** carries no secret field (the reader
object is id/device/label/location/status); the secret-shaped
value is the request's `registration_code`, a device credential
the provider consumes on use. Treatment, pinned by test: the
code appears in exactly one place ever — the caller's own
confirmed call — and in **no** audit/journal record, **no**
preview, and **no** tool result (the suite scans the full audit
list and both result texts for the code). That is the strongest
form of "shown once, never journaled" the provider's shape
supports; inventing a reveal artifact for a value the provider
never returns would misrepresent the mechanism.

## Drift check

- **Re-derivation at `580fde28` reproduces the census exactly.**
  The card's measured set was taken at `19766344`; re-running
  Lane B's classifier procedure at this baseline yields the same
  partition (307 = 92 + 10 + 205; 14 redirects inside the 205;
  191 effective; 100 with a companion-GET route, 91 without).
  Drift vs the card's 199 claimed rows is **scope only**: +13
  accounts rows (the flip) and +3 Apps install rows (recorded as
  CAP-3's so the completeness test is total over the non-money
  catalog) = the table's 215. No claimed row moved family or
  disposition.
- **Balance settings is the one row-level exception to §B.2's
  lump.** §B.2's last row puts the balance-settings remainder in
  CLASSIFY-AND-ALLOW; the pinned `balance_settings` response
  carries **neither a resource id nor a `livemode` marker**, so
  the guarded contract cannot verify the change or its mode. It
  is refused under no-verifiable-read-back with that evidence
  stated in the row — the card's own rule ("no read-back, no
  admission") governs the row. Tax settings, the other singleton,
  carries `livemode` and is admitted as the settings kind.
- **Terminal reader actions are a named refusal class, not
  terminal config.** §B.2's ALLOW case for Terminal is
  "locations/readers/configurations" — device config and reader
  registration. The 8 reader action operations act on in-flight
  payment/setup flows through a physical device; their outcome
  lives on the payment/setup intent (payments family), not on
  the reader, so no read-back of the reader can verify them.
  They refuse as device-action class. Connection tokens and
  onboarding links refuse as session/secret-minting (the token
  response literally carries a `secret`).
- **Baseline validator quirk, observed and unchanged.** At this
  pinned version, several update fields (terminal location
  `display_name`, reader `label`, …) are `anyOf` two string
  branches, which the pinned validator's union rule rejects as
  ambiguous for **any** string value — at baseline too (the
  refusal happens in request validation, before any policy).
  Object-bodied updates of the same operations work. D-9 does
  not touch the validator; the E2E update legs use the shapes
  that complete, and say so in their comments.
- **`create_preview` and the invoice actions** are native-owns
  (billing lifecycle): the door stays a redirect for the whole
  invoice surface, per §B.2.

## Tests and honest baseline accounting

New suite `tests/unit/cap4-d9-universal-door.test.js` (24 tests):

- **Table completeness/drift:** the exact partition (307 = 92 +
  215); exactly one row per non-money operation and every row a
  real pinned operation; every row names ownership/cost/secret/
  read-back/disposition; every allow row's read-back template
  exists as a pinned GET; the 14 redirect rows name exactly
  `preferredNative`'s tool; the old generic reason is **absent**
  from every refusal across all 307 operations under both
  moneyLike settings; the 92 financial refusals are
  byte-identical to baseline.
- **Classifier behavior per class:** one case per kind and per
  refusal class (native-owns, money-adjacent, session-minting,
  secret, third-party incl. payment_records' 0/7, payload-shape,
  no-read-back, device-action, ingestion, other-unit), plus the
  baseline whitelist outputs pinned byte-identically and the
  metadata-only route pinned on a native-owned surface.
- **Terminal end-to-end (the proof family):** location
  create/update/delete, reader create (registration-code
  journal/result absence proven), reader update/delete,
  configuration create/update/delete — preview → confirm →
  read-back in TEST through `api_write`; plus classified
  refusals through `api_write` proving zero provider calls.
- **Action/settings legs:** alert activate (expected-state
  read-back) and tax settings update (singleton read-back).

**Baseline accounting.** Against pristine `580fde28` both the
new suite and the updated slice-1 suite fail at import (the
table module does not exist — capability missing wholesale).
Against baseline + table data only (no policy/door changes), 14
of the new suite's 24 tests fail as **behavior** (every class
reason, every new allow, the reader/configuration/action/
settings legs) and 10 pass — each a data or baseline pin, named:
the 5 drift tests (the data describes the baseline catalog),
the financial byte-identical pin, the whitelist byte-identical
pin, the metadata-route pin, the `companionGet` pin, and the
location E2E (baseline whitelist behavior, already working).
The slice-1 flip test likewise fails as behavior at baseline +
data. Full unit suite on the final tree: **214 files / 2,394
tests green** (baseline 213 / 2,370; +1 file, +24 tests);
`npm run check` green. Verification ran on this VM (the standing
declared deviation for this program's builds), TMPDIR under
`~/workspace`; database proof is not applicable to this unit and
rides exact-head CI as usual.

## Registry, listing and budget treatment

No tools are added or removed: the registry stands at **343
tools, 169 writes**. `api_write`'s own description is unchanged
(it was already true: "financial and ownership gates remain
independent"), so the everyday catalog budget stands unmoved at
**19,999 / 20,000**. TOOL-CATALOG's `api_write` passage is
updated to name the classification table and the admitted
families, per the docs check.

## Untouched, on purpose

- The financial branch (92 rows): reason and route byte-
  identical, regression-pinned.
- The metadata-only-update and whitelist paths' behavior:
  regression-pinned byte-identically at the classifier, and the
  original universal suite passes unedited.
- The Connect rows' generic metadata route: a metadata-only POST
  to an accounts operation still takes the preserved metadata
  branch (baseline behavior; the card puts that path out of
  scope) — the flip governs classified write calls.
- Every native family's internals; the money wiring
  (`src/tools/write.js`, `src/money.js`, `src/db.js`); the
  read door (`api_read`'s sensitive-family screen included).
- The v2 close: not a door row (v2 surface); its
  covered-by-design-decision stands as slice 3 recorded it.

## CAP-5 queue addition

The door rows for one generic-allow family (Terminal: location
and reader lifecycle on the testing surface) and a sample of
reworded refusals (one per refusal class) join the CAP-5
acceptance queue, per the frozen card's Done-when.
