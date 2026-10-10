# Stripe OpenAPI — pinned upstream source

- Provider: Stripe, public `stripe/openapi` repository.
- Immutable tag: `v2556` (released October 10, 2026).
- Exact upstream file: `openapi/spec3.sdk.json`.
- Source URL: https://github.com/stripe/openapi/blob/v2556/openapi/spec3.sdk.json
- Git blob SHA-1: `509de1b4510d2c03ad8755d06778c1deb5619c7f`.
- API version: `2026-09-30.endive` (the `stripe@23.0.0` SDK version).
- Stored as 23 byte-preserving `spec3.sdk.partNNN` files because GitHub's tree-upload endpoint could not receive the 10.9 MB file as one payload. The loader reconstructs the original bytes and rejects any mismatch against the published Git blob. No data has been trimmed or replaced by a partial index.
- Run `node scripts/openapi-find.mjs --verify` for the SHA-256 checksum and exact path count, or `node scripts/openapi-find.mjs "create refund"` for a bounded search.

Never edit a part by hand. Upgrade only in its own card after reviewing the Stripe API changelog.
