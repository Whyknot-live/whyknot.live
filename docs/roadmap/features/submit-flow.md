# 01 — Submit flow (P0 spec → P1 build)

Goal: anyone submits a URL in 60 seconds; makers pay to skip the queue.
Stolen from: Uneed (auto-scrape + date picker), BetaList (refund-if-rejected).

## Constraints honored
C2 (self checks only: DNS reachability, our Screener, human review), C5.

## Research before build
- [ ] Uneed submit flow + fast-track/skip pricing (uneed.best/submit-a-tool)
- [ ] BetaList refund-if-rejected terms (betalist.com/faq)
- [ ] Microlaunch free-vs-Pro launch split (microlaunch.net/premium)
- [ ] PH relaunch rule (6mo + significant update) for our re-submit policy

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
