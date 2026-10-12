# R-4d — Strict RTC pagination selectors (#174)
Status: MERGED (#174) as-if; seven exact-head checks and review resolution required.
Baseline: abd867cd2dcd01a5c7c16338e6d0eaad7311e338; stacked after #173 TEST pass auth hardening.
Drift A: Number(req.query) coercion accepted empty string/null/true, arrays, exponent/hex and whitespace as legitimate catalog/page offsets or sizes. Ambiguous caller input could reach scoped result retrieval rather than a stable invalid_args error.
Implementation: common decimal-only safe-integer validator for limit (1–100), catalog offset and result page (0–100000); keep omitted defaults and existing HTTP shape. Normalize catalog search keyword to lowercase for predictable matching.
Tests: valid string query, uppercase search, malformed numeric types/encodings across both endpoints.
Drift B: no schema, pass privilege, billing, Stripe write, database or deployment change. External RTC conformance and D-4 remain separate owner-approved evidence gates; LIVE disabled.
