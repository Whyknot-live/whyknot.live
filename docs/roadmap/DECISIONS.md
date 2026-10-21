# Owner decisions (append-only)

- 2026-09-09: constraints locked (C1–C5, see CONSTRAINTS.md).
- 2026-09-09: implement first = **P0 cleanup sweep**.
- 2026-09-09: Razorpay scope = **INR only at launch** (UPI + cards); USD later.
- 2026-09-09: sponsored rate card = **start modest** (TrustMRR-ladder shape in INR).
- 2026-09-29: product name = plain **WhyKnot** (no question mark) everywhere.
- 2026-09-29: **loop** is the user-facing name for the waitlist; API routes, admin and the database keep "waitlist".
- 2026-09-29: **Alpha Community** is hero marketing copy only, not a product surface or feature name.
- 2026-09-29: full launch = **2026-10-09** (alpha on 2026-09-19 is done).
- 2026-09-29: **glass only on overlays**: no backdrop-filter glass on cards; a subtle blur stays only on the navigation bar, dialogs and the cookie banner. Cards are solid surfaces with a hairline border and the shadow tokens.
- 2026-09-29: light page background = **soft teal-white** (`--color-bg` #fbfefe); cards and surfaces stay white. Dark theme unchanged.
- 2026-09-29: **puns only in easter eggs** (knot puns, console eggs), never in interface copy.
- 2026-10-08: **maker-reply norm is ours** — WhyKnot defines and publishes its own reply-speed norm
  in the methodology page instead of citing Product Hunt's unpublished 2-2-2 consensus (owner pick).
- 2026-10-08: **homepage launches section = recency + rank**: top-ranked launch among the last
  7 days, falling back to plain rank when the week is empty (owner pick Q1=C; makes the
  "Launches of the week" label honest and gives every slot day homepage exposure).
- 2026-10-08: **relaunch eligibility = 6-month gap + significant update**, Product Hunt-aligned
  (owner pick Q2=A; Uneed publishes no window, so this rule is ours and must be published in
  the methodology/relaunch copy).
- 2026-10-09: **Screener is public.** The technical-audit tool gets a public front door (landing,
  live scan, per-scan report) instead of staying internal or being deleted. Rebuilt clean: emoji
  icons replaced with the project Icon set (zero-emoji + DESIGN.md), and the fabricated per-site
  audit scores removed — the report shows only real scans, with an empty state when expired/unknown.
  Static-only preserved via a `_redirects` rewrite to one prerendered report shell. Engine proven live.
- 2026-10-09: **sponsor metrics dashboard = admin-only.** `/api/sponsor/metrics` returns lifetime
  revenue and CTR, so it 401s for anonymous callers before any env or DB read. The public
  methodology explanation stays at `/legal/methodology#sponsored-metrics`. (Owner: "fix everything";
  leaking revenue was the safe-to-lock default.)
- 2026-10-09: **loop wording unified.** Every user-facing CTA (nav desktop + mobile, footer, submit,
  verify, contact) now reads "Join the loop"; the "Get early access" / "Join Waitlist" / "Join the
  maker list" variants are gone. Internal section id and `#waitlist` anchors stay by design.
- 2026-10-21: **the dirty tree lands as one commit.** The 118 uncommitted paths (91 modified,
  27 new) from the parallel sessions are gated on the build box first, then committed to main in
  one commit with explicit paths (owner pick). The tree is load-bearing: the untracked files are
  required by the tracked ones, so a partial commit breaks the build.
- 2026-10-21: **deploy once the gates are green.** The 2026-10-09 full-launch date passed with no
  deploy and no real payment ever tested; the live backend was still running the pre-expansion
  build with no submit, payments, sponsor, screener or newsletter routes (owner pick).
- 2026-10-21: **submissions are edited by their maker, not by anyone.** `PATCH
  /api/submissions/:slug` closes behind an owner-scoped maker session — a signed token minted at
  submit time, bound to that one listing, with its own audience claim so an admin token can never
  be replayed as a maker token (owner pick). The admin review queue keeps its own admin-authed
  route. The maker story is returned only to the owning maker, so the edit form can never save
  over a story it never read.
- 2026-10-21: **an abandoned checkout stops blocking a slot date.** Uniqueness on slot+date
  applies to paid orders only (partial unique index). A checkout in flight holds its date for 15
  minutes so two sponsors cannot pay for the same date; after that the date frees itself. The
  paid-only index is created before the legacy all-statuses index is dropped, so a failed
  migration keeps the stricter index instead of leaving no uniqueness at all (owner pick).
