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
- [x] Razorpay Subscriptions + UPI Autopay integration docs (live)
- [x] Current RBI e-mandate limits for recurring thresholds
- [ ] Razorpay international card success rates (test transactions)
- [ ] GST invoicing requirements for SaaS exports (CA confirm)

## Research findings
Research finding (2026-10-08): Razorpay Subscriptions + UPI Autopay docs
verified live: mandates up to Rs 1,00,000; frictionless debits up to
Rs 15,000 (all merchants) with UPI shown only for plans at most Rs 15,000;
card debits above Rs 15,000 need AFA each cycle with a 36-hour pre-debit
notice; eNACH eMandate up to Rs 1,00,00,000; auto-invoicing, smart retries
and webhooks included — the dunning/retry machinery in the build spec is
native, not ours to build.
— Source: https://razorpay.com/docs/payments/subscriptions/
Research finding (2026-10-08): RBI e-mandate thresholds are set by the
consolidated "Digital Payments - E-mandate Framework, 2026"
(RBI/DPSS/2026-27/396, 21 April 2026): no-AFA limit Rs 15,000 per
transaction, Rs 1,00,000 for insurance/mutual funds/credit-card bill pay;
AFA on registration, first transaction, modification and opt-out; 24-hour
pre-debit and post-debit notifications; no customer charges; repeals eight
prior circulars. Design recurring flows against this circular, not the older
per-product ones.
— Source: https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13374
Research finding (2026-10-08, spec correction): current Razorpay docs
document FIRS (Foreign Inward Remittance Statement) certificates, downloaded
monthly from the Dashboard with a purpose code, usable as proof for GST
refund/drawback claims — the earlier note's "auto-eFIRC per renewal" wording
does not appear in the live docs. Whether FIRS is auto-generated per renewal
for our account is a Dashboard check and stays open (owner).
— Source: https://razorpay.com/docs/payments/international-payments/firs-automated-process/
Research finding (2026-10-08, partial): Razorpay's international FAQ confirms
default T+7 settlement (earlier settlement at extra charge) settled in INR.
The 90-95% international card success rate is a Razorpay marketing claim,
not an audited figure; real success rates need our own test transactions on
a live account, so this checklist item stays open.
— Source: https://razorpay.com/docs/payments/international-payments/faqs/
Not verified (2026-10-08): GST export invoicing / LUT rules could not be
confirmed from an official source in this pass — tutorial.gst.gov.in returned
HTTP 503, cbic.gov.in failed TLS verification and indiacode.nic.in timed out.
Per C5 this item stays unticked and needs a chartered accountant's sign-off
plus an official gst.gov.in or cbic.gov.in source before build.

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
