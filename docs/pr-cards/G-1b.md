# G-1b — Own-account payout bank summaries and schedule reads
Status: MERGED (#80, as-if-merged; exact-head CI/review pending).
Design: docs/designs/BATCH-G.md §§0,1,4 G-1.
Baseline: current main ef979ebe (#79). Risk: bank privacy, account scope.
No migrations or money moving; TEST-only.

## Drift check A
| Assumption | Confirmed Stripe/API reality | Correction |
| --- | --- | --- |
| Own-account external banks always listable | GET /v1/accounts/:id/external_accounts is documented for CONNECT accounts; own account may be denied | Independently retrieve own account identity and attempt exact endpoint; on 401/403 report unavailable+dashboard guidance, never invent an empty result |
| Bank metadata is safe as-is | Stripe bank object can contain account/routing numbers and fingerprint | Strictly project id, last4, bankName, currency, country, status and default status |
| Current account payout schedule is always readable | GET /v1/account returns settings.payouts.schedule only where exposed | Read own account, return unavailable when absent; no fabricated schedule or settings write |
| Live account is approved | Repository forbids LIVE until explicit owner activation | Retain TEST-only preflight and full profiles as read-only |

## Build contract
- New src/tools/money-bank-reads.js canonical tools
  money_list_bank_accounts, money_get_payout_schedule.
- Exact account identity from Stripe own account GET before reading payout banks;
  external accounts list with object=bank_account, bounded cursor; output never
  includes bank account number, routing number, fingerprints, account holder or PAN.
- For non-Connect own-account limitations, return explicit API-not-authorized
  status and Stripe payout-settings URL, never claim zero banks.
- Read schedule interval, delay and anchors, fail closed on malformed provider.
- Registry/profiles/disclosure counts, tool catalog, STATUS and G-1 tracked.
- Tests cover masks, authorization refusal, wrong account, LIVE refusal,
  payout schedule, bounded paging; all 5 exact-head gates before merge.
- G-1c next after #80: money-out payouts/top-ups only after independent owner
  approval per operation, shared $500/day policy and documented override.
