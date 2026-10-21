# 03 — Site page SEO (P0)

Goal: every site profile is a permanent, rankable asset.
Stolen from: Microlaunch (auto SEO satellites), Uneed (dofollow + UTM stats),
TrustMRR (detail-page diligence teaser).

## Constraints honored
C2 (our screenshots/scans), C5.

## Research before build
- [x] Microlaunch `/alt/*` + `/h/*` satellite format
- [x] TrustMRR startup detail sections (traffic, DR, insights order)
- [x] PH alternatives sidebar + review SEO pattern

## Research findings
Research finding (2026-10-08): Microlaunch satellite format confirmed by its
own sitemaps: /alt/{slug} alternatives pages (213 URLs, e.g.
microlaunch.net/alt/retool) and /h/{slug} how-to guides (19,835 URLs) — two
dedicated sitemap files (alts-sitemap.xml, howtos-sitemap.xml) keep them
crawlable apart from product pages. The scale shows this is their core SEO
engine, not a side project; our alternatives-graph pages should get their
own URL space and sitemap entries from day one.
— Source: https://microlaunch.net/alts-sitemap.xml and
https://microlaunch.net/howtos-sitemap.xml
Research finding (2026-10-08): TrustMRR startup detail page structure
(observed live): hero metrics first (all-time revenue, MRR, active
subscriptions, rank) with verification provenance and a "last updated"
timestamp, then an insights block (value proposition, problem solved),
then Domain Rating, then FAQ. The diligence teaser is the provenance line
("Revenue is verified with RevenueCat API key"), not a separate section —
our SourceLines play the same role and should sit with the numbers.
— Source: https://trustmrr.com/startup/winner
Research finding (2026-10-08): Product Hunt runs dedicated SEO pages per
product: /products/{slug}/alternatives and /products/{slug}/reviews both
return live pages (verified with notion). The alternatives comparison is a
first-class page, not just a sidebar widget (the sidebar itself is
JavaScript-rendered and not visible in raw HTML). Our alternatives block per
profile matches this pattern; keep the pages server-rendered so they are
actually crawlable, unlike PH's sidebar.
— Source: https://www.producthunt.com/products/notion/alternatives and
https://www.producthunt.com/products/notion/reviews

## Build spec
- Desktop + mobile screenshots (real captures replace monograms).
- Sections: score breakdown, SourceLines, stack with confidence, maker,
  alternatives (see `alternatives-graph.md`), report.md link, FAQ schema.
- Outbound links: dofollow + `?ref=whyknot` UTM; click stats per maker.
- Canonical, OG, JSON-LD already in Head — verify per template.

## Metrics
- Organic entrances per profile · outbound CTR · maker dashboard views.

## Acceptance
- [ ] Zero monogram placeholders in top 100 profiles
- [ ] Alternatives block on every profile with ≥2 links

## Open questions (owner)
- Screenshot capture service: build ours (P2 Screener) or manual until then?
