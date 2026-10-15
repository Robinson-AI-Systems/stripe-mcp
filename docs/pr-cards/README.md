# Execution cards — just in time

Same system as Appliance Desk. The implementing agent writes a short card for the current unit and, when useful, its
immediate successor. Sol 5.6 at light/medium effort is the intended routine use. Avoid writing distant cards whose
prerequisites are hypothetical; `work-index.json` preserves all later scope. A missing card is work, not a reason to stop.
Designs govern behavior; cards cannot silently override them. A card is not an automatic PR or bundle boundary. Keep existing IDs and full acceptance; do not subdivide scope to inflate completion.

Group related endpoints via [development efficiency](../DEVELOPMENT-EFFICIENCY.md) under AGENTS' bundle/card/PR rule while preserving actual independent safety/approval controls.

## Minimum card (usually 40–100 lines)

Keep one finite consumer/fixture checklist for the selected outcome: actual symbol
and caller, required input/result shape, persistence/provider boundary, role/scope,
full synthetic fixture and refusal/recovery proof. Reuse existing recipes/decisions;
check the real adapter/form control early. This is detail inside the current card,
not another planning document, invented subsection or separate approval ceremony.

- ID, title, design section, prerequisites, "Baseline inspected" SHA.
- Risk/permission boundaries, migration ownership/order (if any), honest workload estimate and bundle subsection IDs. No per-card line ceiling; group related whole cards using the governing bundle/card/PR rule while preserving every independent guard and proving test.
- **Read only these:** a bounded list of design headings and files (with line ranges when long).
- Drift check A table (or "first card: no prior code").
- Build contract: files, exported signatures, which tools (by TOOL-CATALOG name) with their safety marks, money spec,
  app/live guard notes, summaries used, Stripe operations (method + path from `scripts/openapi-find.mjs`).
- Named tests: unit, write-contract per write tool, stripe-mock per call, db when SQL changes.
- Commands to run (with `set -o pipefail` when piping).
- Done when: observable conditions; what the successor inherits.

Validate coverage with `python3 docs/pr-cards/validate-index.py`.

## Concrete execution packet

Use [RECIPES §1](../implementation-guides/RECIPES.md#1-card-packet) for the compact packet format. Each new card must
identify existing versus proposed paths, argument-to-SDK/SQL/read-back mappings, ordered steps, fixture initial states
and expected outcomes (including zero-write failures), focused runnable checks and successor inheritance. Link applicable
recipe sections instead of repeating rules. The [remaining-work route map](../implementation-guides/REMAINING.md) helps
locate current patterns; it is not permission to prewrite distant cards. The
[G-2d example](../implementation-guides/G-2d-WORKED-EXAMPLE.md) demonstrates the next slice at its dated baseline.
Reconcile the real predecessor and in-flight work before promoting any proposed packet into a card.

## Effort guide for Sol 5.6

Light: read tools in an area whose pattern already exists; docs cards. Medium: safety layer, guards, money tools, keys,
login, passes, universal tools, anything touching SQL. A Sonnet/Opus second opinion is optional and limited to one
concrete question; no mandatory model switch.
