# 01 — Submit flow (P0 spec → P1 build)

Goal: anyone submits a URL in 60 seconds; makers pay to skip the queue.
Stolen from: Uneed (auto-scrape + date picker), BetaList (refund-if-rejected).

## Constraints honored
C2 (self checks only: DNS reachability, our Screener, human review), C5.

## Research before build
- [x] Uneed submit flow + fast-track/skip pricing (uneed.best/submit-a-tool)
- [x] BetaList refund-if-rejected terms (betalist.com/faq)
- [x] Microlaunch free-vs-Pro launch split (microlaunch.net/premium)
- [x] PH relaunch rule (6mo + significant update) for our re-submit policy

## Research findings
Research finding (2026-10-08): Uneed's submit flow is scrape-first and needs
no account; the free option joins a public line with a date up to 5 months
out (10 upvotes to stay published, 20 for the do-follow backlink); paid
options are Skip the line $29.99 and Fast-track $14.99 (about 14 days), plus
a $15 relaunch. The 10-upvote survival rule in our open questions matches
Uneed's real threshold; the backlink needs 20, not 10.
— Source: https://uneed.best/submit-a-tool and https://uneed.best/pricing
Research finding (2026-10-08): BetaList takes only paid submissions (no free
option) and refunds in full, automatically, within 5-10 business days if a
product is not selected; once featured, no refund. That is the exact shape of
our refund-if-rejected promise: refund is the default path, stated up front,
no manual claim needed.
— Source: https://betalist.com/faq
Research finding (2026-10-08): Microlaunch runs a free standard listing
against paid Launch Pro $39/$49 and Launch Plus $79/$99 tiers with 30-day
exposure, 2x boosts, a verified badge and 4+ SEO pages; relaunches are
unlimited but reserved for major feature releases. Confirms the free-queue +
paid-skip split and suggests tying relaunch eligibility to a real update, not
just a new date.
— Source: https://microlaunch.net/premium
Research finding (2026-10-08): Product Hunt's official relaunch rule: a 6-month
minimum gap per product, per company, and per shared root domain; the update
must be significant (UI tweaks and pricing changes do not count); sooner
relaunches require a request and human review. Directly informs our re-submit
policy: window plus a significance bar, human review for exceptions.
— Source: https://help.producthunt.com/en/articles/484934

## Build spec
- Step 1: paste URL → auto-scrape title/meta/screenshot/stack hints (our code).
- Step 2: name, tagline (≤60ch), topics, maker handle.
- Step 3: pick slot (free queue date auto-assigned) or paid skip (see
  `payments-india.md`). Rejected = auto-refund, stated up front.
- No third-party verification at submit; checks run in our pipeline.

## Metrics
- Submit→live median days · rejection rate + reasons · skip attach rate.

## Acceptance
- [ ] Submit works without code edits · edits free anytime (maker dashboard)
- [ ] Every launch has a permanent SEO URL from day one

## Open questions (owner)
- Free-queue survival rule? (Uneed: 10 upvotes to stay permanent — adopt?)
- Relaunch price + eligibility window?
