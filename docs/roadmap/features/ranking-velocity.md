# 02 — Trust-weighted velocity (P0)

Goal: rank by earned momentum, never raw counts.
Stolen from: PH (weighted points, anti-gaming), Uneed (cleaning log, streak
multipliers), Awwwards (published rubric + outlier trim).

## Constraints honored
C2 (our fraud rules, our cleaning), C3 (sponsored excluded — prove it), C5.

## Research before build
- [x] PH points-vs-votes practitioner consensus (weights unpublished — note it)
- [x] Uneed vote-integrity cleaning + survival threshold
- [x] Awwwards rubric weights + outlier-trim procedure

## Research findings
Research finding (2026-10-08): Product Hunt officially confirms points (not
raw upvotes) determine ranking: "One upvote does not always equal one point",
engagement includes comments and authenticity signals, and "our team is
unable to disclose all factors in an effort to avoid gaming". The exact
weights are unpublished by design — our methodology page should say what we
weight and why, and never claim to mirror PH's formula.
— Source: https://help.producthunt.com/en/articles/10275873-what-are-points
and https://help.producthunt.com/en/articles/484938-how-is-the-homepage-ranked
Research finding (2026-10-08): Uneed vote integrity: votes from batches of
accounts created at once, or from a single IP address, are flagged and
removed; final (cleaned) rankings differ from live ones and the daily archive
reflects the cleaned standing. Survival thresholds: free line needs an
upvote score of 10 on launch day to stay published, 20 for the do-follow
backlink; Fast-track keeps the listing and gives the backlink from 10; Skip
the line has no minimum. Our public cleaning note and streak-multiplier
question can reference this shape.
— Source: https://uneed.best/how-it-works
Research finding (2026-10-08): Awwwards rubric and outlier trim confirmed:
Design 40% / Usability 30% / Creativity 20% / Content 10%; each site goes to
a minimum of 18 jury members and the 3 scores furthest from the average are
eliminated automatically before scoring; only PRO-user votes count toward
community score. This is the published-rubric + outlier-trim pattern our
trust-weighted velocity should imitate in plain words on the methodology
page.
— Source: https://www.awwwards.com/about-evaluation/

## Build spec
- `launchVelocity = (votes×w_v + comments×3×w_c + makerReplies×2) / ageDays`
  where weights come from voter trust (account age, streak, prior flags).
- Rolling boards: Day / 7d / 30d (not only 24h — Microlaunch lesson).
- Public cleaning note on launches page: votes removed count (no methods).
- Rank function takes NO sponsored field — unit test asserts it.

## Metrics
- Vote-removal rate · rank stability · gaming reports/week.

## Acceptance
- [ ] Methodology page shows formula in plain words
- [ ] Test: sponsored=true never changes rank output

## Open questions (owner)
- Streak multipliers (x2–x8 like Uneed) — adopt now or P2 with karma?
