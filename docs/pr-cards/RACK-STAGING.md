# RACK-STAGING — the store transport seam and rack entrypoint for the Development Rack move (2026-11-06)

## Authorization

Owner program directive, Chris, 2026-11-05 (the rack migration
program's as-is parity rule, carried by the fleet coordinator's
overnight staging order 2026-11-06 ~00:10 MST): every fleet server
moves to the Development Rack **as it is** — the move gate is parity
(runs on the rack in the same state it runs today: starts, serves,
health answering as now), never development completion. Stripe
Unleashed's staging dossier (the rack program's record, outside this
repo) identifies exactly two repo-side gaps between this codebase and
a rack deployment, plus one dependency correction. This card is those
three items and nothing else:

- **S-1 — production store transport.** `src/db.js`'s injection seam
  exists (`createDb(sql = getProductionSql())`), but
  `getProductionSql()` hard-wires the Neon HTTP driver, which a plain
  Postgres store cannot serve; `src/health.js`'s probe builds its own
  Neon handle the same way; and `pg` sits in devDependencies, so a
  production install does not carry it.
- **S-2 — rack entrypoint.** No standalone server exists in the repo;
  the `api/` handlers assume the Vercel function contract.
- **S-3 (repo side) — the dependency half of the build recipe:** `pg`
  moves to `dependencies`. The recipe itself (Node 24 builder, the
  `vendor/stripe-openapi/**` carry check) lives in the rack's
  enrollment, not in this repo.

This is staging enablement, not a move: nothing here changes the
Vercel deployment's behaviour, fires a release, or touches production
data. The change rides the normal train after merge; the cutover
window is a separate, owner-gated program step.

## What changes

- **`src/db-transport.js` (new)** — the one place that decides how the
  own store is reached, on the fleet's proven pattern (Neon
  Unleashed's merged `src/db-transport.js`): two drivers behind the
  exact handle contract the db layer already consumes (tagged-template
  query resolving to row objects, plus `.query(text, values)`).
  `neon` = the `@neondatabase/serverless` HTTP driver, production's
  behaviour unchanged; `pg` = a pooled node-postgres client, the
  `test/helpers/pg-neon-adapter.js` shape promoted into `src/` (the
  whole db suite already runs the db layer through that shape).
  Selection: `STORE_TRANSPORT=neon|pg` wins when set (validated);
  otherwise the `DATABASE_URL` hostname decides (`*.neon.tech` →
  neon, anything else → pg). On Vercel the store URL is a Neon
  endpoint, so the pg path never activates there.
- **`src/db.js`** — `getProductionSql()` delegates to `storeSql()`;
  the `createDb` seam and every store method are untouched.
- **`src/health.js`** — `checkDatabase` probes through the same
  transport instead of building a private Neon handle, so a
  plain-Postgres store probes as itself; the pinned readout shape is
  unchanged.
- **`package.json` / `package-lock.json`** — `pg` 8.16.3 moves from
  devDependencies to dependencies (the lock change is exactly the
  root declaration plus the six `dev` flags in pg's own closure).
- **`rack-server.mjs` (new)** — the standalone entrypoint, on the
  fleet's proven shape (Workspace Unleashed's merged entrypoint,
  adapted): filesystem binding for every `api/**/*.js` file, bracket
  segments bound as query parameters, the `vercel.json` rewrites
  verbatim (`/health`, `/api/openapi.json`, the two well-known
  documents), and **no route for `/`** — production answers 404 at
  the root today, so parity keeps it. Body contract per route: a
  function exporting `bodyParser:false` (today only the
  Stripe-signed test-webhook receiver) receives the request stream
  untouched, because it verifies the Stripe HMAC over raw bytes it
  reads itself; every other function receives the buffered, parsed
  body exactly as Vercel presents it (JSON/form as objects, anything
  else as a string, none as undefined; a JSON parse failure is the
  platform's 400 before the handler). Release identity is pinned the
  honest way: `RACK_RELEASE_COMMIT` or a build-written
  `release-commit.txt` sets `VERCEL_GIT_COMMIT_SHA` before traffic;
  with no valid pin nothing is synthesized and health reports a null
  commit. No per-route duration timer is imposed (Vercel's are
  ceilings; this server must not impose a shorter one).
- **Tests** — `tests/unit/db-transport.test.js` (selection rules +
  handle contract), `tests/unit/rack-server.test.js` (route table,
  rewrites, bracket binding, body limits, release pin, and HTTP legs
  through the real handlers in their no-store fail-closed postures),
  `tests/db/transport.test.js` (the production seam itself:
  `createDb()` with no injected handle against disposable Postgres —
  schema init through the seam, a registration write/read round trip,
  the health probe through the same transport).
- **This card + work-index registration + `docs/STATUS.md`** — the
  repo's normal registration for a code change.

## Acceptance

- `npm run check` green; the unit suite green; the db suite green
  (`npm run test:db`, which now includes the S-1 seam proof above) —
  all at the PR's exact head, CI's verdict governing.
- Behaviour parity on Vercel is by construction: with a Neon store
  URL and no `STORE_TRANSPORT`, `storeSql()` returns the identical
  `neon(url)` handle production has always used, and no handler,
  route, or tool changes.
- The rack-side proof (private deployment at the staging head,
  fixture store, the parity battery: front door, discovery, health
  `database:true`, a registration write through the seam, the webhook
  receiver's signature verification over the untouched stream) is
  the rack program's rehearsal, recorded in the program's staging
  record — it is not a merge gate for this PR and claims nothing
  about production.

## Out of scope

The cutover window, the store copy and its reconciliation, the fence
(writer-credential rotation), all DNS/route writes, and CAP-5 (the
Stripe crew's acceptance track — untouched, not a gate here).

## Drift check

Read fresh at `main` `832f45ad` before building (2026-11-06): the
repo `AGENTS.md`, `src/db.js` (seam + `getProductionSql`),
`src/health.js`, `src/core/http.js` (`paramsOf` /
`incomingBodyWithinLimit` body contract), `api/mcp.js` (exported
`bodyParser:true` config; the transport consumes `req.body`),
`api/stripe/test-webhooks/[account]/[endpoint].js`
(`bodyParser:false`; the receiver reads the stream itself and takes
`account`/`endpoint` from `req.query`), `vercel.json` (rewrites +
the `vendor/stripe-openapi/**` include), `package.json` /
`package-lock.json` (`pg` placement), the full `api/` tree,
`test/helpers/pg-neon-adapter.js`, the fleet's merged precedents
(Neon Unleashed's `src/db-transport.js`; Workspace Unleashed's
`rack-server.mjs`, including its recorded body-contract defect —
this entrypoint's per-route stream rule is the correction),
`docs/STATUS.md` head, `docs/pr-cards/work-index.json` and
`docs/pr-cards/validate-index.py`. No drift from the scope above:
the seam, the adapter shape and both body contracts were verified
in the code as read, not assumed. Verification runs on the fleet's
benches through the dispatcher (ledger entries `stripe-rack-*`),
with exact-head CI as the publication gate.
