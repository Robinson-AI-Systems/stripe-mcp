# CAP4-D7B-KEY-PROBE-PER-MODE — the key-permission probe, per mode

Status: **SOURCE-IMPLEMENTED.** Follow-up card CAP4-D7b, split out
of D-7 by the coordinator's probe-split ruling (2026-11-04) and
sequenced after D-8 §B, before D-9. Baseline: `main`
`55e2aacd2f15f927b7763d2bc8421806730ec3d6` (PR #335, D-8 §B).
This PR is schema-bearing by design — the ruling put the migration
in scope because per-mode truthfulness is impossible on the
baseline's shared record. The registry stays 329 tools, writes
still 155; money wiring (`src/tools/write.js`, `src/money.js`) is
byte-untouched, and `src/db.js` changes only on the probe's own
persistence surface (named below).

## The defect, restated from the code (not the card's shorthand)

`stripe_check_key_permissions` re-probes the enrolled key's
read permissions and persists the result. At baseline every layer
was TEST-shaped: the handler refused non-TEST connections, the
service (`src/keys.js` `createPermissionReprobe`) hard-required
`mode === 'test'`, and persistence (`db.updateKeyPermissions`)
matched `test_key_enc` and wrote the **single shared**
`key_permissions` / `key_checked_at` columns on the account row.
One premise in the commissioning card needs correcting on the
record: it names `stripe_whoami` as the surface that reports those
columns for either mode. At baseline whoami does **not** include
the probe record in its payload at all, and `key_checked_at` is
written but read nowhere (`getStripeAccount` does not even select
it). The mode-blindness is nonetheless real — it lives in the
stored record itself and in the probe's persistence: any reader of
the account row for a LIVE connection would be handed the TEST
probe's data, and a LIVE probe cannot persist at all. D7b fixes
the record, the service, the handler, and — to make the bar's
reporting clause literally true — whoami now surfaces the
connection mode's own stored record as `keyPermissions` /
`keyCheckedAt` (nulls when that mode was never probed).

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| whoami reports the shared columns for either mode (commissioning card) | whoami's payload carries no probe fields; `key_checked_at` is selected nowhere | Record split per mode **and** whoami gains the mode's own record as two additive fields; TEST values come from the untouched baseline columns |
| The persistence question is per-mode columns vs mode-keyed rows vs a non-persisting LIVE probe (the ruling's three options) | `stripe_accounts` already models per-mode state as column pairs (`test_key_enc`/`live_key_enc`, kinds, last4s) on one row per account | Per-mode columns, following the table's own pattern (design below) |
| A data migration must move or split existing values | The shared columns were only ever written by TEST-matched writers (`saveTestKey`'s enrollment probe and the TEST-only `updateKeyPermissions`) | No data movement: the existing columns **are** the TEST record by construction; the LIVE columns start NULL = never probed |
| The enrolled-key lookup needs mode work | `keyStore.loadKeySnapshot({account, mode})` is already mode-aware and production-gated for LIVE; `db.getEncryptedKey` already selects the mode's ciphertext column | Untouched; the LIVE probe inherits the production gate exactly (no fallback) |
| `admin_review_security`'s probe section needs conversion | D-7 already made `safeProbe` require the probe result's mode to equal the connection mode | Untouched; the section lights up on LIVE unchanged once the handler serves LIVE |

## Design chosen, and what was rejected

**Per-mode columns (chosen).** `live_key_permissions JSONB` and
`live_key_checked_at TIMESTAMPTZ` join `stripe_accounts`, added
the repo's way: present in the `CREATE TABLE IF NOT EXISTS` for
fresh databases and via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
in `initSchema()` for existing ones (AGENTS.md: database changes
are additive). The baseline `key_permissions` / `key_checked_at`
keep their names and become, by definition, the TEST mode's
record — so every existing reader of the TEST record reads
byte-identical data, and the forward-truth argument needs no
backfill: there is no row in any database whose shared record was
written by a LIVE probe, because writing one was impossible.

**Rejected — mode-keyed rows / a separate probe table.** The
account row is the unit every consumer already reads
(`getStripeAccount` has ~25 call sites); a separate table would
add a join or a second query to the whoami path and a new store
surface for what is two values per mode, against the table's own
established per-mode column-pair pattern.

**Rejected — a non-persisting LIVE probe.** It would leave the
stored record mode-blind (the next reader of the row still gets
TEST data under a LIVE connection) and whoami could never report
a LIVE record; the ruling's bar is per-mode truthfulness of the
record, not only of the fresh result.

## The conversion

- **`src/db.js` — persistence surface only.** `updateKeyPermissions`
  gains a `mode` parameter (default `'test'`, so the existing db
  suite's calls are unchanged). The TEST branch is the baseline
  statement verbatim. The LIVE branch writes the LIVE columns
  `WHERE id = … AND live_key_enc = expectedCiphertext AND
  live_enabled = TRUE` — the same enablement gate `getEncryptedKey`
  applies to LIVE reads, so a probe result can only land against
  the exact enrolled LIVE key of a LIVE-enabled account.
  `getStripeAccount` additionally selects `key_checked_at` and the
  LIVE pair (additive row fields; `key_permissions` keeps its
  baseline meaning). `saveTestKey` is unchanged — its enrollment
  probe writes the TEST record, as before. Nothing else in db.js
  moves.
- **`src/keys.js` — the reprobe service.** Both modes accepted;
  the snapshot load, client construction and identity verification
  follow the requested mode (`readVerifiedTestAccount` /
  `readVerifiedLiveAccount` — the latter demands affirmative LIVE
  evidence from two provider facts). Error texts substitute the
  mode word, so TEST texts stay byte-identical where tests pin
  them and LIVE texts are truthful. A LIVE snapshot load still
  hits the key store's production gate outside an activated
  production deployment and refuses there — it never falls back
  to the TEST key. The return is `{account, mode, permissions,
  checkedAt}` in the probed mode.
- **`src/tools/server.js` — handler and whoami.** The handler
  accepts a configured connection of either mode, passes
  `connection.mode` to the service (baseline hardcoded `'test'`),
  and labels its source `Fresh TEST|LIVE key read-only Stripe
  probes` by mode. The gate refusal — the D-7-deferred text
  correction — now reads "Only a configured TEST or LIVE account
  with server-side key access may be checked" in both modes.
  whoami adds `keyPermissions` / `keyCheckedAt` taken from the
  connection mode's own columns, timestamps normalized to ISO,
  absent or unparseable stored values reported as null
  (never probed). whoami's description is unchanged.
- **`test/helpers/fake-db.js`** mirrors the real store: per-mode
  records on the fake's key entries, `checkedAt` stamped from the
  fake clock, the LIVE branch gated on the fake row's
  `live_enabled`, and `saveLiveKey` preserving an existing LIVE
  probe record across a key rotation (as the real `saveLiveKey`,
  which never touches the permission columns).

## Consumer audit — every reader of the probe record, by name

| Consumer | Baseline use of the shared columns | After D7b |
| --- | --- | --- |
| `src/db.js` `saveTestKey` | Writes both columns with the enrollment probe (TEST) | Unchanged — that write **is** the TEST record |
| `src/db.js` `updateKeyPermissions` | TEST-matched write of both columns | Mode parameter; TEST branch verbatim, LIVE branch per above |
| `src/db.js` `getStripeAccount` | Selects `key_permissions` (not `key_checked_at`) | Also selects `key_checked_at` + the LIVE pair; `key_permissions` meaning unchanged |
| `src/keys.js` `createPermissionReprobe` | Invokes the write after a TEST probe | Converted (above) |
| `src/tools/server.js` `stripe_check_key_permissions` | Fresh probe result is the reporting surface | Converted (above) |
| `src/tools/server.js` `stripe_whoami` | Reads the row; surfaces no probe fields | Surfaces the mode's own record (above) |
| `src/tools/admin-security.js` (`safeProbe`, `admin_review_security`) | Re-runs the probe in-mode; re-validates result mode (D-7) | Untouched; LIVE section now observes instead of `not_readable` |
| All other `getStripeAccount` callers — `src/core/mcp-auth.js`, `src/core/rtc-passes.js`, `src/core/k3-mcp-auth-seams.js`, `src/core/k3-oauth-protocol-seams.js`, `src/core/oauth-handlers.js`, `src/core/rtc-http.js`, `src/stripe/provider.js`, `src/stripe/report-download.js`, `src/stripe/setup-page.js`, `src/tools/access.js`, `src/tools/account-mode.js`, `src/tools/live-guard.js`, `src/webhooks/signa
...[truncated 4756 chars]