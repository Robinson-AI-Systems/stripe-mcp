# GUARD-EVENING-BLOCK — the promotion guard's pinned times move to the evening block (2026-11-05)

## Authorization

Owner decision, Chris, 2026-11-05 ~10:37 MST (option (a), taken through
the fleet-audit coordination): **Stripe Unleashed by Robinson AI Systems
joins the fleet's evening promotion block.** GitHub's scheduler has been
delivering this fleet's timed events roughly 7–8¼ hours late, so the
fleet moved its promotion blocks out of the midnight hour — GitHub
Unleashed 20:07, Workspace Unleashed 20:19, Vercel Unleashed 20:23, Neon
Unleashed 20:41 America/Denver, all landed and read back. Stripe's move
was held on 2026-11-04 because this repo's schedule is pinned inside
the fail-closed hosting-release policy guard
(`scripts/validate-hosting-release.mjs`): the workflow and the guard
must move together or CI refuses. This card is that pinned-times
amendment, carried as a guard change in its own right, with the
owner's name on it.

This is a guard change and nothing else. The guard's strictness is
unchanged — only its pinned times move. Promotion logic, the six
exact-head checks, receipts and markers, the owner-ordered route and
the missed-daily recovery route are all untouched.

## The amendment — the whole block re-based, spacing preserved (+20h52)

The same +20h52 shift the other fleet repos applied:

| Was | Is now | Cron was | Cron is now |
|---|---|---|---|
| 00:01 America/Denver (primary) | **20:53 America/Denver** | `1 0 * * *` | `53 20 * * *` |
| 00:17 America/Denver | **21:09 America/Denver** | `17 0 * * *` | `9 21 * * *` |
| 01:17 America/Denver | **22:09 America/Denver** | `17 1 * * *` | `9 22 * * *` |
| 05:37 America/Denver | **02:29 America/Denver, following Denver day** | `37 5 * * *` | `29 2 * * *` |
| 12:43 UTC (plain backup) | **09:35 UTC, following day** | `43 12 * * *` | `35 9 * * *` |

The four Denver entries keep `timezone: America/Denver`; the backup
stays a plain UTC cron with no timezone line, exactly as before.

## Every pinned-time spot found (guard read end to end)

1. **`.github/workflows/promote-live.yml`** — the five schedule crons
   and the two schedule comments ("Owner schedule: 00:01 Denver" and
   "Primary Denver midnight release").
2. **`scripts/validate-hosting-release.mjs`** — the `approvedCrons`
   list (the four Denver crons) and the UTC-backup row check
   (`rows[8]`).
3. **`tests/unit/hosting-release-policy.test.js`** — the guard-test
   fixtures that name the primary cron: the retime mutation, the
   duplicate-cron insertion, the schedule key-ordering fixture and the
   inline-list fixture, all re-based to `53 20 * * *`.
4. **`scripts/promote-live.test.mjs`** — found beyond the two spots
   named in advance, and in scope by the same logic: the
   `deepEqual` assertion on the workflow's exact cron list, and the
   mutation fixtures in the "unexpected schedules" test that replace
   the second cron and remove/re-anchor the UTC-backup line. Its
   schedule test is renamed from "preserve midnight" to "preserve the
   evening block" (the daily-marker and owner-recovery assertions are
   unchanged). The inserted extra-cron fixture `37 0 * * *` is a
   deliberately-invalid extra, not a pinned time, and is unchanged.
5. **Current policy documents** — `docs/DAILY-PRODUCTION-PROMOTION.md`
   (the full five-time sentence, updated with the following-day
   landings stated and the reason recorded) and
   `docs/HOSTING-COST-POLICY.md` (the 00:01 mention; "same-night"
   becomes "same-block").

Deliberately **not** changed, and why:

- **Historical records keep their dates.** `docs/pr-cards/MIDNIGHT-RELEASE.md`
  and the dated STATUS entries of 2026-10-13/14 record what the owner
  ordered and what happened then; they are history, not current policy
  statements, and are not rewritten.
- **The elapsed-midnight rule is recovery semantics, not a schedule
  time.** It appears in `scripts/promote-live.mjs`, its tests, the
  OWNER-RELEASE-ROUTE card and `docs/DAILY-PRODUCTION-PROMOTION.md`'s
  owner-route passage. The recovery route is out of scope for this
  amendment and every one of those lines is untouched.
- **`docs/RAS-MCP-CONFORMANCE.md`** names no schedule times — no
  conformance line moves.
- **`docs/COMPLETION.md`** carries no promotion-schedule passage (the
  OWNER-RELEASE-ROUTE precedent, PR #333, added none either); a
  schedule-time amendment changes no completion claim, so its
  conventions call for no passage here.

## Registration

Unlike OWNER-RELEASE-ROUTE — which was deliberately left unregistered
with registration named as the coordinator's call — this unit is
registered in `docs/pr-cards/work-index.json` as its own card
(batch CAP, design `docs/HOSTING-COST-POLICY.md`), and
`GUARD-EVENING-BLOCK` is added to `REQUIRED_UNITS` in
`docs/pr-cards/validate-index.py`, the deliberate route that validator
documents for intentional scope changes.

## Proof

- Baseline: `main` at `77c7dc248e1dc9b38ccd6297d958475ea095d1d5`
  (CAP-4 closeout, PR #348). The guard suite was green at baseline
  (9/9) before any edit, so the post-change green is a real
  before/after.
- Guard suite `tests/unit/hosting-release-policy.test.js`: **9/9
  passed** on the final tree. (Its first test also runs the promoter's
  own suite, `scripts/promote-live.test.mjs`, which independently
  passes **14/14** by `node --test`.)
- `node scripts/validate-hosting-release.mjs` on the final tree:
  "Release policy: live-only, checked daily promotion" — the guard
  accepts the moved workflow, and its mutation fixtures prove it still
  refuses retimed, duplicated, reordered-malformed, inline and extra
  schedules exactly as before.
- Full unit suite and `npm run check`: green on the final tree
  (counts recorded in the PR body).
- Diff discipline: the diff touches only times, time fixtures, the
  two policy documents' schedule wording, and these records. No other
  guard behavior, threshold or policy moves.

## Drift check

Read fresh at `main` `77c7dc24` before building (2026-11-05): the
repo `AGENTS.md`, `.github/workflows/promote-live.yml`,
`scripts/validate-hosting-release.mjs`,
`scripts/promote-live.mjs` and `scripts/promote-live.test.mjs`,
`tests/unit/hosting-release-policy.test.js`,
`docs/DAILY-PRODUCTION-PROMOTION.md`, `docs/HOSTING-COST-POLICY.md`,
`docs/STATUS.md` head, `docs/pr-cards/work-index.json` and
`docs/pr-cards/validate-index.py`. No drift from the scope above: the
guard, workflow and fixtures agreed on the old block at baseline, and
every pinned spot found is listed above. Verification ran on the
coordinator's VM (declared deviation from bench-first; the decisive
proof is exact-head CI, as with the earlier CAP-4 families). Local git
auth had expired at build time; publication is the coordinator's
re-minted push, and after merging the coordinator reads the new block
back on `main`.
