# G-4f — Owner-visible signed TEST receipt evidence (#160)
Status: MERGED (#160) as-if; all six exact-head CI checks and self-review required.
Baseline: 213cb0abb57789b42153c8e7b0c13356ed3583b8; #153 receiver already stores metadata-only signed receipts.
Drift A: durable signed metadata rows are written by receiver but owner cannot
query a known event on the existing protected setup page. Genuine provider
delivery has not been independently observed.
Implementation: exact owner-only account/endpoint/event POST readback reusing
existing strict origin, CSRF, passphrase and login lockout. TEST connection/live-off
gate, strict result type/identity/time checks, no body/keys/signing material.
Unit adversarial tests and real disposable PostgreSQL scope readback.
No Stripe writes, webhook registration or Vercel protection weakening.
Drift B: STATUS/OWNER-GUIDE/ARCHITECTURE/GO-LIVE and this card.
Still PENDING: actual external signed TEST event, network protection verification,
Toolkit Hub D-4 three routes, full service conformance, OAuth, G-5/G-6 and H-1.
