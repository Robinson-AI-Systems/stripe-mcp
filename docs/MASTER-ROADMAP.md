# MASTER ROADMAP — the one handoff

Written 2026-10-10 for an empty repository. [STATUS](STATUS.md) holds current state; [PLAN](PLAN.md) holds acceptance.

## What is next

**Now:** B-8 owner approvals #35, full Batch C #36, D-1 native TEST customers #37, D-2 payments/refunds #38 and D-3 hosted Checkout/portal #39 are merged. **D-4** all 21 TEST-native subscription/item/schedule tools in PR #40 and PR #42; **D-5a #43** invoice reads/drafts merged; D-5b #45 merged; D-5c #46 merged; V-1a #47 merged; V-1b1 #48 merged; V-1b2 owner-approved TEST seed refund PR #49 pending CI; V-1b3 remaining simulations next. Merge only after exact-head green CI. Keep ~500-line coherent PRs and exact-head CI. Money-out requires independent owner consent and $500/account/Colorado-day cap; IN-06 LIVE stays OFF.

## Order and why

| Stage | Batches | Why in this place | Owner gate |
|---|---|---|---|
| 1 Foundation | A | Nothing works without it | IN-00, IN-01; IN-02/IN-03/IN-04 before A-5 can be tried for real |
| 2 Safety | B → C | Every later tool is built on the safety layer and the context rules | IN-05 (daily limit default) |
| 3 Everyday money and building | D → V → G → H | The everyday Stripe jobs, then the developer tools that make building any project with Stripe fast (test data, cleanup, test events, forwarding, time travel); G and H cover account settings and branding | — |
| 4 Projects | P → W | Optional project profiles and readiness for any app you build (Appliance Desk is the first example), and the one-sentence jobs | IN-08, IN-09, IN-10 (only for using the Appliance Desk profile for real) |
| 5 Everything else | U → R | Universal access; the contract doors Robinson's Toolkit (the hub) uses to reach this server | — |
| 6 Later | E → X | Catalog, Stripe Tax, usage billing and quotes (the universal tools reach them meanwhile); undo and smoke test close out | — (IN-12 answered: no legacy compatibility) |
| Live | GO-LIVE-CHECKLIST | Only after Chris authorizes live per account | IN-06 |

## Implementing agent — paste this

> Read `docs/SESSION-START.md`, STATUS and the next card (plus its resume note `docs/pr-cards/<ID>.progress.md` if
> present). Find the cited design headings and named code/tests in bounded sections. Run the drift protocol checklist A
> against latest main. If no card exists, write one short card from the approved design (`docs/pr-cards/README.md`) with
> exact current paths, money/secret/guard boundaries, meaningful tests and completion evidence. Routine details are yours
> to implement; a missing money/security/schema decision needs a reviewed amendment, not a guess. Implement a coherent
> unit, run the targeted checks, push once. While checks run, implement only the eligible immediate successor. Fix
> blocking findings in one patch, refresh exact-head gates, merge when authorized and green. Update the card, STATUS and
> `work-index.json` as if merged. Continue while eligible work exists; stop only for a real gate, with committed work and
> the exact next action.

## Work coverage

`docs/pr-cards/work-index.json` is the machine-readable list (`python3 docs/pr-cards/validate-index.py`). **JIT** = covered by
the approved design; write the card when its predecessor is real.

| Batch | Cards | Card status |
|---|---|---|
| A Foundation | A-1 repo, CI, checks · A-2 schema · A-3 login · A-4 Stripe client + OpenAPI index · A-5 key store, setup page, one-time secrets · A-6 DEPLOY.md | A-1 (#9), A-2 (#10), A-3 (#11/#12), A-4 (#13/#14), A-5 (#15/#16), A-6 (#17): complete |
| B Trust | B-1 safety + money · B-2 live guard · B-3 app guard · B-4 errors · B-5 shaping · B-6 profiles · B-7 check-writes · B-8 server tools | Complete through #35; LIVE gate remains OFF |
| C Context | C-1 small results · C-2 listing modes + budgets | Both merged in #36 |
| D Everyday money | D-1 customers · D-2 payments/refunds · D-3 checkout/links/portal · D-4 subscriptions · D-5 invoices/credit notes | D-1 #37, D-2 #38 and D-3 #39 merged; D-4 #40 + #42 complete ; D-5a #43 merged; D-5b #45 merged; D-5c #46 merged; V-1a #47 merged; V-1b1 #48 merged; V-1b2 #49 pending CI; V-1b3 NEXT |
| V Developer tools | V-1 seed + runs · V-2 cleanup · V-3 trigger events · V-4 event forwarding · V-5 test clocks, simulation, test cards | V-1a #47 merged; V-1b1 #48 merged; V-1b2 independent refund #49 pending CI; V-1b3 simulations next |
| G Money out & account | G-1 balance/payouts/reports · G-2 disputes · G-3 Radar/Identity · G-4 events/webhooks · G-5 account settings · G-6 owner and administration | JIT |
| H Branding | H-1 branding and setup | JIT |
| P Project profiles | P-1 known_apps + Appliance Desk · P-2 record links · P-3 app readiness · P-4 project setup | JIT |
| W Workflows | W-1 … W-10 (`designs/BATCH-W.md` §4 table) | JIT |
| U Universal | U-1 | JIT |
| R Hub-ready doors (RTC 1) | R-1 passes · R-2 HTTPS API, manifest, OpenAPI · R-3 conformance in CI | JIT |
| E Catalog etc. | E-1 … E-4 | JIT |
| X Close-out | X-1 undo · X-2 smoke test | JIT |
