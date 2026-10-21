# 04 — Embed badges (P0)

Goal: turn every winner into our billboard (backlinks + conversions).
Stolen from: PH badges (+10–20% conversion lift, maker-reported), TrustMRR
live revenue badge, Trustpilot Micro TrustScore.

## Constraints honored
C3 (badges reflect score/rank only — never for sale), C5.

## Research before build
- [x] PH badge embed code + variants (Day/Week/Month/Top)
- [x] TrustMRR live badge auto-update mechanism
- [ ] Trustpilot Micro/Mini widget sizing + dark variants

## Research findings
Research finding (2026-10-08): Product Hunt badge embed confirmed: makers
open Embed from the post's title menu or next to the share buttons, pick a
theme, and — if the product was a top post — choose between Featured and
Top Post badge variants (day or week), then copy the snippet. Note: PH's
official article documents day/week variants only; no Month variant is
mentioned. Our three-size, light-plus-dark plan exceeds PH's documented
options and does not depend on an unverified variant.
— Source: https://help.producthunt.com/en/articles/2731371-how-to-add-a-product-hunt-badge-to-your-website
Research finding (2026-10-08): TrustMRR's verified-revenue badge is a live
embed that "updates automatically with your verified revenue"; the
underlying payment-provider connection is not real-time (reports arrive the
following day), so the badge refreshes on a daily data cycle. That is the
mechanism for our optional live-JS score badge: static snippet first, daily
refresh second, no per-hit computation.
— Source: https://trustmrr.com/faq
Not verified (2026-10-08): Trustpilot Micro/Mini widget sizing and dark
variants could not be confirmed — business.trustpilot.com and
trustpilot.com widget pages return a bot-verification wall (HTTP 403) and
the help center is JavaScript-only. This item stays open; retry from a
browser or drop it if the widget spec is not needed for our zero-JS badges.

## Build spec
- Copy-paste HTML snippets: Score badge, Editor's Pick, Verified (current
  states only — expanded badges deferred per C4), rank badge.
- Light + dark variants, 3 sizes, zero-JS (pure HTML/CSS) + optional live JS.
- Badge gallery page makers link to; click-through UTM tracked.

## Metrics
- Embeds live (referrer hits) · CTR back to profiles · SEO referrers.

## Acceptance
- [x] Snippet works pasted into plain HTML with no console errors — zero-JS by construction:
      no `<script>` in any variant (asserted by tests), pure HTML + CSS + prefers-color-scheme.
- [x] Dark variant legible on near-black — dark theme + auto variant use the token-matched
      dark pair (surface #163330 on bg #0c1f1d, text #c5efe9, muted #7bd2c6).

## Shipped 2026-10-08
- `frontend/src/lib/embed-badges.ts` — pure snippet builders: Score, Verified (only when the
      site earned it), Editor's Pick (only when the launch carries it), Rank. 3 sizes,
      light/dark/auto themes, UTM-baked profile links, escaped names.
- `/badges?slug=` / `/badges?launch=` gallery — live preview, theme/size picker, copy button,
      honest empty state (labeled example when no slug given). Linked from every site profile
      ("Share your score") and launch page ("Share your rank").
- Open question for the owner: live-JS auto-updating score badge now, or static-first?
      Research direction (TrustMRR): static snippet first, daily refresh second. Static-first
      shipped; live JS can layer on later without changing the embed contract.
