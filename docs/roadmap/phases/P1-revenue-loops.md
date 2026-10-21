# P1 — Revenue loops (light backend)

Turn attention into money with our own rails.

## Scope
- `submit-flow` (working form + auto-scrape + date picker + paid skip)
- `launch-events` (windows, countdown, pinned maker story, reply norms)
- `sponsored-slots` (rate card, booking, per-slot metrics dashboard)
- `payments-india` (Razorpay: one-time Verified + Pro/Team subscriptions)
- `maker-claim` (DNS + email + manual review — no third parties)
- `newsletter-531` (weekly send from our data)

## Entry criteria
- P0 exit criteria met. Backend (Hono + Mongo) reachable from frontend.

## Exit criteria

Status as of 2026-10-21 (code is checked; a box is not a payment). None of the boxes below are
ticked yet because every one of them needs the live deploy to be proven, not just written:

- Submit → review → launch: code-complete. Submit API + admin review API + admin review UI +
  the promote script (`frontend/scripts/promote-launches.mjs`) exist and were exercised on the box.
- Sponsored slots: code-complete. Booking → paid flip → per-slot metrics, the metrics endpoint is
  admin-only, and an abandoned checkout no longer blocks a date (partial unique index on paid
  orders only, with a 15-minute hold on an in-flight checkout).
- Newsletter: double-opt-in confirm email + admin send endpoint exist; sending needs live keys.
- Pricing CTAs: they reach the checkout route and none of them point at `#waitlist`.
- Razorpay: orders, signature verify, webhook and entitlements are written, but the FIRST real
  transaction has never run — that is what the deploy is for.

- [ ] First paid transaction completes via Razorpay (test + live)
- [ ] Sponsored slot bookable, labeled, measured (CTR/fill/revenue)
- [ ] Submit → review → launch loop runs without manual code edits
- [ ] Newsletter sends weekly, 4 issues archived
- [ ] Pricing CTAs reach checkout, none point at `#waitlist`

## Research checklist (phase-level)
- [x] Razorpay Subscriptions + UPI Autopay docs (razorpay.com/docs)
- [ ] Razorpay international + eFIRC per renewal (dashboard verify)
- [x] Current RBI e-mandate thresholds before designing sub flows
- [x] TrustMRR sale tiers + fee split for rate-card calibration
- [x] PH Ship/Coming-Soon mechanics for pre-launch capture copy

## Research findings
Research finding (2026-10-08): Razorpay Subscriptions supports UPI Autopay,
cards, netbanking and eNACH. Mandate creation up to Rs 1,00,000; frictionless
(no-AFA) debits up to Rs 15,000 for all merchants and up to Rs 1,00,000 for
BFSI MCCs. UPI method is only offered when the plan amount is at most
Rs 15,000; card debits above Rs 15,000 need additional factor of
authentication each cycle (pre-debit notice at 36 hours with a payment link
valid 72 hours). Auto-invoicing, smart retries and webhooks are built in.
— Source: https://razorpay.com/docs/payments/subscriptions/
Research finding (2026-10-08): The RBI consolidated the e-mandate regime into
one master circular, "Digital Payments - E-mandate Framework, 2026"
(RBI/DPSS/2026-27/396, 21 April 2026): no-AFA ceiling Rs 15,000 per
transaction (Rs 1,00,000 for insurance premiums, mutual funds and credit-card
bill payments); AFA on registration, first transaction, modification and
opt-out; 24-hour pre-debit and post-debit customer notifications mandatory;
no customer charges; repeals eight earlier circulars. Any spec quoting the
old per-circular limits should cite this framework instead.
— Source: https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13374
Research finding (2026-10-08): TrustMRR monetization: one-time listing tiers
Starter $29, Growth $199 (permanent 5x visibility, custom card color,
newsletter exposure), Scale $499 (20x visibility, buyer matching, pinned at
top 30 days); micro-adds are a dofollow authority link $19 and an AI
visibility boost $79, plus a side-panel sponsor spot from $399 per 7 days.
Closing fee is a flat 3% split 50/50 between buyer and seller, on top of
Escrow.com's all-in 3.90-5.60% by deal size. This confirms the $29/$199/$499
ladder assumption behind our rate-card shape.
— Source: https://trustmrr.com/faq and https://trustmrr.com/fees
Research finding (2026-10-08): Product Hunt removed Coming Soon / teaser
pages around August 2025, so its pre-launch capture mechanics no longer exist
and cannot be copied; the replacement rule is the relaunch policy (6-month
gap, significant update, human review). No official PH announcement was
found; the removal is documented by a Product Hunt community thread and a
third-party launch-industry write-up. Pre-launch capture copy should be
designed from our own loop, not from PH.
— Source: https://producthunt.com/p/general/product-hunt-discontinued-coming-soon-teaser-pages-did-they-work-for-you
Research finding (2026-10-08): Razorpay now documents FIRS (Foreign Inward
Remittance Statement) certificates, downloadable monthly from the Dashboard
as proof for GST refunds/drawbacks and requiring a purpose code. The current
docs do not describe an "auto-eFIRC per renewal" flow. The actual certificate
list in our account cannot be verified from public docs — see
`features/payments-india.md` and the owner dashboard check left open below.
— Source: https://razorpay.com/docs/payments/international-payments/firs-automated-process/
