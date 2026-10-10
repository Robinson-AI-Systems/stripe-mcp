# Deploy Robinson Stripe MCP — owner checklist

**Status (2026-10-10):** The server is built through Batch A, but **nothing has been deployed, connected to a real Stripe account, or enabled for live payments**. Follow this only when you choose to set up the server. See [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md) for the individual approval gates.

This is a personal tool for your projects. The normal process is **set it up once, connect your AI agent once, then let OAuth refresh credentials automatically**. You should not have to keep creating API keys or signing in for routine use. An agent app may impose its own renewal or reconnection rules; we cannot override those.

## What you need

- A GitHub account with access to `Robinson-AI-Systems/stripe-mcp`.
- Your Vercel account, with any **free-tier** plan and deployment limits reviewed before provisioning (IN-02). **Do not upgrade or purchase anything for this setup.**
- A new Neon Postgres project *for this MCP* (not Appliance Desk's database), free tier where available (IN-02).
- Your own strong administrator passphrase (IN-03) and a locally generated 32-byte encryption key (IN-03).
- A Stripe **sandbox/test-mode** restricted API key for this MCP, separate from your application's keys (IN-04).
- A publicly reachable HTTPS URL for the deployed MCP. A Vercel deployment domain works; a custom domain is not required.

**Never put credentials in an AI chat, a GitHub issue/PR, the repo, an email, screenshots, or copied build logs.** Paste them only into Vercel's private environment-variable editor or the private HTTPS setup form described below.

## 1. Approve provisioning first (IN-02)

Nothing should be created or billed until you approve the Vercel project and Neon database. An implementation agent may then:

1. In Vercel → **Add New → Project**, import the GitHub repo `Robinson-AI-Systems/stripe-mcp` (not another MCP or Appliance Desk).
2. Name the project `stripe-mcp`, with the repository root as root directory and the **Other** framework preset; retain ordinary Vercel serverless functions in `api/`.
3. In Neon's dashboard, create a **separate** project for the Stripe MCP, or use Vercel Storage → Neon to connect an existing separately owned Neon project. Confirm the plan and billing impact before selecting an integration. Choose a location suitable for your account.
4. Connect the new project's Postgres URL as **`DATABASE_URL`** for the **production** deployment of this MCP only. Use a separate **isolated branch/database** for previews if you enable preview DB access; never test a PR against the live production database or a business application's database.
5. Deploy from `main`; make sure the deployment succeeds. The API uses Node/ESM. Code will create its additive tables when the authenticated server endpoints initialize.

If Vercel's Neon integration produces several variable names, **verify `DATABASE_URL` is present**. Do not assume a variable with a different name will be read.

[Official Vercel environment guide](https://vercel.com/docs/environment-variables/manage-across-environments) · [Neon/Vercel integration guide](https://neon.com/blog/neon-vercel-native-integration).

## 2. Enter these four configuration values privately (IN-03)

In Vercel → `stripe-mcp` → **Settings → Environment Variables**, configure:

| Variable | What to enter | Who enters it |
| --- | --- | --- |
| `DATABASE_URL` | The **new Stripe MCP's** Neon connection URL. Treat it as a secret. | Owner/authorized agent in Vercel only |
| `ADMIN_PASSPHRASE` | A new strong personal passphrase, preferably 5+ random words or 24+ random characters. **Not a reused password.** | Owner, not AI |
| `TOKEN_ENCRYPTION_KEY` | A fresh 32-byte cryptographic key encoded as base64url. **Save it in your own password manager**; loss makes stored keys unreadable. | Owner, not AI |
| `PUBLIC_BASE_URL` | The exact HTTPS origin of your MCP, e.g. `https://your-stripe-mcp.vercel.app`. **No** path, query, fragment, user info or trailing slash. | Owner/authorized agent |

You can generate the encryption key **locally on your own machine** in a terminal with Node installed:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url')+'\n')"
```

The output is the private key. Copy it **directly into Vercel** and your password manager; do not paste it in the conversation. Keep it stable across deployments and do not put it in `vercel.json` or GitHub. Mark sensitive variables as sensitive/hidden where Vercel offers that choice. Select **Production** for the deployable server. Give Preview its own secrets/DB if needed, and **never install live Stripe keys in Preview**.

`VERCEL_ENV` is a Vercel-managed value. Do not set or spoof it yourself.

**Redeploy** after adding/changing server variables, then open `https://<your-origin>/api`. The server should return a status object and tool count; this endpoint alone does not prove that the database and OAuth login work.

## 3. Make the MCP's own Stripe key (IN-04 — TEST only)

Open Stripe's [API keys page](https://dashboard.stripe.com/apikeys), select the intended **sandbox/test environment**, and choose **Create restricted key**. Name it something recognizable, such as `Robinson Stripe MCP - TEST`. If prompted for its intended use, select the option indicating **an AI/agent**, and review Stripe's approval rules. Do **not** use an application's existing secret key; MCP access should be separately revocable.

### Recommended permission templates

In Stripe's key editor, the setting for each resource is **None, Read or Write**. The exact grouping/label can vary with Stripe products and account eligibility; review the available resource names in your Stripe dashboard. Begin with **Read-only**, confirm the server connects, then expand only where you need it:

| Template | Resources and permissions |
| --- | --- |
| **Read only (safest first)** | Read **Account**, **Customers**, **Payment Intents**, **Subscriptions**, **Invoices**, **Products**, **Prices**, **Refunds**, **Disputes** and **Webhook Endpoints**. Everything else None. If a capability is unavailable for your account, don't grant unrelated access to compensate. |
| **Everyday (later, after safety B)** | The above readable resources, plus **Write** for Customers, Payment Intents, Refunds, Checkout Sessions, Payment Links, Billing Portal/Portal Sessions, Subscriptions, Invoices, Invoice Items, Credit Notes, Products, Prices, Coupons, Promotion Codes, Webhook Endpoints and Files; keep unrelated permissions Read/None. The exact selectable names may differ; match each operation before enabling. |
| **Full (exceptional, later)** | Broad read/write restricted-key permissions when required for owner administration and explicitly approved. Prefer restricted permissions rather than a general `sk_test_` key; don't enable unused categories just to avoid setup. |

**Current implementation limitation:** The A-5 setup page stores **one active test key per Stripe account**, replacing the previous key when a new one is saved. These three lists are *permission templates*, not three simultaneously selectable keys or connection profiles. The OAuth `read_only`/`everyday`/`full` profile selection controls **MCP tool permissions**, not the Stripe restricted key's grants. More key-routing and write tools arrive in later batches. Stripe may require **additional read grants** for the nine harmless permission probes even when the eventual workflow doesn't use them.

Stripe's own documentation: [restricted keys](https://docs.stripe.com/keys/restricted-api-keys) and [API keys and agent approvals](https://docs.stripe.com/keys). Never create or enter a `rk_live_`/`sk_live_` key at this stage; the setup page refuses live keys.

## 4. Enter the key on the private setup page, once

In your own browser, open **`https://<your-origin>/api/stripe/setup`** over HTTPS.

1. Type your `ADMIN_PASSPHRASE`, paste the **test restricted key** from Stripe directly into this form, and optionally give the account a descriptive label.
2. Press **Verify account and save encrypted test key**. The server verifies the Stripe account and checks relevant readable permissions. If a permission isn't allowed, it records that limitation; if verification fails entirely, review the key's permissions or mode in Stripe.
3. The page should show the **TEST** account label, account ID, key type and **last four characters only**. **Never send a key through an AI tool**.
4. The encrypted key stays on the MCP server's own Neon database. It is **not** copied to the GitHub repo or handed to your assistant.
5. Each additional Stripe **test account** uses its own test key. An account is selected during OAuth connector authorization.

Keep your administrator passphrase and encryption key in your own password manager. A lost encryption key cannot be bypassed with a fallback.

## 5. Connect your AI client to the hosted MCP

Use your client application's **custom remote MCP / connector setup**, where available:

- **Server URL:** `https://<your-origin>/api/mcp`
- **Login:** OAuth authorization-code flow. The server publishes `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.
- **Authorize once:** Choose the Stripe account, **test** mode and connection profile. Enter the administrator passphrase on the HTTPS OAuth page. An agent never receives your Stripe key.
- **Verify:** Ask the connected client, “Which Stripe account am I connected to?” It should call `stripe_whoami` and show TEST mode and a masked key, never a real key. Also try `stripe_list_accounts`.
- **Renewal:** Access tokens last about one hour. Rotating hashed refresh tokens remain usable until revoked, so a compatible client can refresh automatically. Some clients may require specific offline-access metadata/permissions or eventually prompt to reconnect. Check an actual refresh after expiration; do **not** promise uninterrupted operation until your chosen client passes that test.

For Claude, follow its current **custom connector** UI and select the remote MCP URL above. For ChatGPT, custom MCP app availability and write access depend on the ChatGPT plan/workspace and may change; see [OpenAI's current MCP app guidance](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt). A connected OAuth client cannot use tools outside its advertised access or Stripe key permissions.

## 6. Before calling it operational

Run these checks in order; do not claim completion from a green GitHub CI check alone:

- [ ] Vercel project exists, is the **correct repo**, and has no unexpected paid plan.
- [ ] A separate Neon DB exists, and `DATABASE_URL` points to it (no copied customer/business DB).
- [ ] `PUBLIC_BASE_URL` matches the actual HTTPS deployed origin and OAuth discovery URLs.
- [ ] Secrets are private; `TOKEN_ENCRYPTION_KEY` is backed up outside code.
- [ ] The TEST key is verified and stored from **the browser page**, not in chat.
- [ ] OAuth can issue a connector login with the expected account/profile.
- [ ] `stripe_whoami` and `stripe_list_accounts` return correct **non-sensitive** information.
- [ ] Refresh works after one access-token lifetime without another passphrase request.
- [ ] Logout/revocation blocks the old credential.
- [ ] No live key is entered, no live account is enabled and no real money moves.
- [ ] Batch B safety, money limit and live activation guards are implemented **before** enabling write actions.

**Current scope:** A-1–A-5 are implemented/tested, but actual hosted deployment and a real Stripe test-key verification have not happened. The guide is not a claim they have.

## 7. If anything goes wrong

| Symptom | Check |
| --- | --- |
| 503 or blank setup | Production variables are missing, `DATABASE_URL` isn't usable, or Neon is unavailable. Check *server-side* logs without printing secrets. |
| “PUBLIC_BASE_URL” / OAuth discovery error | The value must be the exact HTTPS origin, not a Preview URL, path or port. Redeploy after fixing. |
| Invalid redirect | Register the exact HTTPS callback your client uses; the OAuth server only accepts registered callbacks and S256 PKCE. |
| Setup form expired / forbidden | Reload `/api/stripe/setup` to renew its short-lived CSRF cookie; access through the same HTTPS origin. |
| Sign-in locked | Stop trying until the 15-minute window ends; multiple wrong guesses extend the lockout. |
| Stripe verification failed | Make sure the key is **test** mode for the intended account, is not revoked, and has **Account: Read**. Review restricted-key request logs for additional probe permissions. |
| Key decrypt failed after changing env | Restore the original encryption key from your password manager; do not replace it casually. |
| AI reconnect request after ~1 hour | Confirm the client actually supports refresh tokens and advertises/requests the necessary offline access; connector compatibility has to be tested live. |

**Live mode is a separate, later owner-controlled decision (IN-06).** Never turn it on merely because this setup works.

## IN-06 gate: LIVE activation remains disabled

The optional server variable `LIVE_MODE_OWNER_APPROVED` must **not** be set to
`true` until Chris separately approves using live Stripe accounts (IN-06).
Its absence denies owner live-activation POSTs. The first step only creates a
ten-minute pending request; the final step is the protected setup page with
passphrase, origin check, CSRF, explicit per-account consent and a valid live key.
No live key can be uploaded through the current TEST-only setup page. B-8 must
later wire the first-step tool and live credential onboarding. Do not enter any
live key, activate this flag or run real money tests without separate approval.
