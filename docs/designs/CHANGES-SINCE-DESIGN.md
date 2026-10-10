# Changes since design

Dated entries only: contract changes (signatures, tables, guard behavior, defaults) that later cards inherit and that
are not yet in their design. A card consuming an entry says so; batch close-out (DRIFT-PROTOCOL C) retires consumed entries.

(none yet)

**2026-10-10, A-4b mechanical packaging:** The approved design called for one vendored `<version>.json` Stripe OpenAPI file. GitHub's remote create-tree tool rejected the 10.9 MB payload, so the implementation stores the exact unmodified source in 23 ordered byte-preserving parts. The loader reconstructs it and checks the upstream Git blob SHA-1 and declared API version, and the verifier prints a SHA-256 digest. No Stripe endpoint, field or contract has been omitted. The following cards use `scripts/stripe-openapi.mjs`, not a direct hardcoded JSON file path.
