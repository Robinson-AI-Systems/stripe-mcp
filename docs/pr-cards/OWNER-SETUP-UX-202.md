# OWNER-SETUP-UX-202 — owner setup workflow consolidation

Status: proposed PR #202 based on merged #201, no production deploy. Owner requested holistic page audit rather than one fix per Vercel release.

**Problems verified in source:** Owner TEST form offers manual account ID despite saved encrypted enrolled accounts; 8 advanced owner forms/groups all presented at once; one-time reveal and explicit approval intents render below unrelated forms; GET selectors accepted arbitrary lengths/types; only canonical-alias redirect carried no-referrer header. Existing password, CSRF, Origin, no-store and staged money/LIVE gates are retained.

**Changes:** Keep TEST smoke prominent. Add password-protected metadata-only saved TEST account lookup; cap and validate storage rows, escape labels, never show secret or live-only account. Relocate private one-time reveal and independent final confirmation panels before static forms. Group advanced forms using native details/summary, preserving each existing server action and confirmation check. Limit GET intent selectors to 32 safe characters, suppress referrers, deny frames.

**Tests:** One copy per 13 top-level owner action, native groups, one-time secret on first viewport, verified account directory after passphrase only, malformed directory never rendered, safe GET selectors/headers and existing money/one-time tests. All exact-head seven GitHub CI jobs, self-review and unresolved-review audit; final-main checks. Avoid direct live promotions per user request; plan one consolidated owner TEST acceptance release after entire audit.
