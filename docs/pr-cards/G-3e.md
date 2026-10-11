# G-3e — Irreversible TEST Identity cancel and redact
Status: MERGED (#101) as-if-merged; exact-head CI/self-review required.
Baseline inspected: dca5ad81c5c0982cadae4735c29a78d2c1a5f8b2 (#100 merged). Approved: BATCH-G §4 G-3; parent G-3.
Risk area: irreversible Identity mutation and verification PII. No migrations, LIVE, spending or privilege changes.
Read only: AGENTS, SESSION-START, identity-sessions.js, billing-shared.js, write.js,
app-guard.js, BATCH-G G-3, G-3d and the G-3 implementation-guide route.
## Drift checklist A
| Assumption | Verified at main / pinned SDK | Correction and evidence |
| --- | --- | --- |
| Any state can cancel | Stripe only permits requires_input | Preflight exact session/state and null redaction |
| Redaction is instantaneous | Stripe may process for four days | Only confirm request seen in processing/redacted state; never claim data erased |
| Raw verification object safe to log | Contains client_secret and PII | Provider raw only inside guard; preview and read-back use IDs/state |
| Live or ordinary profile can mutate | G-3 full-only, TEST-only | Name-call and profile denial tests |
## Existing and proposed file mapping
Existing: src/tools/identity-sessions.js identitySafe; billing-shared.js client, validateFields,
fullProfiles; write.js defineWrite; app-guard via defineWrite.
New: src/tools/identity-lifecycle.js (two distinct factories, no raw read responses).
Input sessionId -> GET /v1/identity/verification_sessions/:id, exact vs_ ID, object,
TEST livemode, status, redaction before either POST; then POST /:id/cancel or
/:id/redact with stable per-tool idempotencyKey; fresh GET /:id read-back.
cancel requires requires_input, expects canceled and null redaction; redact
requires requires_input|verified, expects processing|redacted redaction status.
No reports/files/client_secret/metadata emitted by either result or audit.
## Sequence and fixtures
1. Implement input and status preflight, strict TEST/profile guard and privacy-safe preview.
2. Implement isolated native API call and independent read-back for each tool.
3. Register names and assert exact registry/write/profile counts.
4. Fixtures: requires_input->canceled; verified->processing redaction; canceled/
processing/invalid ID/unknown args denied with no write; mismatched read-back
uncertain; private sentinel absent from result/audit; app-owned metadata guarded.
5. Run: npx vitest run tests/unit/identity-lifecycle.test.js tests/unit/registry.test.js
tests/unit/profiles.test.js; npm run test:mock -- tests/mock/identity-sessions.test.js;
npm run check; npm test; exact-head five CI jobs.
Stripe API reference: https://docs.stripe.com/api/identity/verification_sessions/cancel and
https://docs.stripe.com/api/identity/verification_sessions/redact.
Next: G-3 closure check (DRIFT-PROTOCOL C), then G-4 JIT events/webhook cards.
