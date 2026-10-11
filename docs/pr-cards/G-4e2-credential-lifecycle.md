# G-4e2 follow-up — independent owner credential removal and rotation
Status: MERGED (#112 as-if-merged; exact-head CI pending).
Baseline f0e77f52a4f5da963c69e274e3ddefe5d5ea90f1 (#111).
Scope: revoke only server-side encrypted TEST webhook signing material through existing private owner setup authentication. Reprovision rotates same account+endpoint ciphertext.
Input mapping: owner form account+endpoint -> independently authenticated POST (origin, CSRF, passphrase, lockout) -> scoped SQL DELETE RETURNING endpoint. Absent credential 404; successful deletion makes verification fail closed. No provider webhook delete occurs. No live, money, app-owned changes, secrets in audit or chat.
Tests: unit rotation/revocation and cross-account scoping, owner page denial/CSRF/regression, disposable Postgres DB. Exact-head CI plus resolved review threads.
Successor: automated G-4 acceptance; connected provider TEST evidence still pending.
