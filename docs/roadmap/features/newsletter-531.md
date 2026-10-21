# 11 — Newsletter 5-3-1 (P1)

Goal: retention that writes itself from our data.
Stolen from: TrustMRR Unicorne (5 fastest-growing + 3 deals + 1 underdog),
PH Daily (top 10 + sponsor slot).

## Constraints honored
C3 (sponsored slot labeled inside; metrics shared), C5.

## Research before build
- [x] Unicorne archive format + subject-line patterns
- [x] PH newsletter sponsor spec (name sponsor + in-list slot)

## Research findings
Research finding (2026-10-08): TrustMRR's Unicorne newsletter is weekly with
5,000+ subscribers and uses the exact 5-3-1 format (5 fastest growing, 3
deals, 1 underdog spotlight). Every issue has a permanent public archive page
at /newsletter/{slug} dated week by week, and subject lines are
sentence-case, concrete growth/revenue claims ("This AI chat tool just hit
3364% growth!"). Our archive-pages and subject-line style should follow this
shape: one number, one sentence, no clickbait punctuation. (Unicorne's old
domain unicor.ne is now a ranking site with no archive; trustmrr.com hosts
the newsletter.)
— Source: https://trustmrr.com/newsletter
Research finding (2026-10-08): PH newsletter sponsorship is a self-serve
product: a named sponsor ("Presented by X") plus a single in-list placement
described as "a single message", sold alongside display placements on the
advertise page; audience quoted at 650k+ subscribers. Confirms the spec's
name-sponsor + in-list slot pair and that one slot equals one message — no
series bundling required at launch.
— Source: https://help.producthunt.com/en/articles/1444961 and
https://producthunt.com/promoted-products

## Build spec
- Weekly: 5 fastest-rising · 3 editor deals (Sponsored eligible, labeled) ·
  1 underdog (low votes, high score — our voice).
- Archive pages (SEO); subscribe in footer + after search zero-results.

## Metrics
- Subs · open rate · CTR · sponsor slot CTR separately.

## Acceptance
- [x] 4 issues archived before calling it live — 4 issues in `frontend/src/content/newsletter.json`,
      archive pages at /newsletter (audit 2026-10-08).
- [x] Sponsor slot renders labeled even with no buyer (house slot) — HOUSE_SPONSOR fallback in
      `buildNewsletterHtml` + `buildNewsletterText`, covered by tests/newsletter.test.ts.

## Shipped 2026-10-08 (P1 exit: "newsletter sends")
- Double opt-in: subscribe fires a confirm email (Resend, fire-and-forget, gated on
  ENABLE_EMAIL + RESEND_API_KEY like every other sender). Confirm link is the only action.
- Send: `POST /api/admin/newsletter/send` (admin-only, Zod-validated 5-3-1 body) renders
  per-recipient (HMAC unsubscribe link), sends sequentially (free-tier friendly), records every
  attempt in `newsletter_sends` with a `sponsor` flag for the sponsor-slot CTR split.
- Weekly cadence = the admin endpoint is the trigger; no cron wiring in this slice.

## Open questions (owner)
- Send day? (suggest Sunday roundup like PH — confirm)
- ESP decision blocks this (see watchlists-alerts.md).
