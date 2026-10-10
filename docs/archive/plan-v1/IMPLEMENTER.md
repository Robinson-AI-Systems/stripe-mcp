> **RETIRED DOCUMENT — reference only.** First version of this plan (2026-10-10), written in the Google Workspace MCP plan style before it was rebuilt in the Appliance Desk system. Nothing here is a current instruction. Use `AGENTS.md`, `docs/START-HERE.md`, `docs/designs/` and `docs/TOOL-CATALOG.md` instead.

# Implementer guide: prompts, PR template, checklists

## Prompt to paste into the implementing model (Sonnet 5.5, medium effort)

Replace `<CARD>` with the card ID, for example `P0-1`.

```
You are implementing one task card in the Robinson Stripe MCP repository
(github.com/Robinson-AI-Systems/stripe-mcp).

Read, in this order, before writing any code:
1. docs/plan/README.md
2. docs/plan/FINDINGS.md
3. docs/plan/ARCHITECTURE.md
4. docs/plan/TESTING.md
4b. docs/plan/CONTEXT-AND-ACCESS.md (rules every tool follows for small
   listings and small results; Part 2 if your card is in Phase 6)
5. The tools for your area in docs/plan/TOOL-CATALOG.md
6. The card <CARD> in docs/plan/TASKS.md, and any card it says it may group with.
7. The actual source files the card names. Trust the code over the docs; if
   they disagree, fix the doc in the same PR.
8. If the card says "port": the matching part of
   github.com/Robinson-AI-Systems/robinsons-toolkit-mcp handlers/stripe.js,
   only to see which Stripe call it makes. Do not copy its code.
9. If the card copies from the Workspace server: the named files in
   github.com/Robinson-AI-Systems/google-workspace-mcp.

Then:
- Create branch ai/sonnet/<CARD>-<short-slug> from the latest main.
- Implement exactly what the card says. Do not add features it does not ask
  for; put ideas under "Suggested follow-up" in the PR body instead.
- Write the tests the card's acceptance checks require, using
  test/helpers/write-contract.js for every write tool. Run `npm run check`,
  `npm test`, `npm run test:mock` (and `npm run test:db` if the database
  changed) and paste the real summary lines into the PR body.
- Update the status ledger row for <CARD> in docs/plan/TASKS.md in the same
  PR (IN_REVIEW, with the PR number once known).
- Open a PR using the template in docs/plan/IMPLEMENTER.md. Write it for Chris,
  who is not a developer: plain English, no unexplained jargon.

Hard rules (from docs/plan/README.md, repeated because they matter):
- A Stripe secret key never appears in a tool argument, tool result, log,
  test, fixture, change-log row or PR body. Tests use obviously fake keys.
- Use the official stripe library through src/stripe/client.js only. Never
  hand-build request bodies. Never change STRIPE_API_VERSION unless the card
  is about that.
- Every Stripe write carries the idempotency key from the client wrapper.
- Every write tool is built with defineWrite: dryRun, read-back, change log;
  confirm when it moves money or cannot be undone; a money spec when it moves
  money, with the amount taken from Stripe, not from the arguments.
- Never return a client_secret, webhook secret (except once on creation, as
  the card says), full card number or bank account number.
- Records the Appliance Desk app owns are not changed without outsideApp: true.
- Keep it cheap for agents: listing description at most 160 characters,
  read tools return summaries by default and accept fields/detail, nothing
  over 8 KB is returned without a result handle, every tool has MCP
  annotations. The token budget test must stay green.
- Every door (MCP, HTTPS API, CLI) calls the same registry; never add logic
  to one door that the others do not get.
- Live mode: every write needs confirm. Test clocks and the smoke test refuse
  live mode.
- Database changes are additive only.
- No placeholder code. A tool either calls the real Stripe method it claims
  to, or it is not added. If Stripe has no API for something, say so in the
  PR and point stripe_where_is_setting at the dashboard instead.
- If you cannot finish, say so plainly: mark the card IN_PROGRESS with what is
  missing. Never present partial work as done.

When you finish, stop. Do not start the next card unless told to.
```

## Prompt for the phase-gate review (Opus 5.5 or Fable 5.1, read-only)

```
Review phase <N> of the Robinson Stripe MCP plan. Read docs/plan/README.md,
FINDINGS.md, ARCHITECTURE.md, TASKS.md (phase <N> cards and the ledger), and
the diff of every PR listed in the ledger for that phase.

Report, in this order:
1. Money safety: any path where money moves without confirm, without a dollar
   preview, without the daily limit, without an idempotency key, or with an
   amount taken from the arguments instead of from Stripe.
2. Secrets: any way a Stripe key, client_secret or webhook secret could reach
   a result, log, change-log row or test fixture.
3. Guards: any write that bypasses defineWrite, the live guard or the
   app-owned guard; any tool missing its writes declaration.
4. Correctness: acceptance checks claimed but not proven by a test, a
   stripe-mock run, or a committed smoke report; any FINDINGS.md bug that came
   back.
5. Drift: code that disagrees with ARCHITECTURE.md or TOOL-CATALOG.md.
6. Plain English: PR bodies or tool descriptions Chris could not understand.

For each finding give file:line, what is wrong, and the smallest fix. Do not
write code. End with GO or NO-GO for the next phase.
```

## PR template

```
## Card
<CARD ID and title>

## What this does (for Chris)
Two to five sentences in plain English. What changes for you, what it will
ask you before acting, whether anything here can move money, and anything you
need to do (a Vercel setting, a click in Stripe) as numbered steps.

## What changed (for the next developer)
- file: what and why

## Proof
- `npm run check`: pass/fail
- `npm test`: N passed, N failed (paste the summary line)
- `npm run test:mock`: N passed, N failed
- Database tests: ran / not needed because <reason>
- Smoke report (once P8-2 exists): attached / not needed because <reason>
- Manual check from the card's acceptance list: what you did and what you saw

## Not done / known gaps
Honest list, or "None".

## Suggested follow-up
Ideas you had but deliberately did not build.

## Ledger
TASKS.md row updated to IN_REVIEW.

🤖 Generated with Claude <model>
```

## Checklist before opening any PR

- [ ] Branch from fresh `main`; one card (or an allowed group).
- [ ] `npm run check`, `npm test`, `npm run test:mock` pass; new behavior has new tests.
- [ ] No key or secret anywhere (the key-scan test passes).
- [ ] Every new tool declares `writes`; every write tool passes the seven write-contract checks.
- [ ] Every money tool's description starts with `MOVES MONEY:`.
- [ ] Any new table/column uses `IF NOT EXISTS`; nothing renamed or dropped.
- [ ] Any new env var documented in ARCHITECTURE.md and DEPLOY.md with the
      exact steps for Chris.
- [ ] TOOL-CATALOG.md and the home-page tool counts still match.
- [ ] Token budget test output (compact and catalog listing sizes) pasted in the PR.
- [ ] TASKS.md ledger updated.
- [ ] PR body follows the template and is readable by a non-developer.

## Checklist Chris uses before merging

1. The "What this does (for Chris)" section makes sense to you. If it does
   not, ask; do not merge.
2. The Proof section shows real test output, not just "tests pass".
3. If the PR says it can move money, it also says what it asks you first.
4. If the PR asks you to set something in Vercel or Stripe, do that first,
   then merge.
5. After merge, Vercel shows a green deploy and the server's home page shows
   the tool count the PR says.
6. Say "merged <CARD>" to the implementing model so it starts the next card.

## When the model gets stuck

- Stripe says "permission" on a restricted key: the key lacks that permission.
  Do not switch to a full secret key; add the permission to the key's list in
  DEPLOY.md and tell Chris which box to tick in Stripe.
- A field or endpoint the toolkit used does not exist: check Stripe's
  changelog for the pinned API version (FINDINGS.md bugs 1–3 are examples) and
  use the replacement.
- stripe-mock rejects a request but the unit test passes: trust stripe-mock;
  the request shape is wrong.
- Unsure whether something moves money or can be undone: treat it as if it
  does and cannot.
