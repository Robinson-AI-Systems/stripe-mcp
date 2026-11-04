# OWNER-RELEASE-ROUTE — owner-ordered releases beside the daily promotion (2026-11-04)

Owner rule (fleet-wide, recorded in `AGENTS.md`, 2026-11-04): every project
gets exactly one automatic release per day, and that cap binds the automatic
route only. Every additional release requires the owner's authority — granted
in advance with conditions, in the moment, or by any scheme he specifies —
and release machinery must encode his permission scheme, never its own
numeric cap on owner-ordered releases. Standing advance grants already on
record (qualifying findings batches, genuinely critical updates, genuine
fleet-wide exhaustion) are instances of the advance-conditional form.

The gap in this repo: the checked promoter made a second same-day promotion
impossible for anyone, owner included. Once the day's
`live-promotion/<Denver day>` marker exists, every path through
`scripts/promote-live.mjs` stands down, and the only manual path was
missed-daily recovery, which by design also refuses once the day is
consumed. The owner's order therefore had no route. This card builds it. It
completes no predefined batch subsection and is deliberately not registered
in `work-index.json`; registering an acceptance unit for release machinery
is the coordinator's call.

## Design

- **Dispatch.** A second `workflow_dispatch` input on the existing Daily
  live promotion workflow: `owner_release` (boolean, required false,
  default false). The schedule, the recovery input, the concurrency group
  and the permissions are unchanged.
- **Gate.** The job condition and the promoter both require the actor and
  the triggering actor to be `christcr2012` with `owner_release` true
  (`isOwnerReleaseInvocation` in `scripts/promote-live.mjs`). A non-owner
  dispatch carrying `owner_release` never starts the job, and the promoter
  itself refuses closed with the same error shape as any unauthorized
  invocation. No time-of-day condition gates the route: the
  elapsed-midnight rule stays a property of missed-daily recovery only.
- **Identical checks.** The owner path runs the same promotion: the six
  required exact-head checks (`check`, `unit`, `db`, `mock`,
  `rtc-reference`, `ci`) green at the exact main head, live a strict
  ancestor (fast-forward only), branch-moved re-checks before the push,
  atomic push, and post-push read-back. Failing checks refuse, pending
  checks wait out the same ten-minute window, a diverged live refuses.
- **Its own receipt.** The owner path never consumes, writes or deletes the
  daily marker. Each owner-ordered release pushes its own durable receipt,
  `owner-release/<Denver day>-<main short SHA>`, atomically with the live
  advance. A re-run at the same head finds its receipt and no-ops; a later
  owner release of a newer head writes a second receipt. If the ordered
  head is already live (for example the day's automatic promotion carried
  it first), the run records the owner receipt without moving live and
  without touching the daily marker.
- **Automatic path unchanged.** Absent the owner input, every decision,
  receipt and refusal is exactly as before; the pre-existing tests pin that
  behavior and pass unedited.
- **Policy pin.** `scripts/validate-hosting-release.mjs` now pins the
  two-input dispatch block and both owner-gated dispatch clauses exactly.
  Unguarding either input — dropping an actor check, hard-coding an env
  value, weakening a description — fails CI's release-policy check.

## Changes

- `.github/workflows/promote-live.yml` — `owner_release` input, owner
  clause in the job gate, `OWNER_RELEASE` env on the promotion step.
- `scripts/promote-live.mjs` — `isOwnerReleaseInvocation`,
  `ownerReleaseMarker`, the owner branch of `authorizedReleaseInvocation`,
  and the owner mode of `run()` (per-head receipt, no daily-marker reads
  or writes deciding the outcome, already-live receipt recording).
- `scripts/validate-hosting-release.mjs` — the pinned dispatch block and
  job gate now cover both owner routes; the pinned refusal text is
  unchanged (`tests/unit/hosting-release-policy.test.js` contains it
  verbatim).
- `scripts/promote-live.test.mjs` — four tests appended; the ten
  pre-existing tests are byte-identical.
- `docs/DAILY-PRODUCTION-PROMOTION.md` — the route recorded beside the
  daily promotion design.
- `docs/STATUS.md` — dated entry for this card.

## Proof (local, at the PR head's tree)

- `node --test scripts/promote-live.test.mjs`: 14 tests, 14 pass — the 10
  pre-existing tests unedited, plus owner authorization (including the
  no-time-gate pin at exact Denver midnight, where recovery refuses),
  workflow shape, hosting-policy mutations of the owner clause, and a
  real-git end-to-end run: a consumed daily marker stands the automatic
  path down while the owner path promotes past it and writes only its own
  receipt; a non-owner owner-dispatch refuses; a re-run no-ops; failing
  and pending checks refuse without moving live; a diverged live refuses
  with no receipt written.
- `node scripts/validate-hosting-release.mjs`: exit 0.
- Live proof is deliberately not in this card: the PR stops for the Stripe
  coordinator's review, and the first owner-ordered release through the
  merged route is the coordinator's to schedule.

## Drift check

Read fresh at `main` `2688228f` before building (2026-11-04): the promotion
workflow, `scripts/promote-live.mjs`, `scripts/promote-live.test.mjs`,
`scripts/validate-hosting-release.mjs`, `docs/DAILY-PRODUCTION-PROMOTION.md`,
`docs/STATUS.md` head, `docs/pr-cards/work-index.json` and
`docs/pr-cards/validate-index.py`. No drift from the design above: the
machinery matched the documented fleet pattern (daily marker consumed
atomically with the live advance; recovery the only dispatch; the hosting
validator pinning the workflow's exact dispatch text). `docs/COMPLETION.md`
was read for its release rows only and is not modified.
