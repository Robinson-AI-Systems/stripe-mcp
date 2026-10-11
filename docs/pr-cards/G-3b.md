# G-3b — TEST review approval and value-list creation
Status: MERGED (#98), subject to exact-head green CI.
Baseline inspected #97 564f60a7133ff97f9ec93c1f4eca99bc63e9f041; first G-3 read slice merged on main 3a9494bb8abe47d54c144fb6ebbb00898c10987a.
Risk: fraud review decisions and list definitions. Migration: none.
Read only: AGENTS; SESSION-START; G design G-3; radar-reads.js;
billing-shared.js; write.js; app-guard.js; implementation-guides/RECIPES §2–3.
## Drift check A
| Assumption | Actual | Correction |
| --- | --- | --- |
| Review approvals are inert | Can free pending payments | Full-only, explicit destructive preview, protected linked charge/PI |
| Review always has charge | Can have only payment_intent | Verify either exact TEST linked target, inspect app markers |
| Create list is equivalent to update | Needs unique alias, item_type | Verified list({alias}), provider-derived created ID, independent retrieve |
| Raw list name safe in log | User name may be sensitive | Preview only length, alias and type, not values |
## Mapping/verification
reviewId(prv_) -> reviews.retrieve + charges.retrieve or paymentIntents.retrieve,
strict review.open and app/customer guard -> POST reviews.approve(id,{})
-> reviews.retrieve requires open:false, reason:approved, same payment IDs.
name/alias/itemType -> radar.valueLists.list(alias) uniqueness ->
valueLists.create({name,alias,item_type}) -> retrieve created rsl_, exact fields.
No AI approval argument or LIVE. no monetary payout.
Actual-handler behavioral tests, mock route tests, 81 guarded write registry count,
read-only denial, app-owned denial, unknown args, uncertain readback.
G-3c inherits value list ID/type helpers; deletion must not silently delete items
or referenced rules; item values must remain private.
