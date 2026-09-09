# Locked Constraints

Changed only by explicit owner decision, with date + reason appended below.
Every feature md must cite the constraints it honors.

## C1 — Self-reliant money
No Stripe dependency (invite-only for new Indian merchants since May 2024).
Razorpay-first for INR + international cards; Merchant-of-Record (Paddle/Dodo)
only if global-tax burden justifies it AND the FIRC/GST gap is accepted.
See `features/payments-india.md` for the researched breakdown.

## C2 — Self-reliant trust
Verification = our DNS checks + our Screener + human review. No third-party
verification APIs, no outsourced moderation. Report flows + human review are
ours to build (`features/reviews.md`, `features/maker-claim.md`).

## C3 — Sponsored separation (provable)
Sponsored inventory exists (`sponsored: bool` on launches, neutral
`sponsored-tag`). Rules: always labeled, neutral styling (never merit colors),
**zero fields in ranking inputs**. Metrics must prove separation:
100% label coverage, rank function excludes sponsored, per-slot CTR/fill.
See `features/sponsored-slots.md` for the audit.

## C4 — Verification badges deferred
Badge system (expanded states, public gallery, enforcement log) ships AFTER
P1 revenue loops. Tracked in `features/verification-badges.md` (parked).
No badge work in P0/P1 beyond current 6 states.

## C5 — Research before build
No implementation starts until the feature md's research checklist is checked
with live sources (URL + date). Assumptions are listed as open questions for
the owner — never silently resolved.

## Change log
- 2026-09-09: constraints locked (owner). Stripe-out/Razorpay-first,
  self-verification, badges deferred.
