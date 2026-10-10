> **RETIRED DOCUMENT — reference only.** First version of this plan (2026-10-10), written in the Google Workspace MCP plan style before it was rebuilt in the Appliance Desk system. Nothing here is a current instruction. Use `AGENTS.md`, `docs/START-HERE.md`, `docs/designs/` and `docs/TOOL-CATALOG.md` instead.

# Keeping it cheap for AI agents, and reaching agents that cannot use a connector

Added 2026-10-10 at Chris's request. Two goals:

1. **Do not burn an agent's context or usage.** A 282-tool server listed the
   ordinary way costs tens of thousands of tokens before the agent does
   anything, and big Stripe results (a page of 100 invoices) cost thousands
   more each. This server must give full value at a small fraction of that.
2. **Work for agents that cannot add a connector** (Codex, ChatGPT, Claude
   Code, a Claude session without connectors, CI, any agent with a shell),
   wherever they run, including locked-down cloud workspaces that can only
   reach GitHub, the same way Chris's small GitHub push/pull tool did.

Both are solved by the same idea: **one engine, several thin doors.** All the
real work (Stripe calls, guards, money rules, change log, keys) happens in the
hosted server. Every way in is a thin layer over the same registry, so a fix
or a new tool reaches every door at once and the safety rules can never differ
between them.

```
                      ┌──────────── hosted server (Vercel + Neon) ────────────┐
claude.ai connector ──▶ /api/mcp        (MCP, "catalog" or "compact" listing) │
any HTTPS agent ──────▶ /api/tools/*    (plain JSON + generated OpenAPI)      │──▶ one registry ──▶ guards ──▶ Stripe
shell agent anywhere ─▶ rstripe CLI ───▶ /api/tools/*  or GitHub relay ──▶   │      (same tools, same safety, same change log)
local MCP clients ────▶ rstripe mcp ────▶ /api/tools/*  (stdio proxy)         │
                      └────────────────────────────────────────────────────────┘
```

The Stripe key never leaves the hosted server, whichever door is used.

---

## Part 1: Using as little context as possible

What the current best practice is (as of October 2026), and what this server
does about each:

| Technique | What it means | What this server does |
| --- | --- | --- |
| **Deferred loading / tool search** | The agent's app loads only tool *names*, and pulls a tool's full instructions when it searches for it. Claude apps do this automatically for big connectors. | "Catalog" listing mode is built for it: every tool has a short, distinctive one-line description (searches match on it) and the long explanation lives in the schema, not the listing. |
| **Progressive disclosure (meta-tools)** | For agents whose app does *not* do tool search, the server itself lists a handful of tools: search, describe, call. | "Compact" listing mode: about 20 tools total, roughly 4,000 tokens, gives access to all 282. |
| **Code execution ("code mode")** | Instead of calling tools one by one and reading every result, the agent writes a short script that calls them, filters the data, and prints only the answer. Anthropic measured a drop from about 150,000 to about 2,000 tokens on one example. | The `rstripe` code SDK (Part 2) gives a typed function per tool. An agent in a sandbox writes ten lines, gets one number back. |
| **Small results by default** | Return a summary of each object, not Stripe's full 80-field JSON. | Summary mappers, `fields` projection, result handles for anything big (below). |
| **Toolsets** | Only show the tools a job needs. | Profiles (read_only / everyday / full) plus optional area filters at login. |
| **Workflows** | One call that does a whole job server-side instead of eight round trips through the model. | The 13 `workflow_*` tools. |
| **Skills** | A short instruction file the agent reads only when relevant (about 100 tokens to notice it). | `SKILL.md` shipped with the CLI (Part 2). |
| **Tool annotations** | MCP flags that tell the app a tool only reads, or is destructive, so reads can be auto-approved and writes shown with a warning. | Every tool sets `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` from its `writes` and safety metadata. |

### Two listing modes (chosen at login, or by the client)

**Catalog mode** (default for claude.ai, which has tool search): every tool in
the profile is listed, with these rules:
- The listing description is one line, at most 160 characters, starting with
  the action ("List invoices…", "MOVES MONEY: Refund…"). Longer guidance moves
  into the input schema's property descriptions and `stripe_describe_tool`.
- Input schemas are lean: no repeated boilerplate; the shared fields (`dryRun`,
  `confirm`, `fields`, `detail`, `requestKey`, `outsideApp`) use one short
  description each.

**Compact mode** (default for every other client, and for the CLI's MCP proxy):
the listing is only:

| Tool | Why it is listed directly |
| --- | --- |
| `stripe_search_tools(query, area?, limit?)` | Returns matching tool names, the one-line description and the safety marks. About 30 tokens per tool found. |
| `stripe_describe_tool(name)` | Full input schema and guidance for one tool, when the agent is about to use it. |
| `stripe_call(name, args)` | Runs any tool in the profile, through exactly the same guards as a direct call. |
| `stripe_batch(calls[])` | Up to 10 **read** calls in one round trip, each with its own `fields`, results combined. |
| `stripe_get_result(handle, page?, fields?)` | Pages through a stored big result (below). |
| `stripe_whoami` | Which account, mode and profile, always worth one call. |
| `api_search` | The way into everything in Stripe that has no hand-built tool. |
| The 13 `workflow_*` tools | They are the high-value jobs; making them one hop away is worth their ~2,700 tokens. |

A CI test keeps the compact listing under 5,000 tokens and the catalog
listing for `everyday` under 20,000 (measured with a standard tokenizer;
the test prints both numbers in every PR).

### Results: small by default, everything on request

- **`detail: "summary"` is the default** on every read tool. Each Stripe object
  type has one summary mapper (`src/tools/summaries.js`) listing the 6–12 fields
  a person actually reads: a customer is id, name, email, phone, balance,
  default payment method (brand + last 4), created, app record link. `detail:
  "full"` returns the whole object (still with secrets hidden and dollars added).
- **`fields`** on every read tool: a comma list of dotted paths
  (`"id,amount_display,status,customer.email"`). When given, only those are
  returned. The agent asks for what it needs.
- **Size cap and result handles.** If a result would be over about 2,000
  tokens (8 KB of text), the tool returns the first part, a count, a one-line
  summary ("142 invoices, $18,430.00 total, 3 past due") and a **handle**
  (`res_…`). The full result is kept in Neon for 24 hours, tied to that
  connection. `stripe_get_result(handle, page, fields)` reads it in pieces.
  This replaces "Showing the first 200 of 1,000" from the Workspace server,
  which still put 200 items into context.
- **Lists return one page** (default 20, max 100) with `next` for more.
  Workflows do the paging server-side and return only the answer.
- **Structured output.** Workflow tools declare an `outputSchema` and return
  `structuredContent` (machine-readable) plus a short plain-English text line,
  so an agent can use the numbers without parsing prose.
- **Errors are short**: what happened, what to do, then a one-line technical
  detail (Stripe request ID kept for support), not a stack.

### Rules every tool follows (checked in CI)

- Listing description ≤ 160 characters; no tool's schema over 1,500 tokens.
- Default response ≤ 2,000 tokens or a handle; a test calls every read tool
  against fixtures with 100 items and fails if the response is larger.
- Every read tool accepts `fields` and `detail`.
- Every tool has MCP annotations matching its `writes` and safety marks.

---

## Part 2: Agents that cannot add the connector

### Where AI agents actually run, and what each can reach

The design starts from how agent workspaces really behave, not from one
product. The deciding fact is **network access**: most cloud agent workspaces
block the open internet and allow only GitHub and the package registries (npm,
PyPI). That is why Chris's small GitHub push/pull tool worked inside them:
GitHub was on the allowed list. A tool that needs to reach
`stripe-mcp.vercel.app` directly is blocked in those same places.

| Where the agent runs | Typical reach | Best door |
| --- | --- | --- |
| claude.ai / Claude app (phone, web, desktop) | Remote connectors | The connector (`/api/mcp`) |
| Cloud agent workspaces: Claude's own workspace, Claude Code on the web, Codex cloud, GitHub Copilot's coding agent, CI runners | Shell; internet limited to GitHub and package registries | `rstripe` CLI over the **GitHub relay** (below) |
| Local machines: Claude Code, Codex CLI, Cursor, VS Code agents, Claude Desktop | Shell and full internet; local MCP servers | `rstripe mcp` registered as a local MCP server, or the CLI direct |
| General sandboxes: Vercel Sandbox, E2B, Docker, a VPS | Shell; internet set by whoever creates it | `rstripe` CLI direct (allow-list just the server) |
| HTTP-only agents: ChatGPT custom GPT actions, n8n, Zapier, scripts | HTTPS calls, no shell | The plain HTTPS API + OpenAPI |

### The recommendation

One engine on the hosted server; thin doors to it; and one small client,
`rstripe`, that **finds its own way out**:

1. It tries the server directly over HTTPS.
2. If that is blocked (the proxy refuses, or the connection fails), it switches
   to the **GitHub relay** automatically and says so once.
3. It installs from GitHub or npm, which every workspace above allows.

So the same command works on Chris's laptop, in a locked-down cloud agent
workspace, in a Vercel Sandbox, or in CI, with nothing to configure except a
pass. The Stripe key never leaves the hosted server, whichever route is used.

Running the whole engine inside the workspace with the Stripe key is also
possible ("local engine mode", near the end) but is **not the default**: it
would put a Stripe key in the workspace, and the change log, daily money limit
and app guard would no longer be shared.

### The GitHub relay (for workspaces that can only reach GitHub)

A private repository, `Robinson-AI-Systems/stripe-mcp-relay`, used as a
mailbox. Nothing about Stripe lives in it permanently.

1. The CLI encrypts the request (tool name and arguments) with a key derived
   from the pass (AES-256-GCM; the pass itself is never sent to GitHub) and
   posts it as a comment on that pass's relay issue, with a request ID.
2. GitHub sends a webhook to the hosted server (signed with a webhook secret
   the server checks). The server decrypts, runs the tool through the same
   registry and guards as every other door, encrypts the result and posts it as
   a reply comment.
3. The CLI polls that issue (GitHub's API, which the workspace can reach),
   decrypts the reply, prints it, and **deletes both comments**.
4. A cleanup job on the server deletes any relay comment older than one hour,
   and closes the issue when the pass expires or is revoked.

Properties:
- Works anywhere `api.github.com` works, including behind the agent proxies
  those workspaces use (the CLI respects `HTTPS_PROXY` and the system
  certificate bundle).
- Slower: about 2–6 seconds a call instead of under one. Fine for a person-
  sized job; for big jobs the agent uses `stripe_batch`, workflows or code
  mode so there are fewer round trips.
- GitHub only ever sees encrypted blobs, briefly. The relay repository holds
  issues, not commits, so nothing ends up in git history.
- The GitHub token the CLI uses is whatever the workspace already has (the
  `gh` login, `GITHUB_TOKEN`), and it only needs access to the relay
  repository. Chris adds the agent's GitHub account or app to that one private
  repository; it needs no other access.
- If GitHub is down, the CLI says so plainly; nothing is half-done, because
  the server only acts on a complete, decrypted request and its idempotency
  key makes a retried request return the original result.

### Registering it with the agent (so it knows the tool exists)

`rstripe init` writes the small files each agent product reads, so the agent
finds the tool on its own without anything in the prompt:

- `.claude/skills/stripe/SKILL.md` (Claude Code and Claude's workspace skills)
- a short section in `AGENTS.md` (Codex, Copilot and others that read it)
- on a local machine, optionally the local MCP registration for Claude Code,
  Codex or Cursor (`rstripe mcp` as the command)

Each is under 600 words: start with `rstripe whoami`, search then describe then
call, use `--fields`, use `--out` or the code SDK for anything big, never pass a
key, ask the person before anything that moves money.

### Sandbox passes (how a sandbox or other agent gets in)

A **sandbox pass** is a bearer token the hosted server issues, stored in
`oauth_tokens` with `kind = 'pass'`. It is made by Chris, never by an agent:

- From the connector: `stripe_create_sandbox_pass(account, mode, profile,
  areas?, expires_hours = 24, allow_writes = false)` — needs `confirm: true`;
  the pass is shown **once** in the result with copy instructions. Or from the
  setup page, same choices.
- Defaults: test mode, read_only profile, 24 hours. Writes, longer life
  (maximum 30 days) and live mode must each be chosen explicitly; a live pass
  with writes also needs the setup-page passphrase.
- Shows up in `stripe_list_connections` labelled as a pass, with last use;
  `stripe_revoke_connection` kills it instantly.
- Every call made with a pass goes through the same guards; its change-log rows
  say which pass made them.
- The money limit for a pass defaults to $0 (no money movement) even when
  writes are allowed; raising it is a separate confirmed setting.

### The plain HTTPS API (`/api/tools/*`)

- `GET /api/tools?profile&area&q` — tool list (same compact/catalog rules).
- `GET /api/tools/{name}` — full schema.
- `POST /api/tools/{name}` — body is the tool's arguments; response is
  `{ ok, result | error, handle? }`, the same content the MCP tool returns.
- `POST /api/tools/_batch`, `GET /api/results/{handle}`.
- `GET /api/openapi.json` — generated from the registry. Because some agent
  products cap the number of operations (custom GPT actions allow about 30), it
  exposes search, describe, call, batch, result, whoami and the workflows as
  operations, not all 282 tools.
- Authentication: `Authorization: Bearer <sandbox pass>`. Rate limited per pass.

### The `rstripe` command-line tool

Published from the same repository (`packages/cli`), installable with no
build step:

```
npm install -g github:Robinson-AI-Systems/stripe-mcp#cli-v1
#   or, without installing:  npx -y github:Robinson-AI-Systems/stripe-mcp#cli-v1 <command>
```

It needs two environment variables: `RSTRIPE_URL` (the hosted server) and
`RSTRIPE_PASS` (a sandbox pass). Commands:

| Command | What it does |
| --- | --- |
| `rstripe init` | Install check, write the agent's skill/AGENTS.md files, show which route it will use |
| `rstripe login` | Store the server address and pass in the OS keychain (local machines) |
| `rstripe whoami` | Account, mode, profile, expiry of the pass, route (direct or relay) |
| `rstripe tools [search words]` | Find tools (one line each) |
| `rstripe describe <tool>` | Full instructions and arguments for one tool |
| `rstripe call <tool> --args '{…}'` (or `--key value` flags) | Run a tool; prints JSON |
| `… --fields "id,amount_display,status"` / `--detail full` | Shape the result |
| `… --out result.json` | Save the full result to a file and print only a one-line summary, so a big result never enters the agent's context |
| `… --dry-run` / `--confirm` | The safety flags, same meaning as the connector |
| `rstripe result <handle> [--page n]` | Page through a stored big result |
| `rstripe sdk` | Writes the typed code SDK (below) into the current folder |
| `rstripe mcp` | Runs a local MCP server (stdio, compact mode) that forwards to the hosted server |
| `rstripe skill` | Prints `SKILL.md`: a one-page guide an agent can read to use all of this efficiently |

Exit codes are meaningful (0 ok, 2 needs confirm, 3 refused by a guard, 4
Stripe error, 5 pass expired), so an agent's script can react without reading
prose.

### Code mode in any workspace (the cheapest way to do big jobs)

`rstripe sdk` writes `stripe-tools/` with one small typed function per tool in
the pass's profile, grouped by area (`stripe-tools/invoices.ts`,
`stripe-tools/customers.ts`, …), each a thin call to `/api/tools/{name}`. An
agent lists the folder, opens only the area it needs, and writes a script:

```js
import { invoice_list } from './stripe-tools/invoices.js';
let pastDue = [], next;
do {
  const page = await invoice_list({ status: 'open', limit: 100, starting_after: next, fields: 'id,customer_email,amount_due,due_date' });
  pastDue.push(...page.items.filter(i => i.due_date < Date.now() / 1000));
  next = page.next;
} while (next);
console.log(`${pastDue.length} overdue, $${(pastDue.reduce((s, i) => s + i.amount_due, 0) / 100).toFixed(2)}`);
```

Hundreds of invoices are processed in the sandbox; one line comes back to the
agent. Writes from code still need `confirm: true` in the arguments **and** a
pass that allows writes, and still hit the daily money limit, so a runaway
loop is stopped by the server, not by the script's good behaviour.

### Recipes (written up in `docs/AGENT-SETUP.md`, card P6-5)

Every recipe is the same four steps; only where the two environment variables
go differs.

1. Chris makes a pass from the connector: "make me a 24-hour read-only test
   pass for Codex". Claude shows it once.
2. Put `RSTRIPE_URL` and `RSTRIPE_PASS` where that agent keeps secrets (a
   workspace secret or environment setting for cloud agents, the OS keychain
   via `rstripe login` on a local machine, an environment variable in a sandbox
   or CI).
3. `npx -y github:Robinson-AI-Systems/stripe-mcp#cli-v1 init` — installs,
   writes the skill/AGENTS.md files, runs `whoami`, and reports which route
   (direct or GitHub relay) it will use.
4. Work. Revoke the pass when done, or let it expire.

Recipes covered: Claude Code (local and web), Claude's own workspace, Codex
(CLI and cloud), Cursor, GitHub Copilot coding agent, GitHub Actions, Vercel
Sandbox (with an outbound allow-list of just the server, GitHub and npm), a
plain Docker container. Plus one paragraph Chris can paste into any agent that
tells it how to set itself up.

### Local engine mode (optional, test mode only)

`rstripe engine --stripe-key-env STRIPE_TEST_KEY` runs the full engine inside
the sandbox against a **test** key (it refuses `sk_live_`/`rk_live_`), keeping
its change log in a local file. Useful for offline development against
stripe-mock or a scratch test account. Not used for Chris's real accounts.

### Why not something else

- **Only a connector:** leaves out every agent that cannot add one.
- **Only a Vercel Sandbox:** works, but it is one place among many; the agent
  doing the work is usually somewhere else (its own workspace or Chris's
  laptop), and copying work in and out of a separate sandbox costs time and
  context. The CLI runs where the agent already is.
- **A direct-only CLI:** blocked in most cloud agent workspaces. The GitHub
  relay is what makes it work there.
- **Only the CLI with a Stripe key in the workspace:** spreads keys around and
  splits the safety rules and change log across places.
- **Giving agents the raw Stripe API:** no money rules, no app guard, no
  change log, and Stripe's full objects are expensive in context.
- **Stripe's own official MCP server:** worth knowing about, and fine for
  quick lookups, but it has none of the protections in this plan (Chris's
  daily limits, the Appliance Desk guard, his change log, plain-English
  workflows), so it does not replace this server.
