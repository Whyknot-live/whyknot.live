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
- [ ] First paid transaction completes via Razorpay (test + live)
- [ ] Sponsored slot bookable, labeled, measured (CTR/fill/revenue)
- [ ] Submit → review → launch loop runs without manual code edits
- [ ] Newsletter sends weekly, 4 issues archived
- [ ] Pricing CTAs reach checkout, none point at `#waitlist`

## Research checklist (phase-level)
- [ ] Razorpay Subscriptions + UPI Autopay docs (razorpay.com/docs)
- [ ] Razorpay international + eFIRC per renewal (dashboard verify)
- [ ] Current RBI e-mandate thresholds before designing sub flows
- [ ] TrustMRR sale tiers + fee split for rate-card calibration
- [ ] PH Ship/Coming-Soon mechanics for pre-launch capture copy
