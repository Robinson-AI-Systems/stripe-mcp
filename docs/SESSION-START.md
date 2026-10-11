# SESSION-START — one page to begin (or resume) an implementation session

For Sol 5.6 (or any model) implementing a PR card. Read **this page and your card**, then work. Open other rule files
only when a step below names them, a section at a time. `AGENTS.md` still governs; this page is its short form.

## 1. Find your place (2 minutes)

Work happens in whatever workspace you were given (a cloud agent workspace, a Vercel Sandbox, a laptop). Code reaches
GitHub only as git commits pushed to an `ai/*` branch. Never copy source files through tool output.

1. `git fetch origin && git status -sb && git log --oneline -5`; `npm ci` once per checkout.
   **Before opening a new branch**, read existing PRs and their latest exact-head CI: a failed predecessor takes
   priority over the next card and must be corrected without a new prompt.
2. `sed -n '1,40p' docs/STATUS.md` → the **Next** section names the card.
3. Resume note? `ls docs/pr-cards/*.progress.md 2>/dev/null` — if your card has one, continue from its "Next step".
   Do not restart work it lists as done.
4. Read your card (`docs/pr-cards/<ID>.md`). If the roadmap says JIT (no card yet), write it first from the design
   (`docs/pr-cards/README.md`, 40–100 lines). Read only what the card's "Read only these" list says.

## 2. Never do these without Chris (AGENTS "Hard limits")

A live Stripe key or any live-mode write; moving real money; buying anything; a secret anywhere in code, docs, tests,
logs, PR text or tool results; changing the Appliance Desk repo or other projects; changing app-owned Stripe records;
widening default key or pass permissions; committing to `main`; skipping, disabling or weakening tests.

## 3. The work loop

1. Branch `ai/<tool>/<topic>` from latest `main` (or the card's base).
2. Drift check: `docs/implementation-contracts/DRIFT-PROTOCOL.md` **checklist A** (table in the PR, card corrected
   first).
3. Build one work unit → its tests → run them (`npx vitest run <files>`; `npm run test:db -- <file>` when it touches
   SQL; `npm run test:mock -- <file>` when it adds or changes a Stripe call) → `npm run check` → **commit locally** →
   update the resume note (§4). Repeat. Red → fix one failing file at a time, then the full check once.
4. **Code first, then docs.** In an implementation PR, edit only the docs checklist B names.
5. When the card is complete: update the docs **as if this PR had already merged** (card `MERGED (#n)`, STATUS,
   `work-index.json`, TOOL-CATALOG marks, ARCHITECTURE when infra changed — checklist B), push once, open the PR,
   then follow PLAYBOOK Steps 5–9.

## 4. Resume note — so stopping never loses your place

Keep `docs/pr-cards/<ID>.progress.md` (≤20 lines) on your branch and update it after every commit:

```
Card: B-1 · Branch: ai/sol/b-1-safety · Last commit: <sha> <subject>
Done: 1 money spec + dollar line (tests pass) · 2 daily limit
Next step: 3 read-back verify — write verify() for refunds, then its unit test
Blocked: none
```

Delete it in the card's final commit.

## 5. Anti-stall rules (AGENTS "Working without stalling" — mandatory)

- Files over ~300 lines by section only (`grep -n` the heading, then `sed -n 'A,Bp'`, ≤150 lines). Never read
  `vendor/stripe-openapi/*.json` whole; query it with `node scripts/openapi-find.mjs "<words>"` once A-4 exists.
- Every search has a path and `| head -50`. Only commands that finish by themselves; `timeout 600` for slow ones.
- Pipe long output through `| tail -80`. Same command fails twice → change approach or record the blocker.
- After ~10 reads/searches without an edit, make the smallest next edit.
- CI and reviews: check once, act on what is new, then do other work. Red CI is actionable work, not a pause.
- For new tool registrations, update registry, profile-count and discovery tests in the same commit;
  lint plus pinned SDK/stripe-mock request-shape tests precede any claim that a tool works.

## 6. Stopping

Stop only for a real gate: a hard limit (§2), a missing money/security/schema decision, or a card over 800 production
lines. Before stopping: commit, update the resume note and `docs/STATUS.md`, and say in one plain-English paragraph what
is done and what Chris needs to decide.

## Restart message for Chris to paste when a session stops

> Continue the Stripe MCP work. Read `docs/SESSION-START.md`, then your card's resume note
> (`docs/pr-cards/<ID>.progress.md`) if it exists, and pick up at its "Next step". Follow the anti-stall rules.
