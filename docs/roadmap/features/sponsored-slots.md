# 06 — Sponsored slots (P1)

Goal: sell attention, never rank. Metrics prove the separation.
Stolen from: PH Promoted (winners-only, PROMOTED badge), TrustMRR sale tiers
($29/$199/$499 ladder + $19/$79 micro-adds), BetaList Boost transparency tags.

## Constraints honored
C3 (full audit below), C1 (Razorpay invoicing for slot sales), C5.

## Current-state audit (2026-09-09, codebase)
- EXISTS: `sponsored: bool` on launches; neutral `sponsored-tag` (LaunchCard
  forces Sponsored over merit badges; detail page tags too); methodology +
  pricing copy correctly states scores/ranks/badges can't be bought.
- MISSING: no booking flow, no rate card, no impressions/CTR tracking, no
  occupancy/revenue view, no advertiser dashboard. Pricing CTAs point at
  `#waitlist`. **Verdict: honest but unmeasured and unsellable — fix here.**

## Research before build
- [x] PH Promoted eligibility (listed + popular only) + badge spec
- [x] TrustMRR Growth/Scale tier benefits for ladder calibration
- [x] BetaList Boost vs Sponsorship placement inventory

## Research findings
Research finding (2026-10-08): Product Hunt Promoted is a paid ad program for
popular listed products — a PROMOTED badge on ad placements, self-serve
options (Basic display, Momentum display, Newsletter sponsorship sold as a
single message) and managed campaigns; explicitly not available for
brand-new launches. Confirms our eligibility rule (listed + screened only)
and the labeled-badge pattern. Newsletter reach is quoted at 650k+
subscribers on the promote page (an older figure of 350k+ also appears on the
same page).
— Source: https://help.producthunt.com/en/articles/1444961 and
https://producthunt.com/promoted-products
Research finding (2026-10-08): TrustMRR's ladder is Growth $199 (permanent 5x
visibility, custom card color, newsletter exposure) and Scale $499 (20x
visibility, buyer matching, pinned at top for 30 days), with micro-adds at
$19 (dofollow authority link) and $79 (AI visibility boost) and a side-panel
sponsor spot from $399 per 7 days. Supports the proposed Rs 2.5k/Rs 15k/
Rs 35k shape; note the visibility multiplier is the core lever, not the
badge. (TrustMRR's own llms.txt lists tier names free/starter/pro/premium —
naming differs from the pricing page; treat page as source of truth.)
— Source: https://trustmrr.com/faq
Research finding (2026-10-08): BetaList sells two sponsorships with
different inventory: Sponsorship $4,999/month, exclusive — homepage Trending
slot plus a slot on every startup page and in every newsletter; Boost
$99/week or $199/month — homepage plus newsletter slot, cancel anytime.
Confirms the two-tier split (own inventory vs network-wide) and that a cheap
cancel-anywhere tier works as an entry ramp.
— Source: https://betalist.com/advertise

## Build spec
- Inventory: launch-card boost slot + newsletter slot + (later) homepage rail.
- Eligibility: listed + screened only (PH rule — never brand-new/unscreened).
- Rate card in INR; booking via Razorpay invoice; self-serve dates.
- Dashboard: impressions, CTR, fill rate, revenue; 100% label-coverage check.

## Metrics (the right ones)
- Label coverage = 100% · rank-input fields containing sponsored = 0 (tested)
- CTR per slot · occupancy % · revenue/slot/month · advertiser repeat rate

## Acceptance
- [ ] Slot purchasable without human involvement
- [ ] Methodology enforcement note links live slot metrics

## Open questions (owner)
- Opening rate card? (TrustMRR ladder suggests ₹2.5k/₹15k/₹35k shape — confirm)
- Newsletter slot before list hits what size?
