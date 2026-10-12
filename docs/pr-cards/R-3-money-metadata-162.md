# R-3 money metadata safety — PR #162

Status: proposed, exact-head CI and review required.
Baseline: 892917be11e2ea9ce14c1bb949045dde3827fe09.
Drift A: deployed RTC manifest counts.money=0 despite provider-derived
financial writes in the registry. Stripe guarded writes mark moneySpec
'provider-derived' and safety '$', not boolean money=true.
Implementation: shared conservative classifier drives RTC count and safe
read filter. Misclassified money-like read metadata is refused, never
allowed to execute under a read_only pass. Existing write guard unchanged.
Tests: real service manifest backed by actual registry/Postgres; adversarial
falsely-read-only money tool denied in catalog and direct HTTP call.
Drift B: STATUS; RTC full-role conformance and real Hub D-4 remain pending.
