# 02 — Trust-weighted velocity (P0)

Goal: rank by earned momentum, never raw counts.
Stolen from: PH (weighted points, anti-gaming), Uneed (cleaning log, streak
multipliers), Awwwards (published rubric + outlier trim).

## Constraints honored
C2 (our fraud rules, our cleaning), C3 (sponsored excluded — prove it), C5.

## Research before build
- [ ] PH points-vs-votes practitioner consensus (weights unpublished — note it)
- [ ] Uneed vote-integrity cleaning + survival threshold
- [ ] Awwwards rubric weights + outlier-trim procedure

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
