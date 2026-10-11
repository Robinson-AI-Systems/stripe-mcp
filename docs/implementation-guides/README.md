# Implementation guides — look up one recipe, then build

Execution aids for Sol 5.6 and any other implementer. These guides describe **existing code** and **proposed work**;
they do not approve new scope, replace AGENTS/designs/cards, change owner consent, or relax checks.

Verified baseline: `2a71f8a03845ad3bf8c8de9de4207a72596ace78` (main, #93 merged, 2026-10-11).
No open PRs at inspection. G-2d is next according to STATUS and G-2's approved slice list.
Recheck GitHub and drift checklist A before using any path or number here; this is a dated code map, not a queue.

## Read only the applicable section

| Task | Open |
| --- | --- |
| Write a JIT card | [RECIPES §1](RECIPES.md#1-card-packet) and the relevant remaining-work row |
| Add a native read/write | [RECIPES §2–3](RECIPES.md#2-native-tool-recipe) |
| Touch money, SQL or secrets | [RECIPES §4–5](RECIPES.md#4-money-and-database-recipe) plus AI-PR-READ-FIRST |
| Plan later approved scope | One row in [REMAINING](REMAINING.md); then its design heading |
| Implement the next eligible slice | [G-2d worked example](G-2d-WORKED-EXAMPLE.md) after fresh-state reconciliation |
| Verify and hand off | [RECIPES §6](RECIPES.md#6-validation-and-completion-evidence) |

## Why this layer exists

Recent code shows recurring research and integration work: locating the actual module (the target START-HERE map
names future files), translating camelCase arguments to pinned SDK fields, rebuilding provider preflight/ownership
checks, rediscovering fake DB versus isolated Postgres fixtures, and missing exact registry/count assertions.
The seven-case helper needs a real handler factory and a fixture that models state changes, not a generic substitute.
stripe-mock verifies request compatibility but does not prove state transitions. The guides put those facts next to
the steps that need them. No claim of measured speed improvement is made.

## Keep just-in-time planning

Only the current card and, when useful, its immediate successor receive executable packets. REMAINING is a route map,
not distant execution cards. Proposed paths/fixtures below must be confirmed or replaced in the implementing card.
Before editing a packet, inspect open PRs and changed paths. A planning PR must not edit another in-flight card,
its status line or work-index entry (DRIFT-PROTOCOL). Add a carried note here instead; reconcile once at its PR boundary.
When behavior ships, update the relevant recipe facts and successor inheritance. Never copy a baseline count forever.
