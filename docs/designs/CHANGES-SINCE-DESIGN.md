# Changes since design

Dated entries only: contract changes (signatures, tables, guard behavior, defaults) that later cards inherit and that
are not yet in their design. A card consuming an entry says so; batch close-out (DRIFT-PROTOCOL C) retires consumed entries.

(none yet)

**2026-10-10, A-4b mechanical packaging:** The approved design called for one vendored `<version>.json` Stripe OpenAPI file. GitHub's remote create-tree tool rejected the 10.9 MB payload, so the implementation stores the exact unmodified source in 23 ordered byte-preserving parts. The loader reconstructs it and checks the upstream Git blob SHA-1 and declared API version, and the verifier prints a SHA-256 digest. No Stripe endpoint, field or contract has been omitted. The following cards use `scripts/stripe-openapi.mjs`, not a direct hardcoded JSON file path.

**2026-10-10, V-1b4d pinned Stripe TEST-clock provenance exception:** The approved Batch V design asks every seeded Stripe object to carry rtc_run metadata, but official TEST clocks expose frozen_time and name, not metadata. For TEST clocks alone, require the exact name RTC DEV RUN + immutable run ID + index, independently verify the provider TEST clock ID and state, and durably record that ID in account-scoped dev_run_objects. All other seeded objects continue to require rtc_run metadata. Cleanup must use the recorded clock ID and handle dependent Stripe objects safely; do not query approximate names or infer deletion. This is an API-semantic accommodation, not old-toolkit compatibility or a weakening of owner money approval.

## 2026-10-11 — G-4 automated acceptance and G-5 inheritance (#113)
Event safe readers #103, webhook safe readers #104, subscription writes #105, creation ledger and one-time owner handoff #108/#109, endpoint maintenance #110, and encrypted owner-provisioned verifier and revocation #111/#112 are shipped. The native signing secret is verified against an exact encrypted account+endpoint pairing; all provider-connected TEST smoke is pending. G-5 inherits existing `billing-shared` TEST-only guarded reads, `src/stripe/client.js` provider identity, safe projections and `stripe_where_is_setting` guided fallback. No LIVE, money, privacy or owner-consent contract changed.
