# Batch G-3 acceptance and G-4 handoff — 2026-10-11
Status: CLOSED by documentation PR #102 (as-if-merged; verify exact-head CI).
Base main 497973c0c5d28b8c6281a19131eeba338fe6a077 with #101 merged. No deployed Stripe connection/TEST smoke.
Approved scope: docs/designs/BATCH-G.md §4 G-3 and docs/pr-cards/G-3.md.
## Required drift checklist C
- Scope: G-3a six Radar safe reads (#97); G-3b review approval/value-list creation (#98);
  G-3c list/item add/remove/delete lifecycle (#99); G-3d two Identity private reads and
  guarded hosted session creation (#100); G-3e independently confirmed cancel/redact (#101).
  Result: 11 Radar + 5 Identity = **16** tools. Catalog count 18 after #101
  overcounted two pre-existing names, corrected in this closure.
- Native provider behavior: Radar rules CRUD intentionally omitted after pinned-reference
  check; owner Dashboard guidance is not provider rules mutation.
  Identity cancel is input-pending-only; redaction independently confirmed as processing or
  redacted, not equated with immediate erasure.
- Automated fixtures: tests/unit/radar-reads.test.js, radar-writes.test.js,
  radar-list-lifecycle.test.js, identity-sessions.test.js, identity-lifecycle.test.js;
  tests/mock corresponding G-3 native SDK request-shape suites;
  tests/unit/registry.test.js, profiles.test.js and app-guard.test.js.
- Acceptance: PRs #97/#98/#99/#100/#101 all merged as verified through GitHub.
  #101 exact head 6697601c8ec77c14bc0c942e7f232525d698f1bd:
  check, unit, mock, db and ci all succeeded. Earlier PRs approved per their merge
  gates; no missing review threads reported for #101.
- Remaining external smoke: actual Stripe TEST-key permission/feature probing;
  hosted Identity session completion and server/account real request evidence;
  earlier V-3/V-4/V-5 and G-1/G-2 connected TEST scenarios. These are NOT
  represented as passed and do not authorize LIVE or any actual money movement.
- Security: all G-3 writes use defineWrite with preview/confirm, stable idempotency,
  app target protection, full profile restrictions and readback. Provider private
  values never enter tool outputs; independently authenticated owner consent and
  shared $500 per-account per Colorado day cap plus above-cap override remain unchanged.
- G-4 start verification: Stripe native events.list supports delivery_success boolean
  (GET /v1/events); events are at most 30 days old; historical Event data is versioned,
  so event reads must whitelist fields and not return data.object raw. Native
  webhookEndpoint.list/retrieve does not return signing secret; create can show once,
  and its one-time value MUST go only to the authenticated private setup page.
  Existing V-4 dev forwarding is distinct from G-4 native Stripe endpoint management.
## Next authorized JIT slice
Write G-4 parent and G-4a cards from approved Batch G; implement read-only
event_list/event_get/event_list_undelivered with safe fields, TEST guards,
bounded cursor and privacy sentinel fixtures; then webhook safe reads;
then independently guarded endpoint creation and private one-time secret
handoff. Do not prewrite distant cards or require a new owner decision for
safe reads. Reconcile index/STATUS and local code before first edit.
