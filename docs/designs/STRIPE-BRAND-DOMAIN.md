# Stripe MCP — Robinson AI Systems brand and domain contract

**Approved by owner 2026-10-23; target, NOT yet activated.**

## Publisher identity and product naming
- Product display name in OAuth, install, client approval, connection management,
  notifications, metadata, footer and support: **Stripe Unleashed by Robinson AI
  Systems** ("Stripe Unleashed" after first reference). Fleet naming rule,
  2026-10-30: a provider-connector MCP is "<Provider> Unleashed by Robinson AI
  Systems"; this supersedes the product name in the 2026-10-23 approval (see
  DECISIONS, 2026-11-02).
- Company/publisher name: **Robinson AI Systems**; use the exact legal suffix
  only when the company's validated legal name and required provider fields demand it.
- Product mark: the Unleashed **Break-Out** (thick ring snapped open at the
  upper right, one shard bursting out at 45°; ring in the master emerald
  `#00B67A` → teal `#00E3C2` gradient on charcoal). This corrects the earlier
  plan to use the company's R logo as the product identity: the R
  logo/wordmark remains the Robinson AI Systems publisher/company mark, and
  favicon and brand tokens still come from the company brand. Do not fabricate
  a new Stripe/R symbol, impersonate Stripe's logo or mark, or overwrite the
  parent corporate brand.
- Product accent (shard color): **Magenta `#E35FD0`**, the next unclaimed
  accent in the D-005 claims-registry order — **planned claim, not yet
  filed**. File it in the registry in the same change that ships the first
  branded surface, per the registry's four-step claim procedure (read
  registry → take next unclaimed → file with the first branded surface →
  verify by read-back). The Arctic/amber/coral tokens below are functional
  palette colors, not this product's accent.
- Every connect page, listing and docs front page carries the disclaimer:
  "Stripe Unleashed is a Robinson AI Systems product. It is not affiliated
  with, endorsed by, or sponsored by Stripe, Inc." Where Stripe publishes
  brand guidelines, the stricter rule wins.
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
- **Identity anchoring (fleet rule, 2026-11-01):** `PUBLIC_BASE_URL` is the
  ONE configured source from which the issuer, authorization/token/
  registration/revocation endpoints, protected-resource URI, hosted
  client-identity documents, front-door facts, contract advertisement and
  connection instructions are all derived. The Vercel deployment address is
  a serving alias, never the identity; discovery fetched from the alias
  names the canonical branded issuer; a connection minted against the
  platform domain is a defect even when it works. The cutover below moves
  the identity as one ruled change, never as a side effect of attaching
  the domain.
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
