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
- [ ] Re-verify Awwwards rubric + SOTD thresholds (awwwards.com/about-evaluation)
- [ ] Re-verify Uneed vote-cleaning + survival rules (uneed.best/how-it-works)
