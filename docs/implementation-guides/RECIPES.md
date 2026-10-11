# Concrete execution recipes

Existing paths/signatures below were inspected at #93. Proposed additions must be labeled in the JIT card.
AGENTS, PLAYBOOK, approved designs and acceptance remain authoritative.

## 1. Card packet

Keep the normal 40–100-line card; link a recipe instead of copying safety rules. Include this compact packet:

1. Baseline SHA, merged predecessor, design heading, owner-input IDs, one risk area, migration owner and size estimate.
2. **Existing** files + exact exports to reuse; **proposed** files + intended exports. Name callers and affected fixtures.
3. Mapping table: argument → validated type/bounds → SDK method/body or SQL column → independent read-back predicate.
4. Steps: failing behavioral fixture → implementation → registry/door ripple → focused mock/DB evidence → docs/gates.
5. Fixture table with initial state, requested action, expected calls/state/output, zero-write failures and forbidden effects.
6. Completion evidence per acceptance item and successor inheritance (exports, new tables, limitations, owner gates).

For each provider call record method/path/operationId from `scripts/openapi-find.mjs`, SDK method and official reference
URL. The CLI prints operation summaries, **not parameter validation**. Inspect the exact request schema via
`loadPinnedOpenApi()` in `scripts/stripe-openapi.mjs` and `node_modules/stripe/types/<Resource>.d.ts` for nested fields.
Never search all 23 vendor parts or all SDK files when the resource name is known.

## 2. Native tool recipe

| Existing file | Reuse / integration point |
| --- | --- |
| `src/tools/billing-shared.js` | `client(ctx)`, `validateFields(a,allowed,required)`, `checkId`, `ref`, `paging`, `pageResult`, `reply`, `guarded`, `allProfiles`, `writeProfiles`, `fullProfiles`, `local` |
| `src/tools/dispute-reads.js`, `file-reads.js` | Current list/get projection and validation examples; no raw private evidence or provider file URLs |
| `src/tools/dispute-evidence-draft.js` | Real `makeDisputeDraft()` factory: read/summarize/apply/readAfter/verify, per-call state, charge/customer ownership propagation |
| `src/tools/write.js` | Stripe `defineWrite(spec)` adapter and `gone(reason)`; use this adapter, never import the generic write directly in a Stripe tool |
| `src/core/write.js` | Actual hook contract: `read(args,ctx)`, `summarize(before,args,ctx)`, `apply(args,ctx,{before,idempotencyKey})`, `readAfter(args,ctx)`, `verify(before,after,args,ctx)`, optional `inverse` |
| `src/tools/index.js` | Import namespace exporting `tools` and `handlers`, append to `mergeNamespaces`; duplicate names or missing handlers throw |
| `src/core/mcp-server.js` | `dispatchReadOnlyTool({registry,name,args,connection,db,services})` is the guarded dispatcher despite its historical name; MCP and indirect calls share it |
| `src/tools/meta.js`, `src/core/profiles.js` | `stripe_call` delegates through `runRead`; `stripe_batch` refuses all writes. Listing/dispatch both enforce profile metadata |
| `src/tools/util.js`, `result-rules.js` | Shaping/redaction, fields/detail, 8 KB ceiling/private handle flow. A handle is not permission to leak private evidence |

Ordered steps:

1. Start with an injected provider fixture: `ctx.services.stripeForConnection = async () => provider`. Never read a real
   credential in unit tests. Validate arguments in handler code too; schema declarations alone do not enforce them.
2. Read target from the selected provider; validate object/ID/mode and operation eligibility. Retrieve parent charge,
   customer or subscription when needed for ownership, preserving metadata and `customer` in the `before` object.
   Missing/foreign parent or uncertain identity must refuse before mutation.
3. Read tool: `paging(args)` yields limit 20 by default; map a strict projection with `pageResult`, preserving `has_more`
   and next cursor. Add fields/detail in schema where required; test empty, 2 pages, malformed provider data and secrets.
4. Write tool: factory per invocation for any mutable closure, standard control flags, explicit allowed argument schema,
   no caller amount substituting provider state. Safe preview must fit 1024 characters (money line ≤240).
5. `apply` passes only mapped business parameters and `{idempotencyKey}` to SDK; never forward the entire `args` object.
   `dryRun`, `confirm`, `requestKey`, `outsideApp` are controls, not Stripe parameters. Do not invent a `plan` hook:
   current core uses `read` and `summarize`.
6. `readAfter` independently retrieves the target. `verify` checks identity, TEST mode and exact requested changes;
   request response alone cannot set confirmed. Keep `inverse` null for irreversible writes.
7. Export metadata from `.tool`, add area/profiles/description/schema; register. Update TOOL-CATALOG origin/safety,
   `tests/unit/registry.test.js` exact names/write count, `profiles.test.js` and `meta.test.js` relevant profile/list counts.
   Calculate actual expected membership rather than incrementing every count indiscriminately.

## 3. Fixtures that exercise the real implementation

Existing helpers: `test/helpers/fake-db.js` → `createFakeDb`; `tests/helpers/write-contract.js` → `runWriteContract`.
The singular `test/` path is intentional. Copy fixture **structure** from
`tests/unit/money-payout-create-contract.test.js` or `money-payout-reverse-contract.test.js`, not their payout semantics.

`runWriteContract({withMoney,tool,args,fixtures,strictArgs,...})` expects `tool` to return the real operation and
`fixtures` to return `{ctx,db,provider}` with `provider.writes` and `provider.afterCalls`. Seven cases cover preview,
missing confirm, idempotent apply/read-back, mismatch, ownership, LIVE and cap/amount rules. Add operation-specific
cases; generic helper passing does not prove every eligibility rule. For one-shot targets adapt fixtures/expectations
to terminal state instead of weakening production guards to permit a second write.

| Fixture / action | Required observable outcome |
| --- | --- |
| Valid TEST target + `dryRun:true,confirm:true` | Preview only; 0 SDK mutations, 0 money reservation; audit preview allowed |
| Valid target + missing confirm | `done:false`, confirmation requested; 0 mutations |
| Confirmed target | Exact payload and stable key, independent retrieve, exact change verified, audit finalized |
| Provider response success, read-back unchanged or wrong ID | `confirmed:false`, no success embellishment; money stays uncertain and counted |
| App marker on parent only | Denied by default; explicit supported `outsideApp` follows normal guard, never authorizes money |
| LIVE/read_only + confirm, direct and `stripe_call` | Denied; 0 mutations; write in `stripe_batch` also denied |
| Unknown parameter / missing parent / unsupported currency | Fail closed; 0 mutations, not a fabricated empty/success result |
| Private text or secret sentinel in provider | Absent from preview/result/audit; check serialized artifacts, not just one property |

Use `dispatchReadOnlyTool` as in `tests/unit/meta.test.js` for direct and `stripe_call` tests with the real registry,
fake DB and service provider. Keep `connection.resultScope` set for dispatcher money/handle tests: it becomes
`connectionId`. A direct handler's manually supplied `connectionId` is not enough to exercise this integration.
`tests/doors/`, HTTPS tool endpoints and `src/core/meta.js` do **not** exist at this baseline; R owns their future work.
Do not claim HTTPS contract coverage now. Add door cases when that door actually ships.

## 4. Money and database recipe

Current money path: `spec.money(args,ctx,before)` → `src/money.js:prepareMoney` →
`reserveMoneyBeforeWrite` → `ctx.db.requestMoneyApproval` + `reserveMoneyOut` → SDK apply/read-back →
`settleMoneyAfterWrite` → `settleMoneyReservation`. `src/db.js:createDb(sql)` owns real SQL.
No `src/stripe/money-operations.js` exists yet; Batch U owns that proposed universal-operation table.

| Server-derived value | Current persistence / constraint |
| --- | --- |
| `ctx.connection.stripeAccount`, tool, stable key | `money_approvals.stripe_account`, `tool`, `request_key`; exact identity match on replay |
| `before` target ID / amount / currency | `target`, `amount_cents`, `currency`, `mode`; integer positive USD, no AI approval flag |
| Independent owner action | Owner decision intents + approval timestamps; `api/stripe/setup.js` authenticated owner flow |
| Confirmed attempt | `money_reservations`; atomic account serialization consumes grant and checks shared Denver-day cap |
| Outcome | confirmed/rejected/uncertain settlement; only classified definitive rejection releases capacity |
| Safe preview / result | `change_log` via `recordChange`; core deliberately stores no raw before/after objects |

Reuse existing owner browser flow; don't add an MCP approval bypass. Test confirm-only, expired/consumed grant,
wrong account/target/amount/tool, shared cap across connections, separate over-cap override, concurrent attempts and
uncertain outcome. `tests/db/money-owner-approval.test.js`, `money-reservation.test.js`, `money-inbox.test.js` verify
real SQL; fake DB behavior alone is insufficient when changing validation or ledger logic.

SQL additions: one migration owner per PR, additive init in `src/db.js`, update `SCHEMA_TABLES` and fake DB only when
needed, update `tests/unit/schema.test.js`, `tests/db/schema.test.js`, ARCHITECTURE. Isolated Postgres only. Previews
share the production DB; never run schema tests against Neon. No SQL is needed just to add a native provider tool.

## 5. Remote bytes and one-time secrets

Existing `src/tools/evidence-upload.js`, `src/tools/report-result-file.js`, `src/tools/dev-forward-events.js` are separate
security patterns: uploads, owner-only downloads, signed event delivery. Inspect their imported network helpers before
reuse; do not assume one downloader authorizes every new purpose. Keep pinned public DNS/TLS, HTTPS, bounded bytes,
redirect/purpose constraints and content validation. Fixtures: private IP/redirect, mixed DNS, too-large stream, wrong
signature/MIME, provider error → no downstream upload/attachment, no content/URL leak.
`src/core/one-time-secrets.js` and private setup page implement owner-only secret handoff. Replays must not issue a
new secret. Never expose webhook secret bytes in MCP or change logs; test one read succeeds, second/expired/wrong
account refuses. G-4/H cards must name the exact existing helper they extend after inspection.

## 6. Validation and completion evidence

Run in repo root, noninteractive, with bounded output and pipefail if piping. Install once with `npm ci`.

```bash
npm run check
npx --no-install vitest run tests/unit/registry.test.js tests/unit/profiles.test.js tests/unit/meta.test.js
npx --no-install vitest run tests/unit/write-contract.test.js tests/unit/money-owner-approval.test.js
# Add actual changed-area unit files explicitly; never bare vitest/watch mode.
npm run test:mock -- tests/mock/dispute-evidence-draft.test.js
# Only when SQL/ledger changes; requires local throwaway Postgres or CI's service:
npm run test:db -- tests/db/money-owner-approval.test.js tests/db/money-reservation.test.js
python3 docs/pr-cards/validate-index.py
```

stripe-mock tests call the pinned SDK via `makeStripeClient` with localhost test options (see existing draft mock).
They prove accepted SDK request shape, **not** persisted evidence, bank submission, money settlement or actual TEST smoke.
Behavior comes from stateful unit fixtures plus real isolated SQL where used. Keep pending owner-connected TEST smoke
explicit; never claim production readiness from CI. Full existing CI remains mandatory, including documentation-only PRs.

Evidence packet in PR/card: baseline/drift table, acceptance → test name/outcome, exact payload/read-back assertions,
zero-write/security failures, local command results or explicit unavailable command, CI run/head and review dispositions.
Run quick gate and focused tests before one push. Collect all completed CI failures before any correction push.
Self-review full diff; inspect review threads; merge with expected head only after `ci` green and acceptance met.
Completion inheritance: successor paths/exports, schema ownership, terminal/uncertain state semantics, limitations and
remaining owner/provider smoke evidence. Update STATUS and normal drift B docs; do not start an unrelated feature.
