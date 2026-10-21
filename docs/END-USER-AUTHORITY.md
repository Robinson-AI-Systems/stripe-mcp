# End-user authority versus developer-agent restrictions

**Owner decision: October 16, 2026.** This overrides interpretations of implementation-agent rules as permanent restrictions on the capabilities offered to actual users. It is a product-architecture decision, not permission for the current implementer to incur charges or change live accounts.

## Separate actors

**Developer coding agents** build, test, verify, review and deploy the service. Their $0 unauthorized-spending, no-unapproved-live-action, production-off, release, acceptance and fixture restrictions remain in force during implementation. These restrictions are not end-user product requirements.

**The end user and the end user's delegated agent** must be able to perform **every feasible provider-supported operation within their actual permissions**, including paid or metered resources, financial operations, access/security administration, live/production changes, deletion and other irreversible actions. Show meaningful cost, risk, scope, privacy and reversibility notices. Support the user's choice of delegated authorization, optional caps and per-action approvals; impose additional confirmation only where the provider, law, or the user's own policy requires it. A developer-only approval cannot silently prevent a genuinely entitled user or their properly delegated agent from carrying out the action.

## Product implementation contract

- The provider and end user's credentials, entitlements, revocations, account/tenant scope, user-configured policies and platform protections are binding. User delegation never bypasses those, grants another person's authority, or permits leaking confidential credentials.
- A sensitive action must have a useful preview/warning when practical. Disclose genuine price estimates and **unknown or unbounded metered exposure**, without misrepresenting unknown cost as $0. An uncertain price is **not in itself** a reason to make a provider-supported action forever read-only or “guide only.”
- Implement real execution for supported APIs with correct permissions, journal/replay controls, verification and explicit failure/uncertainty reporting. Guided paths are only a legitimate final outcome if the provider itself requires an unavailable/manual interaction; missing implementation remains a roadmap gap, not an accepted feature.
- Optional limits chosen by users are legitimate. **Do not inherit the developer's defaults** such as $0 autonomous spending, scratch-only mutations or production-off as permanent user restrictions. Do not weaken the developer's independent prohibitions while coding/testing this requirement.
- Audit code, design, catalog, setup defaults, decisions and tests for unconditional blockers on spending, security, destructive work, production, owner/admin changes and money-out. Classify each: developer-only, true provider constraint, user-configured delegation, or missing product capability. Remedy the latter through the normal repository roadmap and review/CI/release workflow.

## Acceptance expectations

Tests must separately prove: (1) developer/CI actors cannot spend or mutate real/live resources outside their approvals; (2) properly entitled end users and their agents can execute provider-supported actions after the user-configured authorization and accurate warnings, including operations prohibited to our developer agents; (3) out-of-scope, revoked and improperly delegated actions are still blocked; and (4) financial/irreversible effects are journaled without unsafe retries.

This decision applies across **GitHub MCP, Stripe MCP, Vercel MCP, Neon MCP, Google Workspace MCP, Robinson's Toolkit Hub**, and applicable user-facing projects. Service-specific authority boundaries, including the distinction between tenant/customer/owner/admin roles, remain real and enforceable. This documentation update does **not** certify that runtime remediation or live acceptance has completed.

## Maximum legitimate authority — 2026-10-21

[MAXIMUM-AUTHORITY](designs/MAXIMUM-AUTHORITY.md) and CAP-1..CAP-5 are the approved
inventory, setup, additional-grant and coverage work. Standard includes the fullest
ordinary supported authorization; God Mode is optional enrollment, never a provider
or tenant bypass. Robinson AI Systems may act as developer/operator/customer in
separately authorized contexts; company identity alone decides none of those roles.
Provider-specific explicit approval rules remain as stated in the design.

## Organizational identity and role separation — owner 2026-10-21

Robinson AI Systems may act as developer/operator, explicitly scoped product administrator,
or an ordinary production tenant. Authorize environment, principal, tenant/workspace, active
role, owned provider connection and operation independently. Never derive administrator status
or developer-only restrictions from company email/domain; never use operator keys as a fallback
for another user. Reauthorize context switches and isolate accounts, data, credentials and sessions.

Existing owner-centered key enrollment is not complete independent customer authentication.
CAP-2/CAP-3/CAP-5 retain multi-user enrollment, secure migration, principal-owned connections,
provider/account switching, refresh/revocation/reconnect and real client proof. New client-owned
OAuth disconnect fixes only one lifecycle gap. Preserve IN-05's distinct independent approval
for every AI money-out and shared per-account daily limit; that express transaction protection
is separate from developer-only TEST/$0 restrictions and is not waived by this directive.
