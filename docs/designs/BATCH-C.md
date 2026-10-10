# Design — Batch C: Cheap on context (small results, compact listing, budgets)

Status: **APPROVED once IN-00 is answered.** Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch C.
Cards C-1, C-2. Depends on Batch B. Every later tool is built to these rules, so this batch comes before any area tools.

Why: a 280-tool server listed the ordinary way costs tens of thousands of tokens before an agent does anything, and
Stripe's full objects cost thousands more per result. Current practice (October 2026): deferred loading / tool search
in the client, progressive disclosure (search → describe → call) on the server, code execution for big jobs, small
results, toolsets, workflows, skills, and MCP tool annotations. Sources: Anthropic, "Code execution with MCP"
(anthropic.com/engineering/code-execution-with-mcp); mcp.directory, "MCP context bloat: the 2026 fixes".

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| C1 | The MCP SDK version in `package.json` supports tool `annotations`, `outputSchema` and `structuredContent` | `grep -rn "outputSchema\|annotations" node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts \| head` |
| C2 | Each tool module exports registry metadata (`area`, `profiles`, `writes`) from Batch B | `grep -n "writes:" src/tools/*.js \| head` |

## 1. Decisions

**C1. Two listing modes per connection.** `catalog` (default for claude.ai, whose client does tool search): every tool in
the profile, listing description ≤160 characters starting with the action (`MOVES MONEY:` first for `$` tools); longer
guidance lives in property descriptions and `stripe_describe_tool`. `compact` (default for every other client): only the
meta-tools, `stripe_whoami`, `api_search` (once Batch U exists) and the `workflow_*` tools — about 20 tools, under 5,000
tokens, reaching everything.

**C2. Meta-tools.** `stripe_search_tools(query, area?, limit=10)` → names, one-line descriptions, safety marks;
`stripe_describe_tool(name)` → full schema and guidance; `stripe_call(name, args)` → dispatches into the **wrapped**
handler, so every guard applies; `stripe_batch(calls[≤10])` → reads only, combined result; `stripe_get_result(handle,
page?, fields?)`.

**C3. Small results by default.** Every read tool gets `detail: 'summary'|'full'` (default summary) and `fields` (comma list of
dotted paths) from a registry layer, not by hand. One summary mapper per Stripe object type in `src/tools/summaries.js`
(6–12 fields a person reads; e.g. customer: id, name, email, phone, balance_display, default payment method brand + last 4,
created_local, appRecord). Lists return one page (default 20, max 100) with `next` explained in words.

**C4. Size cap and handles.** A result over 8 KB returns the first part, a count, a one-line summary ("142 invoices,
$18,430.00 total, 3 past due") and a handle `res_…`; the full result is kept 24 hours in `result_store`, readable only by the
same connection or pass.

**C5. Annotations and structured output.** Every tool sets `readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint` from its metadata. Workflow tools declare `outputSchema` and return `structuredContent` plus a short
plain-English text line.

**C6. Budgets are tests.** `scripts/check-budgets.mjs` (in `npm run check`) fails when: compact listing ≥5,000 tokens;
`everyday` catalog listing ≥20,000; any listing description >160 characters; any schema ≥1,500 tokens; any read tool's
default response on 100-item fixtures >8 KB without a handle. Token counts use a standard tokenizer package (pin it) and
are printed in CI.

## 2. Schema

```sql
CREATE TABLE IF NOT EXISTS result_store (handle TEXT PRIMARY KEY, connection TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, summary TEXT, body JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS result_store_expires ON result_store (expires_at);
```

Expired rows are deleted by the same request path (cheap `DELETE … WHERE expires_at < now() LIMIT 100`), no cron.

## 4. Work units

### C-1 — Summaries, fields, detail, handles, annotations (M)
Files: `src/tools/summaries.js`, `src/tools/result-rules.js` (registry layer), `src/db.js`, `src/tools/server.js`
(`stripe_get_result`). Tests: field projection and unknown-path note; handle isolation between connections; annotation
consistency; size cap on fixtures.

### C-2 — Listing modes, meta-tools, budgets (M) — may group with C-1
Files: `src/tools/meta.js`, `api/mcp.js` (listing per connection, `?listing=` override), `scripts/check-budgets.mjs`.
Tests: `stripe_call` passes the write-contract helper (door #2); refuses tools outside the profile; `stripe_batch` refuses
writes; budget script fails on a planted 161-character description (prove once).

## 5. Stop-and-ask points

1. The SDK lacks annotations or structured output (C1 false): build the rest; record the gap; amend.

## 6. Acceptance mapping

| PLAN Batch C line | Evidence |
|---|---|
| Compact <5k, everyday catalog <20k tokens | CI budget output |
| Every door enforces the same guards | write-contract through `stripe_call` |
| Handles isolated | `tests/db/result-store.test.js` |

## Amendments
