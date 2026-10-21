# 05 — Launch events (P1)

Goal: launches feel like events, not database rows.
Stolen from: PH (24h window, pinned maker story, reply-everything), Microlaunch
(30-day window, unlimited relaunches), Uneed (date picker).

## Constraints honored
C2, C5.

## Research before build
- [x] Reply-speed norm — resolved 2026-10-08 by owner decision: no external source; WhyKnot writes
  and publishes its own norm in methodology (see DECISIONS.md). Research item retired.
- [ ] Microlaunch 30-day vs PH 24h — engagement decay comparison
- [ ] Uneed relaunch pricing/eligibility

## Research findings
Research finding (2026-10-08, partial): Product Hunt's official commenting
guidelines cover comment quality (no generic "congrats", no AI-generated
comments, no mass commenting; constructive, specific feedback; moderation
can remove comments and repeated violations lose contribution access) but
say nothing about maker reply speed. The 2-2-2 reply rule is practitioner
consensus with no official PH source, so under C5 this item stays unticked
until the owner accepts practitioner articles as the source or we write our
own reply-norm from first principles.
— Source: https://help.producthunt.com/en/articles/10030102-commenting-guidelines
Not verified (2026-10-08): no primary source compares engagement decay
between a 24-hour window (PH) and a 30-day window (Microlaunch). PH's
official ranking article confirms a dynamic points-based homepage but
publishes no retention data. This comparison can only come from our own
post-launch analytics after the first launches; the item should be
reframed as a measurement, not a research task.
— Source: https://help.producthunt.com/en/articles/484938-how-is-the-homepage-ranked
Research finding (2026-10-08, partial): Uneed relaunch pricing is verified —
a relaunch costs $15 (Pro plan includes one free relaunch per month, worth
$15, up to 2 credits), and relaunches launch in the daily batch like any
paid launch. Uneed does not publish a relaunch eligibility window (minimum
gap since last launch) anywhere on how-it-works, pricing or FAQ, so the
eligibility half of this item stays open; our own window is an owner
decision anyway (see open questions).
— Source: https://uneed.best/pricing and https://uneed.best/how-it-works

## Build spec
- Window: 30-day rolling board + weekly winners (Microlaunch shape, our data).
- Countdown on upcoming launches; pinned maker story prompt (80–150 words).
- Reply-norm nudges: maker dashboard shows unanswered count.
- Relaunch: paid, major-version only, **6-month gap + significant update** (owner decision
  2026-10-08, PH-aligned; publish the rule like PH — see DECISIONS.md).

## Metrics
- Launch-day comments/maker · reply latency median · relaunch rate.

## Acceptance
- [ ] Countdown + winners archive auto-update, no manual edits
- [ ] Maker story prompt ships in submit flow

## Open questions (owner)
- 24h event day + 30d board, or single 30d mechanic?
