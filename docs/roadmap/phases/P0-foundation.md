# P0 — Foundation (no backend)

Make every shipped page honest before adding loops.

## Scope
- Delete dead weight: `Footer.astro` (0 bytes), `ComingSoon.astro` (stale),
  `blog.astro` redirect shell + duplicate `blog/[slug]` / `blog/[...slug]`.
- Collapse 7 facet routes → single `TaxonomyGrid` route + config.
- Heroes: Constellation + static Knot only. Remove Prism/Tide/Cover components
  and `hero-prism.css` legacy blocks once Constellation is accepted.
- Fonts self-hosted (Bebas Neue + Caveat, `font-display: swap`); `astro:image`
  for screenshots; first real screenshots replace monogram placeholders.
- Features in this phase: `submit-flow` (spec only), `ranking-velocity`,
  `site-page-seo`, `embed-badges`.

## Entry criteria
- Roadmap README + CONSTRAINTS acknowledged.

## Exit criteria
- [ ] `bun run build` clean, 0 dead routes, sitemap matches reality
- [ ] LCP < 2.5s on `/` (throttled mobile, local)
- [ ] Velocity formula trust-weighted, documented in methodology
- [ ] Badge embed codes live on site + methodology pages
- [ ] Every numeric claim on gateway has a SourceLine or is removed

## Research checklist (phase-level)
- [x] Re-verify Awwwards rubric + SOTD thresholds (awwwards.com/about-evaluation)
- [x] Re-verify Uneed vote-cleaning + survival rules (uneed.best/how-it-works)

## Research findings
Research finding (2026-10-08): Awwwards evaluation system re-verified live:
rubric is Design 40% / Usability 30% / Creativity 20% / Content 10%; approved
sites go to a minimum of 18 jury members and the 3 scores furthest from the
average are eliminated automatically (outlier trim); voting lasts 5 days,
with an early SOTD possible on a high jury score plus at least 10 PRO user
votes; Honorable Mention at 6.5+, Developer Award above 7; only PRO-user
votes count. The thresholds behind our methodology copy are current.
— Source: https://www.awwwards.com/about-evaluation/
Research finding (2026-10-08): Uneed rules re-verified live: a new batch goes
live daily at 12:00 AM PST (at least 30 free launches plus all paid ones);
leaderboards are rolling windows (day/week/month/year), not calendar
resets; votes from batch-created accounts or a single IP are flagged and
removed and the daily archive shows the cleaned standing; free-line
products need an upvote score of 10 on launch day to stay published and 20
for the do-follow backlink (Fast-track: stays published, backlink from 10;
Skip the line: backlink for life, no minimum). Confirms the survival-rule
assumption in `features/submit-flow.md` and the rolling-board design in
`features/ranking-velocity.md`.
— Source: https://uneed.best/how-it-works
