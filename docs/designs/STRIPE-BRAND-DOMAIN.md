# Stripe MCP — Robinson AI Systems brand and domain contract

**Approved by owner 2026-10-23; target, NOT yet activated.**

## Publisher identity and product naming
- Product display name in OAuth, install, client approval, connection management,
  notifications, metadata, footer and support: **Stripe by Robinson AI Systems**.
- Company/publisher name: **Robinson AI Systems**; use the exact legal suffix
  only when the company's validated legal name and required provider fields demand it.
- Use the **existing** company's R logo/wordmark, favicon and brand tokens;
  do not fabricate a new Stripe/R symbol, impersonate Stripe's logo, or
  overwrite the parent corporate brand.
- Source of truth: `Robinson-AI-Systems/robinson-ai-systems/assets/brand.css`,
  `assets/logo.png`, `assets/favicon.png`, and company `docs/DOMAINS.md`.
  Current brand tokens: emerald `#00B67A`, deep green `#006E56`,
  electric teal `#00E3C2`, graphite `#1E1E1E`,
  charcoal `#0C0C0C`, mist white `#F8FAF8`,
  muted grey `#9FA5A3`; accent Arctic blue `#4DDFFF`,
  warning amber `#FFB200`, error coral `#FF5F5F`.
- Use the current company-approved asset bytes or a reviewed local copy.
  Present account permissions and TEST/LIVE money warnings prominently;
  brand aesthetics must never camouflage consent, error or scope information.

## Canonical hosted service (future target)
- Proposed final hostname: `stripe.robinsonaisystems.com`.
- Expected HTTPS MCP endpoint: `https://stripe.robinsonaisystems.com/api/mcp`.
- Discovery/issuer root: `https://stripe.robinsonaisystems.com`.
- The subdomain belongs **only to the Stripe MCP Vercel project**, never the
  parent company website deployment or optional Toolkit Hub.
- Parent company `docs/DOMAINS.md` already reserves this hostname for Stripe.
  A checked Vercel lookup on 2026-10-23 returned **Project Domain not found**;
  neither ownership verification nor DNS/routing migration is claimed.
- Current `PUBLIC_BASE_URL` points at the existing Vercel hostname. Keep it
  unchanged until DNS authority, Vercel domain assignment, TLS, provider
  redirects, exact issuer/resource and live acceptance are all verified.
- DNS nameserver authority may change during the company's registrar work.
  Read *current* authoritative nameservers before creating any record. Never
  touch MX/TXT, Workspace, GitHub, corporate www/apex or other MCP hosts.

## Safe cutover gates
1. Verify actual DNS zone authority and no conflicting record; attach the exact
   domain to the **Stripe MCP** Vercel project and confirm Vercel's required
   DNS records. Do not change existing production aliases.
2. Check TLS, discovery endpoints, account-only setup, MCP transport and
   HTTPS redirect/Origin allowlists on the custom host. No secrets in URLs.
3. Register/update **Stripe-owned App OAuth callback URLs**, accepted redirect
   lists, issuer `PUBLIC_BASE_URL`, MCP resource audience and RTC manifest
   on a tested source revision. Updating an issuer may invalidate previously
   connected tokens; implement an explicit safe transition/reconnect.
4. Independently test new sign-in, automatic mobile ChatGPT and Claude return,
   ordinary Full/read-only, optional God Mode, refresh/revoke, wrong-origin
   refusal, two independent user/tenant contexts and existing-client recovery.
5. Follow exact-head CI/review, scheduled `main`→`live` policy and independently
   confirm actual served Vercel READY SHA before declaring cutover. No automatic
   LIVE account activation or financial action.

Owner's approval of a hostname and visual design **does not grant public
Stripe App publication, LIVE payment activation or a manual release**.
