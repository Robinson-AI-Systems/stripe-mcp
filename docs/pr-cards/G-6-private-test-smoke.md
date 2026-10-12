# G-6 follow-up — Private owner-initiated native TEST readbacks (#141)
Status: as-if-merged; exact-head CI, review and merge required.
Approved G-4/G-5/G-6 external acceptance aid, not H-1 or Dashboard completion.

## Drift A
The existing CLI custom MCP smoke requires a separate plaintext TEST key in a local process, although a server-scoped encrypted TEST credential is already enrolled. The private setup page already authenticates origin/CSRF/passphrase with shared SQL lockout; no background agent, SQL ciphertext query or generic Stripe connector is authorized. The protected owner page can intentionally invoke the same bounded read-only handlers through the normal runtime key loader, never returning the key. Do not disable Vercel SSO just to use it.

## Acceptance
- Only owner-authenticated POST for one exact TEST account may request the smoke. GET, wrong passphrase/origin/CSRF or invalid account causes no provider access.
- Eight registered `readOnlyHint` handlers only; no write, zero outgoing money, no LIVE, no AI-issued consent, no new key permission.
- Exact TEST provider identity precedes any downstream handler. The only returned values are tool names and one of observed/partial/not_readable/error. No raw Stripe data, SDK error, key/ciphertext, account label or internal exception.
- Unit tests cover auth gate, no-provider-call rejections, foreign/malformed provider reply, and browser output redaction. Five exact-head CI gates, self-review and threads required.
- Owner must actually submit a private session and separately compare signed-in TEST Dashboard to satisfy external G-4/G-5/G-6 acceptance. No acceptance was executed in CI.
