# WhyKnot Design

Source of truth for tokens: frontend/src/styles/tokens.css (single owner). Showcase: frontend/src/pages/design-system.astro.
Product name is "WhyKnot" (no question mark). Read AGENTS.md "Taste" together with this file; they must agree.

## 1. Direction

- WhyKnot has its own taste: a turquoise/teal system with a blue anchor, a knot mark that acts as the hero of the brand, and one
  hero gradient. Handmade and premium, never a template.
- Soft, not harsh. Sleek, not bulky. Every surface works in light and dark, in every state.
- Other platforms are references for motion and polish only, never for color, fonts or component looks.
  Owner: "we stay loyal to whyknot design taste not anyother platfroms".

## 2. Principles

1. Loyal to our own taste. Evidence: owner objected to "orange colros" and "product hunt style comeotns"; AGENTS.md "Design drift".
   Reuse existing tokens and fonts; never introduce a new palette or family.
2. The knot is the hero. Owner: "the knot shall be the best of the thing ... use it multiple places as props ... easter eggs".
   Evidence: HeroKnot.astro serves hero, empty, error, 404, footer through props (size xs|sm|md|lg|hero, tone, static, note, pun).
3. One gradient is the signature. Owner: "the gradit of the hero text was lovel keep that in for both light adn dark". Evidence:
   --gradient-title (tokens.css:223-233) is deliberately identical in both themes.
4. Custom components only. No third-party UI libraries, no native browser chrome. Evidence: Select.astro (listbox), Switch,
   Modal (dialog with inert background), Accordion, RadioGroup, Drawer, Dropdown replace select/checkbox/details/dialog.
5. Variants over restyling. Evidence: HeroKnot size/tone props, .btn variants via --btn-* tokens (tokens.css:883-1166), chip sizes.
6. Honest states. Features without a backend render real empty states, never fake data (AGENTS.md; ReviewCard, WatchButton shells).
7. Sponsored is labeled and neutral, never in merit colors, never a ranking input (C3). Component: SponsoredTag.astro.
8. Motion serves the product. Immersive islands are welcome; anything continuous must degrade to a static poster.

## 3. Tokens (all values from frontend/src/styles/tokens.css)

Color scales (11 steps each, 50 to 900; some have 150/450):
| Family | Anchor | Range (light end to dark end) |
|---|---|---|
| --color-accent-* (turquoise) | 400 = #20c5b5 (primary base), 300 = #2fddcc | 50 #e9fbfa to 900 #0a2e2a |
| --color-secondary-* (cyan) | 300 = #06b6d4 | 50 #dbf9fe to 900 #0a2d32 |
| --color-blue-* (anchor) | 400 = #2a8fc9, 600 = #1a6994 (light link) | 50 #e8f6fd to 900 #1a3442 |
| --color-neutral-* (teal-grey) | 500 = #4a5d61 | 50 #f5f8f9 to 900 #1a2124 |

Semantic colors (light | dark), defined at :root and :root[data-theme=dark] / prefers-color-scheme dark:
| Token | Light | Dark |
|---|---|---|
| --color-bg | #fbfefe (soft teal-white) | #0c1f1d |
| --color-bg-alt | accent-50 (#e9fbfa) | #0f2624 |
| --color-surface / -alt | #ffffff / #f2fbfa | #163330 / #1c3e3a |
| --color-border | #cfe4e2 | #1a4946 |
| --color-text | #092a28 | #c5efe9 |
| --color-text-muted | #486664 | #7bd2c6 |
| --color-link / hover | blue-600 / blue-700 | blue-300 / blue-200 |
| --color-accent / emphasis | accent-400 / 300 | accent-300 / 200 |
| --color-on-accent | accent-contrast #042726 | #ffffff |
| --color-outline-focus | #0d9488 | #2dd4bf |
| status success / warning / danger / info | #0d9488 / #d9850f / #e04f44 / blue-400 | #20c5b5 / #e1ac46 / #ff877c / blue-300 |
Each status also has -bg and -border variants (light: solid tints; dark: color-mix at 30-45% alpha).
Role tokens follow Material naming: primary, secondary, tertiary, each with on-* and *-container; surface-container-lowest..highest
(light #ffffff..#e5f7f5; dark #0a1918..#204845); outline, outline-variant; inverse-*; error-*.

Gradients:
| Token | Value summary |
|---|---|
| --gradient-title (= -vibrant, -light, -dark) | 135deg accent-400 0%, accent-200 35%, secondary-100 65%, blue-300 100%; same in both themes |
| --gradient-accent | 125deg dark-teal to turquoise to pale mint; dark: opaque ramp 0.8-1 alpha; light: 0.12-0.2 alpha tints |
| --gradient-accent-glow | radial white 18% (dark) or turquoise 8% (light) |
| --gradient-radial-hero | radial at 28% 22%, turquoise 30% into #050f15 (dark); 8% turquoise (light) |

Type (families here, sizes in section 4): --font-display "Bebas Neue", --font-sans "Outfit" + system stack,
--font-hand "Caveat", --font-mono system mono stack.

Spacing (--space-*): 0-5 2px, 1 4, 1-5 6, 2 8, 2-5 10, 3 12, 3-5 14, 4 16, 5 20, 6 24, 8 32, 10 40, 12 48, 16 64, 20 80, 24 96.
Layout: --page-max-width 72rem.

Radii: xs 2px, sm 4px, md 6px, lg 12px, xl 16px, full 999px. --btn-radius = full; --input-radius 6px; --chip-radius 6px.

Borders: hairline 1px using --color-border / --color-outline-variant / --input-border. Focus: --input-focus-ring (1px accent-400 ring).

Shadows (light | dark): sm 0 1px 2px -1px @.15 | @.55; md 0 4px 12px -2px @.18 | 0 4px 14px -2px @.55; lg 0 8px 28px -4px @.28 | 0 10px 34px -6px @.70.

Motion: --transition-fast 120ms and --transition-base 200ms, both cubic-bezier(.4, 0, .2, 1).

Control sizing: input height sm 2rem / 2.375rem / lg 2.75rem, font 0.875rem (sm 0.8125rem); chip height 1.5 / 1.75 / 2.125rem,
font 0.78rem; button font .95rem, weight 600, padding .65rem 1rem.

Brand-specific: --knot-ink accent-500, --knot-ink-soft (accent-400/blue-400 mix), --note-ink (accent-700 light, accent-150 dark),
--note-rotate -1.5deg (handwritten notes).

## 4. Typography

- Exactly three fonts plus system mono: Bebas Neue (display, headings), Outfit (body and UI), Caveat (handwritten notes).
  Loaded from Google Fonts in Head.astro:211. "No font change" is an owner rule. Do not add a fourth face.
- Hand font is for human touches only (knot notes, easter eggs, margin notes), never for body copy or controls.
- Scale tokens (tokens.css, `--text-*`, rem): xs .72, sm .82, ui .875 (controls), md .95, base 1 (body), lg 1.08, lead 1.125,
  title-sm 1.25, xl 1.32, title 1.5, 2xl 1.7, title-lg 2, 3xl 2.2, display-sm 2.5, 4xl 2.9; fluid: --text-section
  clamp(1.6rem, 3vw, 2.2rem), --text-display clamp(2.25rem, 6vw, 3.55rem) (site-header h1, letter-spacing -.02em).
  Line heights: --leading-tight 1.15, --leading-base 1.55; body copy runs 1rem / 1.6. Chip 0.78rem and input-sm 0.8125rem
  keep their own control tokens. Some older rules still carry literal sizes (1.1rem, 0.9rem, 0.8rem, 0.85rem); move them onto
  the scale when touched.
- Gradient text uses --gradient-title with background-clip; keep a solid --color-text fallback in the same rule.
- Type scale: `--text-*` tokens landed 2026-09-29 (tokens.css owns them; the design-system page documents them).

## 5. Color and theming

- Every color token has a light and dark value. Theme switch: [data-theme=light|dark] on :root, with prefers-color-scheme fallback;
  ThemeToggle.astro owns the switch. New tokens must ship both values in the same change.
- Soft, never harsh. Body text is #092a28 on white and #c5efe9 on #0c1f1d, not black on white. Contrast at least 4.5:1 for text,
  3:1 for UI edges and focus. Check both themes.
- Use semantic roles (--color-text, --color-surface-container-*, --color-outline-variant), not raw scale steps, in components.
  Raw --color-accent-* steps are for the palette, gradients and token definitions.
- Accent is turquoise. Blue is the anchor for links and secondary actions. Status colors are for status only.
- Gradients are allowed on: hero text (--gradient-title), the hero backdrop (--gradient-radial-hero), accent tone cards
  (.card[data-tone=accent]), and the knot. Everywhere else stay flat. No gradient buttons, no gradient body text.
- No outside brand colors (orange, Cloudflare, Product Hunt). Sponsored uses a neutral color, never a merit color.
- Light page background is a soft teal-white, --color-bg #fbfefe (owner decision 2026-09-29, applied); cards and surfaces
  stay white so they lift off the page. Contrast on #fbfefe: text 15.08, muted 6.16, link 5.93, link-hover 8.08. No pure black anywhere.

## 6. Layout and spacing

- 8pt rhythm: use --space-* tokens, multiples of 4/8px. No arbitrary pixel gaps.
- Content width --page-max-width 72rem; horizontal padding clamp(1rem, 4vw, 2rem); vertical section padding clamp(2rem, 6vw, 4rem).
- Breakpoints in use: 480, 768, 900 and 901-1200 (layout.css). Verify at 375, 768, 1024 and 1440 widths.
- Hairline borders (1px) over shadows for separation; shadows are sm/md/lg only. Radii small (4-6px controls, 12-16px large
  surfaces); pill (--radius-full) only for CTAs and buttons.
- Cards are solid: --color-surface, 1px --color-border, --shadow-sm (hover --shadow-md). Accent tone is the one tinted variant
  (accent-400 mixed into the surface in dark, accent-50 to accent-100 in light). Subtle blur (12px or less) lives only on the
  navigation bar, cookie banner and dialog overlay.
- Hero: not a split layout, not an empty background. Knot or gradient backdrop fills the space (owner dislikes).
- Component CSS lives in frontend/src/styles/components/, no inline styles in .astro files (design-system.astro now uses
  .ds-* helper classes; a few older components still carry a <style> block: ClaimForm, Countdown, SubmitForm, SponsoredTag,
  cookie-policy).

## 7. Components

Custom set (frontend/src/components/): primitives (Icon, Logo, Avatar, TechBadge, VerifyBadge with 6 states, SponsoredTag, StarRating,
ReviewStars, Sparkline, ScoreRing/Bars/Card, DistributionBar, StatTile), controls (Select, Dropdown, Switch, RadioGroup, SearchInput,
FormField, Tabs, AccordionItem, Pagination), overlays (Modal, Drawer, FilterDrawer, Toast, CookieConsent), cards (SiteCard, LaunchCard,
CollectionCard, MakerCard, ReviewCard), states (EmptyState, ErrorState), flows (SubmitForm, SlotPicker, ClaimForm, CheckoutButton,
Waitlist/loop, NewsletterSubscribe, WatchButton, Countdown), brand (HeroKnot, HeroConstellation, HeroPrism, SectionEggs, ThemeToggle),
react/ islands (CountUp, SplitReveal, SpotlightCard).
CSS import order (styles/components/index.css, loaded after tokens.css): layout, primitives, navigation, footer, forms, blog, pages, hero,
design-system, cookie-consent, waitlist, icons, select, accordion, switch, dialog, radiogroup.

Rules:
- No native select, details, dialog, checkbox or browser-styled controls. Use the custom component; add a variant if one is missing.
- Variants and props over restyling: extend size/tone/variant, never override a component from a page.
- Every component ships all states: default, hover, active, focus-visible, disabled, loading, success, error, empty; light and dark.
- Accessibility patterns as shipped: Select uses aria-haspopup=listbox + role=option + aria-selected; Modal uses role=dialog aria-modal,
  focus-in on open, and inert on main/footer; Tabs use roving tabindex; HeroKnot exposes role=button with keyboard activation.
- Any new component is added to design-system.astro in the same change.
- Icons: knot-taste custom set via Icon.astro, not generic stroke packs and not text glyphs as icons.

## 8. Motion

- Tokens: 120ms (fast) and 200ms (base) with the standard ease. Prefer transform and opacity.
- prefers-reduced-motion is respected (16 rules in styles/). Animated islands must show a static poster under reduced motion,
  data-saver (navigator.connection.saveData) and no WebGL. Pattern: HeroKnot.astro:100-126.
- Three.js is lazy: dynamic import on view (IntersectionObserver), never on initial load. No continuous repaint when off-screen or hidden.
- Welcome: the WebGL knot, section-to-section Three.js easter eggs, hand-written React-Bits-style islands (react/), scroll reveals.
  Not welcome: decorative motion on core reading or form surfaces, autoplay loops without a static fallback.
- Cloudflare-like immersion is liked for polish and pacing only, never its colors.

## 9. Copy voice

Christopher Nolan cinematic minimalism (owner-approved): short, declarative, concrete nouns (signal, orbit, gravity, watch, record),
time as the stakes, rules stated plainly. No puns in product copy, no exclamation marks, no emojis. Human touches live in the hand
font and easter eggs (knot puns in data/knot-puns), kept off critical paths. Sponsored is always called Sponsored. "loop" is the
user-facing name for the waitlist. "Alpha Community" is hero marketing copy only. Never write "Product Hunt style" or
"Cloudflare style".
Puns live only in easter eggs (knot puns, console eggs), never in interface copy (owner decision 2026-09-29).

## 10. Never

- Cloudflare orange, Product Hunt style components, other platforms' palettes or fonts, changed fonts.
- Glass cards ("not glass smtg else"), backdrop-filter blur as a card look. A subtle blur is allowed only on
  overlays where it aids legibility: navigation bar, dialogs, cookie banner (owner decision 2026-09-29).
- Split hero layouts, empty backgrounds, generic "AI slop" chips and breadcrumbs, template-looking sections.
- Native browser controls (select, details, dialog, checkbox, default scrollbars on custom panes).
- Third-party UI libraries, new badge states beyond the six (C4), sponsored in merit colors, sponsored affecting rank.
- Pure black surfaces; a pure white page background; text below 4.5:1; light-only or dark-only tokens.
- A question mark in the product name; emojis; puns and exclamations in product copy.
- Continuous animation with no reduced-motion, data-saver or no-WebGL fallback.

## 11. Enforcement

- frontend/scripts/check-tokens.mjs (run by `bun run lint` with oxlint): fails if any .css under src/styles other than tokens.css
  redefines --font-sans, --font-mono, --color-accent, --color-bg, --color-text or --page-max-width inside a :root block. It does not
  check fonts loaded, dark-pair completeness or gradients; hex, glass and font-family are covered by the warn-only checks below.
- Admin tokens: admin/src/styles/tokens.css is meant to be a copy of the frontend file. It has drifted (older values for
  --font-sans, --radius-md/lg, gradient titles, link hover, no form/chip/knot tokens). admin/scripts/sync-tokens.mjs (added
  2026-09-29) reports the drift in warn mode from `bun run lint` in admin, and `--write` overwrites the admin copy. Nothing was
  overwritten; the owner decides whether the differences are intentional.
- Verify any UI change: run `bun run typecheck` and `bun run lint` (not `astro check`, which breaks on the path with spaces);
  view in light and dark; exercise every state; test at 375, 768, 1024, 1440; test reduced-motion and no-WebGL for animated pieces;
  confirm the component appears in /design-system; state which "Hit every surface" items applied.
- check-tokens.mjs also runs three WARN-mode checks (added 2026-09-29, print only, never fail): raw hex outside tokens.css,
  `backdrop-filter` outside navigation.css / cookie-consent.css / dialog.css, and font-family values outside Bebas Neue / Outfit /
  Caveat / system mono. Set WARN_ONLY to false in the script to make them fail once the counts reach zero.
