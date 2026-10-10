# Owner guide — what you can ask for

Plain-English things to say to Claude once each part is built. Each line names the batch that delivers it; until then
it does not work yet. This file is updated as features ship.

| Say something like… | What happens | Batch |
|---|---|---|
| "Give me realistic test data for a subscription app." | Customers, products, subscriptions in every state (including past-due), recorded so they can be removed later | V |
| "Clean up the test data from that run." | Removes exactly what was created, nothing else | V |
| "Send my app a failed-payment webhook." | Makes Stripe produce a real test event and, if your app is under development, forwards it correctly signed | V |
| "What happens to this subscription over 6 months?" | Runs it on a test clock and shows every invoice and event | V |
| "Review my Stripe account." | Business details, what Stripe still needs from you, payouts, branding, security, fees — ok or needs attention | G |
| "Add Sam to my Stripe team." / "Turn off Stripe's failed-payment emails." | Stripe has no API for these, so you get exact steps (or a browser walk-through with `rtool guide`), then it checks the result where it can | G |
| "Who am I connected to in Stripe?" | After test setup, reports selected account, mode, profile, masked key and actual shared daily money-out budget/usage | A/B-8a |
| "Which Stripe test accounts have I connected?" | Lists account labels and connection status without revealing keys | A-5 |
| "Which AI connections exist for this Stripe account?" | Lists account-scoped connection metadata, not credentials | B-8a |
| "Where do I set up Stripe receipt emails?" | Gives guided Dashboard steps, never pretends to change a setting | B-8a |
| "Check my TEST Stripe key permissions again." | Safely re-probes restricted TEST-key read permissions only after a key is configured; credentials are never shown | B-8b1 / #29 |
| "How's the money looking this month?" | Balance, payouts coming, money in and out, monthly recurring revenue, failed payments, disputes | W |
| "Who didn't pay this week and why?" | Each failed payment, the reason in plain words, when Stripe retries, the link to send them | W |
| "Refund the Hendersons' deposit." | Finds the right charge, shows the exact amount, asks you, refunds, confirms | W |
| "Cancel Jim's subscription at the end of the month." | Previews, asks, does it the right way, confirms | D/W |
| "Brand my payment pages for Robinson Appliance Rentals." | Logo, colors, statement name, support details, invoice footer; shows you a test page | H/W |
| "Is Stripe ready for Appliance Desk?" | Every item the app needs: done, fixed with your OK, or exactly what you need to click | P |
| "Fix the Appliance Desk webhook." | Adds the two missing ACH events, after you confirm | P/W |
| "Set up Stripe for my new project." | Webhook, portal, payment methods, branding, products if needed — previewed first | P |
| "Help me fight this dispute." | Gathers the evidence, drafts it, lists what you must add before the deadline | W |
| "What changed in Stripe through Claude recently?" | Read the authenticated account's safely paged, TEST-mode change summaries (no raw snapshots); advanced filtering is still planned | B-8a |
| "Undo that." | Reverses the last change when it has a clean opposite; says plainly when it doesn't | X |
| "Make a 24-hour read-only pass for Codex." | A pass shown once on your setup page; the agent uses it through Robinson's Toolkit (`rtool`) or the HTTPS API | R |
| Anything else in Stripe | The universal tools find the right Stripe operation and run it with the same safety | U |
