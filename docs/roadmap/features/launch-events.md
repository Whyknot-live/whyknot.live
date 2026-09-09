# 05 — Launch events (P1)

Goal: launches feel like events, not database rows.
Stolen from: PH (24h window, pinned maker story, reply-everything), Microlaunch
(30-day window, unlimited relaunches), Uneed (date picker).

## Constraints honored
C2, C5.

## Research before build
- [ ] PH launch-day reply-speed norms (2-2-2 rule practitioner consensus)
- [ ] Microlaunch 30-day vs PH 24h — engagement decay comparison
- [ ] Uneed relaunch pricing/eligibility

## Build spec
- Window: 30-day rolling board + weekly winners (Microlaunch shape, our data).
- Countdown on upcoming launches; pinned maker story prompt (80–150 words).
- Reply-norm nudges: maker dashboard shows unanswered count.
- Relaunch: paid, major-version only (rule published like PH).

## Metrics
- Launch-day comments/maker · reply latency median · relaunch rate.

## Acceptance
- [ ] Countdown + winners archive auto-update, no manual edits
- [ ] Maker story prompt ships in submit flow

## Open questions (owner)
- 24h event day + 30d board, or single 30d mechanic?
