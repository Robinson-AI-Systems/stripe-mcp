## October 23, 2026 — simpler login and optional advanced authority (approved design)

The planned default connection for **Stripe by Robinson AI Systems** is:
add remote MCP to ChatGPT/Claude → verify the person → visit Stripe's owned
App OAuth installation/consent → approve one clear, account-scoped final
client page → return automatically. The existing owner-only key setup
continues to work while the new system is built. The [full specification](
designs/STRIPE-CONNECTION-GOD-MODE.md) distinguishes the Stripe App account
grant from the human identity and explains TEST/LIVE and consent guards.

**God Mode is optional**: connect additional verified account/organization
credentials only if the desired operation genuinely needs them. Stripe does
not have GitHub's one all-scopes classic master token. Credentials are never
pasted in ChatGPT; if manual key creation is unavoidable, use a protected
one-use server form. Users can manage owned accounts, per-client permissions,
read-only setting, disconnect and credential revocation in the proposed My
Connection area. This is planned, **not already live**; the source-only
CAP-1 inventory cannot attest real provider permission or Stripe App install.

