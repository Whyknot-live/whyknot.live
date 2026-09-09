# 07 — Payments, India-first (P1)

Goal: take money without Stripe, without surprises.
Researched 2026-09-09 (sources below). Stripe India invite-only since May
2024 — not an option. LemonSqueezy has no India merchant payouts — out.

## Constraints honored
C1, C5.

## Research notes (verify again before integration — check live docs)
- **Razorpay** (gateway, India): UPI/cards/netbanking/wallets, Subscriptions +
  UPI Autopay, GST invoices, RBI e-mandates, ~2% domestic / ~3% intl + 18% GST,
  full RBI PA-CB licence, auto-eFIRC per renewal (matters for export/GST
  zero-rating). International cards supported but test success rates.
- **Paddle** (MoR, 5%+$0.50): handles global VAT/sales tax — BUT FIRC names
  Paddle as remitter (GST zero-rating gap for Indian entity), no RBI licence.
- **Dodo Payments** (MoR, ~4%+$0.40): cheaper Paddle, India-focused onboarding,
  same FIRC gap. Consider only if MoR model accepted.
- Rule of thumb found: domestic-first → Razorpay; global-tax-headache →
  MoR later. Break-even vs MoR ≈ $8–12k/mo intl revenue.
- Sources: bytesbrothers.com (2026-08-14), saascity.io (2026-02-03),
  razorpay.com/blog (2026-05-05), small-bizsense.com Paddle-alternative review.

## Research before build
- [ ] Razorpay Subscriptions + UPI Autopay integration docs (live)
- [ ] Current RBI e-mandate limits for recurring thresholds
- [ ] Razorpay international card success rates (test transactions)
- [ ] GST invoicing requirements for SaaS exports (CA confirm)

## Build spec
- One-time: Verified ($12 equiv in INR) via Razorpay checkout.
- Recurring: Pro/Team subscriptions with retry + dunning (built into Razorpay).
- Webhooks → our backend is source of truth; entitlements in Mongo.
- Receipts + GST invoices automatic.

## Metrics
- Checkout conversion · involuntary churn % · webhook failure rate (alert).

## Acceptance
- [ ] Test + live transaction for one-time AND subscription
- [ ] Failed-payment retry + customer email verified in sandbox

## Open questions (owner)
- INR-only at launch, or INR + USD from day one?
- MoR later at what MRR trigger? (suggest $8k/mo intl — confirm)
