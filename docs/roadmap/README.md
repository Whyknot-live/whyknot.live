# WhyKnot Roadmap — build it ourselves

Master index. Every feature below ships from our own systems: **no third-party
payments, no third-party verification.** Sponsored inventory exists and stays
provably separated from rank. Verification badges are **deferred** — tracked,
not built.

## Locked constraints (`CONSTRAINTS.md` — read first, change never silently)

1. Self-reliant money: Razorpay-first (India entity), no Stripe dependency.
2. Self-reliant trust: DNS + Screener + human review. No verification APIs.
3. Sponsored = labeled, neutral, zero ranking input. Metrics prove it.
4. Verification badges ship **after** revenue loops, never before.
5. Research-before-build: no feature breaks ground until its md's research
   checklist is checked off with live sources.

## Phases

| Phase | File | Exit = |
|---|---|---|
| P0 Foundation | `phases/P0-foundation.md` | Dead code gone, pages honest, badges embeddable, velocity trust-weighted |
| P1 Revenue loops | `phases/P1-revenue-loops.md` | Submit works, Sponsored bookable + measured, newsletter sends, Razorpay live |
| P2 Moat | `phases/P2-moat.md` | Screener pipeline, reviews, alerts, stats hub, API |

## Feature files (`features/`)

| # | Feature | Phase | Status |
|---|---|---|---|
| 01 | `submit-flow.md` — self-serve submit, auto-scrape, date picker | P0/P1 | spec |
| 02 | `ranking-velocity.md` — trust-weighted velocity, rolling boards | P0 | spec |
| 03 | `site-page-seo.md` — alternatives, screenshots, UTM stats | P0 | spec |
| 04 | `embed-badges.md` — copy-paste trust badges (backlink engine) | P0 | spec |
| 05 | `launch-events.md` — windows, countdown, maker-reply norms | P1 | spec |
| 06 | `sponsored-slots.md` — inventory, metrics audit, booking | P1 | spec |
| 07 | `payments-india.md` — Razorpay-first billing (researched) | P1 | spec |
| 08 | `maker-claim.md` — claim flow without third parties | P1 | spec |
| 09 | `reviews.md` — Idea-vs-Execution reviews, self-moderated | P2 | spec |
| 10 | `watchlists-alerts.md` — spikes to savers | P2 | spec |
| 11 | `newsletter-531.md` — 5-3-1 weekly from our data | P1 | spec |
| 12 | `stats-hub.md` — distributions research hub (press engine) | P2 | spec |
| 13 | `alternatives-graph.md` — shoutouts-style build graph | P2 | spec |
| 14 | `verification-badges.md` — **DEFERRED**, unlock criteria inside | later | parked |

## Scoreboard (update per release)

- Sponsored: 100% labeled · 0 rank-input fields · CTR per slot · fill rate
- Trust: % claims with SourceLine · report rate · median review time
- Money: MRR · sponsored occupancy · newsletter subs · badge embeds live
