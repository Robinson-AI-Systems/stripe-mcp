# G-4 isolated owner-approved Sandbox webhook receiver (#153)
Status: MERGED as-if; exact-head five CI checks and review required.
Design: docs/designs/BATCH-G.md G-4 and PR #151 owner approval.
Drift A: Existing encrypted account+TEST endpoint signing secrets and offline
webhook_check_signature validate a pasted body, but no HTTP webhook receiver exists.
api/mcp and api/stripe/setup are not receivers. No TEST delivery accepted to date.

## Deliverable
Create a dedicated, raw-byte TEST-only POST route for an exact account+endpoint,
with owner-provisioned encrypted secret, constant-time timestamp-bounded HMAC,
explicit `livemode:false`, non-Connect original provider event, durable
unique account/endpoint/event ID replay ledger, response body free of PII and secrets.
Keep raw bodies out of tables/logs; no app-owned object updates or Stripe writes.
GET/wrong routes/absent secret/bad signature/LIVE/malformed/oversize must not record.
A 200 proves server verification and receipt persistence in that environment,
not that the genuine Stripe provider reached the production deployment.
No production protection bypass or Stripe endpoint registration this PR.
Tests: unit TEST crypto/HTTP and disposable DB integration plus all CI gates.
Drift B: schema, runtime architecture, STATUS and GO-LIVE gates recorded.
Next: owner-private native receipt lookup and a genuine owner-approved TEST
event-delivery acceptance report; no mere event/webhook listing substituted.
