# Designs

One file per batch. A design is the semantic contract: decisions (made, not "consider"), schema, shared primitives,
work units, stop-and-ask points and acceptance mapping. Cards implement from it; cards may fix mechanical details but
never silently change a decision. Changes are dated entries under "Amendments". Contract changes later batches inherit
go in `CHANGES-SINCE-DESIGN.md`. New designs start from `TEMPLATE.md`.

| Batch | File | Status |
|---|---|---|
| A Foundation | [BATCH-A](BATCH-A.md) | Approved 2026-10-10 (IN-00) |
| B Trust layer | [BATCH-B](BATCH-B.md) | Approved 2026-10-10 (IN-00) |
| C Cheap on context | [BATCH-C](BATCH-C.md) | Approved 2026-10-10 (IN-00) |
| D Everyday money | [BATCH-D](BATCH-D.md) | Approved 2026-10-10 (IN-00) |
| V Developer tools (test mode) | [BATCH-V](BATCH-V.md) | Approved 2026-10-10 (Chris: "a powerful development tool") |
| G Money out, disputes, risk, events, account | [BATCH-G](BATCH-G.md) | Approved 2026-10-10 (IN-00) |
| H Branding and setup | [BATCH-H](BATCH-H.md) | Approved 2026-10-10 (IN-00) |
| P Project profiles | [BATCH-P](BATCH-P.md) | Approved 2026-10-10 (IN-00) |
| W Workflows | [BATCH-W](BATCH-W.md) | Approved 2026-10-10 (IN-00) |
| U Universal tools | [BATCH-U](BATCH-U.md) | Approved 2026-10-10 (IN-00) |
| R Hub-ready doors (RTC 1) | [BATCH-R](BATCH-R.md) | Approved 2026-10-10 (IN-00); amended 2026-10-10 (hub architecture) |
| E Catalog, Stripe Tax, usage | [BATCH-E](BATCH-E.md) | Approved 2026-10-10 (IN-00) |
| X Undo, smoke test, toolkit decision | [BATCH-X](BATCH-X.md) | Approved 2026-10-10 (IN-00) |

Governing contracts (not batches; these bind the batches above):

| Contract | File | Status |
|---|---|---|
| Maximum legitimate Stripe authority (CAP-1…CAP-5 plan) | [MAXIMUM-AUTHORITY](MAXIMUM-AUTHORITY.md) | Approved plan 2026-10-21; future engineering, not completed implementation |
| Brand and domain contract | [STRIPE-BRAND-DOMAIN](STRIPE-BRAND-DOMAIN.md) | Approved by owner 2026-10-23; target, not yet activated |
| Connection, independent identity and optional God Mode | [STRIPE-CONNECTION-GOD-MODE](STRIPE-CONNECTION-GOD-MODE.md) | Owner-approved 2026-10-23; engineering not completed by the design |
