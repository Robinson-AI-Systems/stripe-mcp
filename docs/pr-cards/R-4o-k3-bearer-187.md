# R-4o — Original-service bearer adaptation, source-owned identity and revocation

Status: IMPLEMENTED pending #187 exact-head CI/review/merge.
Baseline Stripe main `6b2c308e0bfdd881b818e4428ee00a335646d687`, Hub candidate `08f4189...` private SHA256
`3038f7664e18ac57e5fdb86daf0884f603a78a446e2f1300f20fd59a92e73ea6`.

## Outcome
Establish real original Stripe OAuth/MCP HTTP compatibility of adapted private
core `mcp-auth` with a durable `db.getAccessToken` and strict service-owned
projection. Project only source-validated TEST connector client/account/profile,
listing and resultScope; preserve RFC case-insensitive Bearer token syntax
after checking all normalized/raw/distinct transport headers for duplicates,
accessors or inconsistency. Portable core handles deep frozen claims, DB outage
503 and invalid/expired/revoked credential generic 401 without leaking secrets.

## Verifications
Standalone original `src/core/mcp-auth.js` is untouched/dependency-free
in Production. Disposable source CI exercises original vs portable direct
differential (valid scheme, RTC pass, malformed, duplicated, getter, query
error) and overlays the actual original `requireMcpToken` entry point
with staged portable adapter. Four authentic original unit, six authentic
original disposable PostgreSQL suites cover OAuth registered HTTP,
MCP SDK transport/connection, refresh/revocation, and original money owner
approval/Colorado per-account cap. Revert overlay in finally. Previous
seven+nine, one-time and profiles suites stay included.

No independently authenticated real human owner approval is claimed by
synthetic automated suites; retain exact owner permission and future external
G-6 gate. LIVE off, no forced deployments, no money.

## Blocker reentry
Adapted `oauth-protocol`, `write` and `mcp-dispatch` remain individually
OPEN pending Stripe-owned source test proof. Actual published package
adoption awaits Hub final remote release; owner TEST and D-4 await exact
protected deployed `live` SHA, short-lived credentials and attested routes.
See docs/acceptance/K3-STRIPE-SOURCE-HANDOFF.md.
