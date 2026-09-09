# 04 — Embed badges (P0)

Goal: turn every winner into our billboard (backlinks + conversions).
Stolen from: PH badges (+10–20% conversion lift, maker-reported), TrustMRR
live revenue badge, Trustpilot Micro TrustScore.

## Constraints honored
C3 (badges reflect score/rank only — never for sale), C5.

## Research before build
- [ ] PH badge embed code + variants (Day/Week/Month/Top)
- [ ] TrustMRR live badge auto-update mechanism
- [ ] Trustpilot Micro/Mini widget sizing + dark variants

## Build spec
- Copy-paste HTML snippets: Score badge, Editor's Pick, Verified (current
  states only — expanded badges deferred per C4), rank badge.
- Light + dark variants, 3 sizes, zero-JS (pure HTML/CSS) + optional live JS.
- Badge gallery page makers link to; click-through UTM tracked.

## Metrics
- Embeds live (referrer hits) · CTR back to profiles · SEO referrers.

## Acceptance
- [ ] Snippet works pasted into plain HTML with no console errors
- [ ] Dark variant legible on near-black

## Open questions (owner)
- Live-JS badge (auto-updating score) now, or static-first?
