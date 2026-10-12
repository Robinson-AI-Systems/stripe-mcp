# R-4a — RTC batch-unit rate enforcement (PR #171)
Status: MERGED (#171) as-if; seven exact-head checks and review resolution required.
Baseline: 2c110c339a31b7304858861629c2f4496942bd2e; #170 preflights all batch arguments.
Drift A: one atomic rate unit was charged per HTTP batch, even when it ran ten provider reads. The documented 120/min budget therefore permitted 1200 reads.
Implementation: charge 1–10 atomic PostgreSQL rate units before dispatch; fake DB has matching semantics; malformed batch pays one unit and fails validation. No SQL migration.
Tests: 12 ten-read HTTP requests accepted and #13 refused; 13 concurrent ten-unit reservations across two PostgreSQL clients accept exactly 12; reject malformed unit costs.
Drift B: STATUS reconciled, no new APIs or owner steps. External TEST provider, Toolkit Hub authenticated direct/relay/Sandbox D-4, webhook delivery and OAuth remain unverified; no LIVE or manual Production.
