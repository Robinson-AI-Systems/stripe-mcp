# CI-SPEED — re-optimization under the owner's fast-CI rule (2026-11-03)

Owner rule: CI is the checker and must be fast — **target 30 s per run, hard cap
60 s**; three runs over the cap trigger a re-optimization. A slow-but-green run
still passes; the cap drives optimization, never rejection, and **coverage never
weakens**. This card records the measurement, the changes it indicts, and an
honest floor calculation. It completes no predefined batch subsection.

## Measured before-state (GitHub-hosted runs, 2026-11-04)

Run wall clocks, last 13 completed `ci` runs (runs 1137–1149, PR and main):
**60–96 s, median ≈ 75 s** — every one over the 60 s cap.

Per-job durations (started→completed) across runs 1145/1147/1148/1149, and the
test-phase seconds printed by `scripts/ci-phase.mjs` in run 1148's job logs:

| Job | Job total | Setup + services (derived) | Test phase (run 1148) |
|---|---|---|---|
| core-adoption | 62–74 s | ~31 s | 30.77 s |
| unit | 33–50 s | ~11 s | 33.66 s |
| db | 39–45 s | ~21–24 s | 20.63 s |
| rtc-service | 25–29 s | ~24 s | 1.22 s (14 probe groups, in-process) |
| mock | 20–27 s | ~10 s | small (69 files) |
| check | 17–23 s | all | — |
| rtc-reference | 9–12 s | all | — |
| ci aggregate | 2–4 s | starts after last job | — |

Plus ~4 s of queue time before the first job starts. A run's wall clock is
therefore ≈ 4 s queue + longest job + ~7 s aggregate tail.

Local cross-check on this VM (slower, shared; proportions only): unit suite
189 files / 1,910 tests, vitest duration breakdown import 75 %, tests 14 % —
the suite is import-bound (432 modules re-evaluated per isolated test file),
so splitting by file divides the phase near-linearly. DB suite: 45 files /
168 tests, per-file isolated schemas (`openIsolatedSchema`), files run
serially (`fileParallelism: false`).

## Long poles the measurement indicts

1. **core-adoption setup (~31 s):** two checkouts, two `setup-node` steps and
   two `npm ci` installs — the second (the pinned K-3 candidate repo) with
   **no npm cache at all**. Its 30.77 s phase is real re-verification (original
   unit + DB suites re-run against the private core) and is not cut.
2. **unit phase (33.66 s):** the whole 1,910-test suite in one job.
3. **db phase (20.63 s):** the whole 45-file DB suite in one job; its setup
   (~21–24 s, incl. the Postgres service) then dominates the sharded job.

## Changes (each tied to a measurement above)

- **unit → 3 matrix shards** (`--shard=i/3`, `fail-fast: false`). Import-bound
  work partitions by file; projected phase ≈ 12–15 s, job ≈ 23–26 s.
- **db → 2 matrix shards** (`--shard=i/2`, `fail-fast: false`), each leg with
  its own Postgres service. Within-leg execution is byte-identical to today
  (same config, serial files, isolated schemas); projected phase ≈ 11 s,
  job ≈ 33–35 s.
- **core-adoption:** the candidate repo's `setup-node` gains
  `cache: npm` with `cache-dependency-path: k3-candidate/package-lock.json`
  (the main repo install was already cached). Projected saving ≈ 7–12 s of
  setup; job ≈ 50–55 s.
- **Topology guard** (`scripts/check-ci-layout.mjs`): the policy gains
  `matrices: { unit: 3, db: 2 }`, so the guard now *requires* these cohorts to
  stay sharded — its existing anti-collapse check (fail-fast false, ≥N shard
  values, no serializing max-parallel) becomes active for both.
- Untouched: the `ci` aggregate and `target-main` contexts (names and meaning),
  every test, every assertion, the 180 s phase budgets, all timeouts, and what
  `npm run check` verifies. Vitest's `isolate: false` hint (~6 s on the
  unsharded run) was **rejected**: it changes test-isolation semantics for a
  smaller saving than sharding, which keeps isolation intact.

Projected run wall clock after: ≈ 4 s queue + ~52 s longest job
(core-adoption) + ~7 s tail ≈ **58–63 s** — at the cap, a ~15–30 s improvement
on every recent run. **Projection, not proof:** only the first real runs at the
merged head settle it.

## Partition proof (local, executed on this tree)

Unit shards, run with the exact CI command form (`npm test -- --shard=i/3`):
shard 1 — 63 files / 694 tests passed; shard 2 — 63 files / 574 passed;
shard 3 — 63 files / 642 passed. **Sum: 189 files / 1,910 tests — exactly the
unsharded totals**, and the unsharded suite re-run on this same tree is green
at 189 files / 1,910 tests. Vitest partitions by file, so the shard file sets
are disjoint by construction and the totals confirm it empirically.

DB shards, run locally against a throwaway Postgres
(`npm run test:db -- --shard=i/2`): shard 1 — 23 files / 90 tests (88 passed,
2 skipped); shard 2 — 22 files / 78 passed. **Sum: 45 files / 168 tests —
exactly the unsharded totals (166 passed, 2 skipped).** One local-only
artifact: `tests/db/k3-write-owner-sql.test.js` refuses to run unless
`TEST_DATABASE_URL`'s hostname is `127.0.0.1`; the local runner script uses a
socket URL, so that file fails at setup locally in both sharded and unsharded
runs, while CI (whose URL is `127.0.0.1`) runs it green — as it did in every
measured baseline run. `npm run check` exits 0 on this tree, the topology
guard accepts the new layout, its shard anti-collapse test is now active for
unit and db and passes, and the hosting-release validator still passes.

Declared local limits: the stripe-mock suite could not be timed on this VM
(the mock binary runs standalone, but the scripted readiness probe fails in
this sandbox's proxy environment; CI proves the suite in 20–27 s per run) —
mock is not a long pole and is unchanged.

## Honest floor and verdict on the caps

Fixed, irreducible costs per run on GitHub-hosted runners: ~4 s queue +
~7 s aggregate tail + per-job setup (~11 s minimum: checkout, Node, cached
`npm ci`). The single longest remaining phase is core-adoption's ~31 s of
genuine re-verification, on top of ~20 s of two-repo setup even when both
installs are cached — a **floor of ≈ 60 s for the whole run** with the current
gate contents. The **60 s cap is therefore borderline-reachable** (met on a
good runner day, missed on a slow one), and the **30 s target is not reachable**
without structural change: larger/faster runners, or moving part of the gate
(e.g. the K-3 rehearsal's re-run suites, or the DB suite) out of the per-PR
path — which changes what the gate verifies and is the owner's decision, never
a silent optimization. This verdict is information for the owner; it is not a
reason to cut a single test.
