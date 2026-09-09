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
- [ ] PH Promoted eligibility (listed + popular only) + badge spec
- [ ] TrustMRR Growth/Scale tier benefits for ladder calibration
- [ ] BetaList Boost vs Sponsorship placement inventory

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
