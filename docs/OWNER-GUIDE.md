# Owner guide — what you can ask for

Plain-English things to say to Claude once each part is built. Each line names the batch that delivers it; until then
it does not work yet. This file is updated as features ship.

| Say something like… | What happens | Batch |
|---|---|---|
| "Give me realistic test data for a subscription app." | Customers, products, subscriptions in every state (including past-due), recorded so they can be removed later | V |
| "Clean up the test data from that run." | Removes exactly what was created, nothing else | V |
| "Send my app a failed-payment webhook." | Makes Stripe produce a real test event and, if your app is under development, forwards it correctly signed | V |
| "What happens to this subscription over 6 months?" | Runs it on a test clock and shows every invoice and event | V |
| "Who am I connected to in Stripe?" | Account, TEST or LIVE, your money limit and how much is used today | A/B |
| "How's the money looking this month?" | Balance, payouts coming, money in and out, monthly recurring revenue, failed payments, disputes | W |
| "Who didn't pay this week and why?" | Each failed payment, the reason in plain words, when Stripe retries, the link to send them | W |
| "Refund the Hendersons' deposit." | Finds the right charge, shows the exact amount, asks you, refunds, confirms | W |
| "Cancel Jim's subscription at the end of the month." | Previews, asks, does it the right way, confirms | D/W |
| "Brand my payment pages for Robinson Appliance Rentals." | Logo, colors, statement name, support details, invoice footer; shows you a test page | H/W |
| "Is Stripe ready for Appliance Desk?" | Every item the app needs: done, fixed with your OK, or exactly what you need to click | P |
| "Fix the Appliance Desk webhook." | Adds the two missing ACH events, after you confirm | P/W |
| "Set up Stripe for my new project." | Webhook, portal, payment methods, branding, products if needed — previewed first | P |
| "Help me fight this dispute." | Gathers the evidence, drafts it, lists what you must add before the deadline | W |
| "What changed in Stripe through Claude this week?" | The change log | B |
| "Undo that." | Reverses the last change when it has a clean opposite; says plainly when it doesn't | X |
| "Make a 24-hour read-only pass for Codex." | A pass shown once on your setup page; the agent uses it through Robinson's Toolkit (`rtool`) or the HTTPS API | R |
| Anything else in Stripe | The universal tools find the right Stripe operation and run it with the same safety | U |
