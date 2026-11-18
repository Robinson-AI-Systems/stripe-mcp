# MAP-COUNTS-1: the relational map's numbers are checked against the code

## Owner request 2026-11-18

Chris: "Yes" to dealing with the Second Shift 48-hour run's relational-map findings (here: findings 10, 18, 19 and 20 on PR #358).

## Outcome and acceptance

- `scripts/check-map-counts.mjs` (the same dependency-free file across the fleet repos) reads `docs/relational-map/counts.json`, computes each stated count from the code at this commit, and fails if a value differs, a listed map file does not state it, or the map states a "<n> tools/modules/tables/operations…" count (or a "~" approximation) the file does not list. It runs in `npm run check`.
- Checked counts: tool modules 119 (`src/tools/*.js`), store tables 35 (`SCHEMA_TABLES.length`), pinned operations 644 / 612 v1 / 32 v2 (`scripts/unified-capability-report.mjs`). All correct today.
- The rack-hosting claim keeps its `docs/STATUS.md` 2026-11-08 citation and gains a live re-check (rack route table and release receipt; no stripe-mcp project left in the Vercel team).

## Drift check

Docs and a check only; no tool or behaviour change.
