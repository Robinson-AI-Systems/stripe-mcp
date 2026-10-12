# R-4c — RTC TEST Bearer and stored pass integrity (#173)
Status: MERGED (#173) as-if; review and seven exact-head checks required.
Baseline: 4c27769b36e6777ec111196dfa5f53ac48654632; stacked after parsed-body boundary #172.
Drift A: HTTP authentication schemes are case-insensitive but RTC accepted only literal Bearer; revoked/expired and unknown syntactically valid credentials emitted 401 with no WWW-Authenticate challenge. A corrupted stored result_scope/client_id could reach a scoped read dispatch without identity checks.
Implementation: case-insensitive scheme only; exact pass bytes retained; safe RFC-style invalid_token challenge for known-shape unusable passes, no echoed token; validate RTC agent ID, Stripe TEST account ID, and server-assigned UUID result_scope before dispatch.
Tests: mixed-case header, unchanged token bytes, bad formats, missing/owner-revoked/expired challenge; corrupt stored identities and result scope fail-closed.
Drift B: no default permission increase, Stripe keys, writes or migrations. No LIVE, money-out or manual Production. External D-4 remains pending.
