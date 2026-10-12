# R-4e — Legacy RTC pass indirect delegation isolation (#175)
Status: MERGED (#175) as-if; review threads and seven exact-head checks required.
Baseline: 0ce99d05b80da72c1587910e2f8f21169bd9d5d3, stacked after #174 decimal pagination.
Drift A: R-3a denied indirect MCP meta handlers only for area-scoped passes, while legacy NULL-areas TEST passes still entered profile-level delegates. A read-only MCP delegate can bypass the HTTP safeRead money or indirect-scope checks.
Implementation: enforce explicit all-pass DELEGATES exclusion from HTTPS discovery, describe, direct calls and batch; keep native RTC direct read routes and standalone /api/mcp metatools unchanged.
Tests: fake DB adversarial meta handlers never run; safe account GET succeeds. Genuine localhost HTTP with isolated PostgreSQL legacy pass verifies direct whoami, catalog, denied meta calls and denied indirect batch.
Decision: docs/DECISIONS.md dated security amendment; STATUS as-if merged.
No LIVE, money-out, provider payment read, Stripe writes or manual Production; actual Hub D-4/OAuth/webhook acceptance pending.
