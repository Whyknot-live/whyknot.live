# Status — resume here

Created 2026-10-08 from a full code-is-truth status pass (two read-only audits of source, not docs).
Update this block every working session; the roadmap README stays the scoreboard.

## Resume here (2026-10-21)

- Owner picked four things (typed in chat, recorded in DECISIONS.md):
  1. the dirty tree lands as ONE commit after the gates pass on the build box;
  2. deploy once the gates are green;
  3. `PATCH /api/submissions/:slug` closes behind an owner-scoped maker session;
  4. an abandoned sponsor order stops blocking a slot date (partial unique index on paid only).
- LIVE STATE BEFORE THIS SESSION (checked, not assumed): whyknot.live was still serving the OLD
  build — `/screener` 404, and api.whyknot.live had NO `/api/submit`, `/api/payments/config`,
  `/api/sponsor/availability` or `/api/screener` routes at all (404). The whole platform expansion
  had never been deployed; the live backend predated 0f167ba. Origin/main was two commits behind
  local main (0f167ba + 46ec5f8 unpushed).
- What changed this session:
  - **Maker session (new `backend/src/utils/maker-session.ts`)**: a signed token minted at submit
    time, scoped to one listing (slug + maker handle), own audience claim so an admin token can
    never be replayed as a maker token. `PATCH /api/submissions/:slug` now 401s without it and
    403s a session that belongs to another listing; the check runs BEFORE connectMongo. The maker
    story is returned only to the owning maker, so the edit form can never save over a story it
    never read. New `frontend/src/pages/edit.astro` (noindex, honest empty states) + the token
    kept in the browser by `frontend/src/lib/maker-session.ts`.
  - **Sponsor slots**: `slot_orders` uniqueness now applies to PAID orders only (partial unique
    index). An in-flight checkout holds its date for 15 minutes so two sponsors cannot pay for the
    same date; after that the date frees itself. Availability and the order insert now agree
    (both count paid + held). The paid-only index is created BEFORE the legacy all-statuses index
    is dropped, so a failed migration keeps the stricter index instead of leaving none. A paid
    order that loses its date is marked `conflict` and counted in the admin metrics — never
    silently dropped, and no automatic refund (money is the owner's line).
  - **Loop wording, still leaking**: sponsor page, checkout button and the contact CTA said
    "waitlist" (and the contact CTA pointed at a dead `#early-access` anchor). All now say "loop"
    and the anchor is `#waitlist`. The privacy policy still says "waitlist" in two places — legal
    copy, left for the owner.
  - **admin tokens were stale**: `admin/src/styles/tokens.css` was regenerated from the frontend
    source (the copy still had the old font stack, the old background and no type scale).
  - **backend typecheck is clean for the first time**: `tests/screener.test.ts` imported
    `bun:test` while the backend tsconfig whitelists node types. Switched to `node:test` like
    every other test file.
  - **Recovered the stranded loop docs**: `docs/agent-loops/whyknot-launch/**` (queue, contracts,
    research, resume page) lived only on branch `agent/whyknot-launch` and was copied back as
    docs. That branch's CODE side is a 5 Oct baseline that deletes the rebuilt screener — it must
    never be merged whole.
- Gates on compute-mini (all green, real exit lines):
  - backend: typecheck clean, lint 31 warnings 0 errors, `bun test src/tests` 148 pass / 0 fail
    (was 114; +34 new: maker session, sponsor hold, sponsor conflict, index migration).
  - frontend: typecheck clean, lint clean (token-guard OK), `bun test` 31 pass / 0 fail,
    `bun run build` 82 pages (81 + the new /edit page), pagefind indexed 82.
  - admin: typecheck clean, lint 8 warnings 0 errors, tokens-sync OK, build 4 pages.
  - Negative control PROVEN on the box: with the maker-session guard removed from the PATCH
    route, both 401 tests FAIL (the request reaches Mongo); with it in place they pass.
- Box notes for the next session: `bun install` must run in the REPO ROOT too — `astro-pagefind`
    lives in the root package and `frontend/astro.config.mjs` imports it, so a frontend-only
    install breaks `astro sync` (and the content types with it). The box was also running another
    session's Flutter build during the frontend build: it took 36 minutes instead of the usual
    few. Compute stays off the Mac (owner rule 23).
- COMMITTED AND PUSHED (2026-10-21): `337726e` (the whole tree + this session's fixes) and
  `bcefad0` (privacy policy: waitlist -> loop, both places). Remote moved to the org:
  `https://github.com/Whyknot-live/whyknot.live.git` (the old path still redirects).
- DEPLOY STATE (checked on the live site, not assumed): the ADMIN static site DID auto-deploy my
  commit — it serves the same content-hashed asset as the box build (`claims.CsdYvclT.css`) with
  `last-modified` one minute after the push. The public site (www) and the API did NOT: after 45
  minutes `/screener` is still 404 on www and every new API route is still 404 on
  api.whyknot.live. Their auto-deploy is off or their builds are failing; a Render API key is
  needed to see which and to trigger them.
- DEPLOY ROOT CAUSE (found with the Render key, 2026-10-21): the three WhyKnot services are
  `admin.whyknot.live` (static), `whyknot.live` (static) and `whyknot.live-backend` (web
  service, custom domain api.whyknot.live). The admin auto-deploys on `commit`; the other two
  use `autoDeployTrigger=checksPass` — and NO check ever reports, because GitHub Actions stopped
  running for this repo after it moved to the Whyknot-live org, and CircleCI reports nothing
  either. So the public site and the API waited forever for a check that never came. Fixing CI
  (or setting those two services to trigger on `commit`, like the admin) is the lasting fix.
- THE FIRST PUBLIC DEPLOY FAILED, AND IT WAS NOT THE DEPLOY: `frontend/astro.config.mjs` imports
  `astro-pagefind`, but 0f167ba put that dependency in the ROOT package.json while the frontend
  installs on its own (Render rootDir ./frontend, CI `cd frontend && bun install`). The import
  could never resolve, so `astro build` died. Fixed: the dependency now lives in
  frontend/package.json, and the root package.json + bun.lock are deleted (they held only that
  one dependency and no service used them). Proven on the box with Render's exact path: no root
  node_modules, frontend-only install, `bun run build` -> 82 pages, pagefind indexed.
- The public site had been serving a build from 2025-12-22 and the API one from 2026-08-23: the
  whole platform expansion had never reached production. As of 2026-10-21 the API is live on the
  new build (PATCH without a maker session -> 401, /api/sponsor/metrics -> 401, /api/payments/
  config -> {"configured":false}).
- A Render API key now sits in backend/.env (gitignored). It was pasted in chat, so it should be
  rotated once the deploys are done. With it: the deploy endpoints work, but the env-var and logs
  endpoints return 404 for this key, so the service env cannot be read or written from the CLI.
- STILL MISSING ON THE LIVE SERVICE (owner action, Render dashboard -> the backend service ->
  Environment): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET (the webhook
  fails closed without it outside development), RESEND_API_KEY, ENABLE_EMAIL, EMAIL_FROM,
  EMAIL_REPLY_TO, and REDIS_URL + USE_REDIS_RATE_LIMIT=1 (the live API currently rate limits in
  memory only). The values for all of them are in the local backend/.env.
- Live facts worth keeping: the public build resolves the API base to `https://api.whyknot.live`
  (baked in at build time, NOT from a repo file — `frontend/.env` is gitignored and irrelevant to
  production). The admin resolves the same host. The live API currently runs with Redis DISABLED
  (in-memory rate limiting) and without any Razorpay or Resend keys. The service
  `whyknot-live-development-backend.onrender.com` has no server attached (`x-render-routing:
  no-server`) — it is dead, and the local `frontend/.env` still points at it.
- Still open, not fixed here: fonts still come from Google's CDN (Head.astro), velocity ranking
    is still not trust-weighted, screenshots still fall back to a placeholder, review/watchlist/
    stats-hub/API (P2) untouched, the abandoned-order rows in the live database are unknown until
    the backend boots against it (the migration is written to survive them either way).

## Resume here (2026-10-09)

- Full launch: 2026-10-09. Owner decision 2026-10-08 and re-confirmed 2026-10-09: **no deploy**; keep building.
  When a deploy option is picked, the owner said **the agent commits** (explicit paths, to main).
- SCREENER IS PUBLIC (owner decision 2026-10-09). Front door rebuilt clean and honest on 2026-10-09:
  - `frontend/src/pages/screener/index.astro` (landing), `scan.astro` (live scan), `report/[id].astro` (report),
    `frontend/src/styles/components/screener.css` (wired into `styles/components/index.css`).
  - Rebuilt from the git-history version with two fixes: emoji pillar icons replaced with the project Icon set
    (zero-emoji rule + DESIGN.md), and the old fabricated per-site audit scores REMOVED (honesty rule) — the
    report shows only real scans and an empty state when expired/unknown.
  - Static-only preserved: the report route ships one prerendered shell; `frontend/public/_redirects` rewrites
    `/screener/report/*` to it so live `scan_<id>` URLs resolve client-side. No SSR.
  - Engine proven live on the box: `runScreenerAudit('https://example.com')` returned a real audit (overall 68,
    5 findings, per-pillar scores). Screener pages serve 200 in dev.
- SPONSOR METRICS NOW ADMIN-ONLY (was a public revenue leak). `/api/sponsor/metrics` 401s for anonymous callers
  BEFORE validateEnv()/connectMongo() run; auth matches the admin cookie/JWT pattern. Public methodology stays at
  `/legal/methodology#sponsored-metrics`. 2 new tests (anonymous 401 negative control + source-order guard) green.
- LOOP WORDING FIXED across every surface (owner pick 2026-10-09): nav (desktop + mobile), footer, submit, verify,
  contact CTAs now read "Join the loop" instead of "Get early access" / "Join Waitlist" / "Join the maker list".
  Section id and internal `#waitlist` anchors unchanged by design (users see "loop", internals keep "waitlist").
- Gates 2026-10-09 (compute-mini, after all above): backend `bun test` 114 pass / 0 fail; frontend `bun test` not
  run this pass (no frontend test files changed); frontend typecheck exit 0; frontend lint clean (hex warnings are
  pre-existing files, not screener.css); frontend build 81 pages exit 0 (screener pages present, _redirects shipped).
- Working tree: ~115 dirty paths from parallel sessions. Never revert them. Untracked files are load-bearing for
  tracked ones; a partial commit breaks the build.
  - Razorpay: code complete (orders, signature verify, webhook, entitlements) but the first real
    test transaction has never run — blocked on deploy, not on code.
  - Sponsored: bookable + labeled + measurable since 2026-10-08 (webhook flips `slot_orders` to paid,
    `slot_events` ingested, `BoostSlot.astro` wired on the launches board). Metrics endpoint now admin-only.
  - Submit loop: submit + admin review API + admin review UI all exist (built 2026-10-08); publish step is
    the promote script (`frontend/scripts/promote-launches.mjs`, landed + tested 2026-10-08).
  - Newsletter: double-opt-in confirm email + admin send endpoint built 2026-10-08 (replaces the old 501);
    sends still gated on live keys (dry run until deploy).
- P0 leftovers: self-hosted fonts still Google CDN (`frontend/src/components/Head.astro:211`),
  screenshots still monogram fallback (`ScreenshotViewer.astro:30`), embed badges feature 04 has
  code (built 2026-10-08, `frontend/src/lib/embed-badges.ts` + `/badges`), velocity has no trust weights.
- P2: Screener engine + now a public front door (2026-10-09); reviews, watchlists, stats-hub, API still untouched.
- Working tree: ~71 uncommitted changes from a parallel session (design tokens, custom controls,
  screener pages removed, new Select/Switch/Icon components). Nothing modified since 2026-09-30.
  **Never revert these.** Risk: untracked files are load-bearing for tracked ones — a partial
  commit breaks the build.
- C5 research: 45/50 roadmap boxes ticked 2026-10-08 with live sources; findings written into each
  md. 5 left open with reasons (see DECISIONS-relevant list below).

## Units and review verdicts (2026-10-08)

1. Promote script — FIXED + VERIFIED. All review findings closed: scheduled entries excluded
   from Today/Week/Month boards + homepage (liveOnly), launchDayBounds anchored on live launches
   only, LaunchCard shows a Scheduled badge + open date, atomic tmp+rename write, malformed
   pagination -> exit 1, slug-collision -> exit 1 with per-slug log, makerHandle '@' strip +
   regex, surrogate-safe Intl.Segmenter truncation, UTC today, env-first secret, 1000-page cap.
   Full control suite re-run by parent: dead port / 6 negative fixtures / double-run idempotency
   / 2-page dedupe / empty-page / long-story (1199 chars) / '@' strip / infinite-pagination cap —
   all exit 1 byte-identical or promote correctly. Regression tests in
   frontend/src/lib/launch-events.test.ts (13 pass on box).
2. Sponsored measurement — FIXED + VERIFIED. Webhook refuses unsigned bodies in non-development
   (fail-closed), dedupe key deleted on effect failure so Razorpay retries reprocess, beacons
   gated on a paid campaign via new public GET /api/sponsor/boost (open slot = zero beacons),
   "Why?" methodology link excluded (data-no-track), tautological C3 tests replaced, currency
   mismatch negative control added. 19 new backend tests green (107 total, 0 fail).
3. Admin submissions review UI — APPROVED (in-session pass, labeled per OWNER 3a; sub-agents
   were 429ing). Pre-existing pattern note: inline style="display:none" attributes across all
   admin pages (inherited from claims.astro) — project-wide convention question, not this unit.
4. Homepage recency+rank (owner pick Q1=C) — IMPLEMENTED + GREEN: rankedRecent() in
   frontend/src/lib/launch-events.ts, wired at index.astro:40-43 (top rank of last 7 days,
   fallback to plain rank when the week is empty), 2 regression tests, 15/15 frontend tests pass.
5. Newsletter send enable — BUILT + GREEN (112 backend tests, 5 new): double-opt-in confirm email
   (fire-and-forget, Resend, env-gated), admin send endpoint (replaces the 501) with
   per-recipient HMAC unsubscribe links + newsletter_sends records (sponsor flag for the CTR split).
6. Embed badges (feature 04) — BUILT, gates running: pure zero-JS snippet builders (Score,
   Verified, Editor's Pick, Rank — only shown when earned), 3 sizes + light/dark/auto themes,
   UTM-baked links, /badges gallery with preview + theme/size picker + copy, CTAs on every
   site profile and launch page.

## Gates — all GREEN 2026-10-08 (compute-mini, after fixes)

- backend `bun test`: 107 pass / 0 fail (19 new money-path tests verified by name in the log).
- frontend `bun test`: 13 pass / 0 fail (incl. scheduled-anchor + rankedRecent regressions).
- frontend build: 77 pages, exit 0. admin build: 4 pages (incl. /submissions), exit 0.
- Mac-side: typecheck clean in frontend; backend typecheck has ONLY the known pre-existing
  screener.test.ts bun:test error (committed 0f167ba); lint clean (one preserve-caught-error
  warning in promote-launches.mjs fixed).
- Sync exclusions verified on the box: no .env, no .git; .env.example false-positive fixed.

## Adversarial money-path pass (2026-10-08, in-session, labeled per OWNER 3a)

Re-attacked the fixed sponsored unit as an adversary; every fix holds at the source:
- Unsigned webhook + non-development -> 503 BEFORE any DB write or side effect; signature
  check stays timing-safe and precedes effects.
- Dedupe key deleted on effect failure -> Razorpay redelivery reprocesses; both effects
  idempotent (grantEntitlement upserts, markSponsorOrderPaid matches status 'created').
- markSponsorOrderPaid: amount/currency mismatch fails closed; entitlement orders untouched.
- BoostSlot: campaign read fail-safe -> null -> ZERO beacons on an open slot; the "Why?"
  methodology link carries data-no-track and is excluded from click wiring.
- Ingest: Zod enums only, server timestamp, per-IP rate limit (Redis or in-memory),
  generic errors. C3: BoostSlot outside the ranked grid, no sort input, neutral label.
Residual (accepted, recorded): amount check skipped when the signed payload omits amount —
signature remains the primary guarantee and payment.captured always carries it.

Both fix sub-agents died on provider rate limits (429) after writing most of their code; the
parent audited the partial state at the source, finished the missing fixtures/tests in-session,
and re-ran every control. Lesson recorded: when two lanes 429, continue in-session immediately
rather than re-dispatching.

## Gates — run 2026-10-08 on compute-mini, all GREEN

- backend `bun test`: 93 pass / 0 fail (incl. all 16 new money-path tests, verified by name in
  the log, not by exit code alone). frontend build: 77 pages, exit 0. admin build: 4 pages
  (incl. /submissions), exit 0. Sync exclusions verified: no `.env` on the box; the
  `.env.*` YES-PROBLEM was `.env.example` placeholders only (false positive — mini-sync check
  fixed to ignore examples; placeholder values confirmed, no live secrets).
- To re-run after fixes: `./scripts/mini-sync.sh --apply` then backend `bun test`,
  `frontend && bun run build`, `admin && bun run build` (login shell on compute-mini).

## Owner decisions recorded (2026-10-08)

- Homepage launches section = top rank among last-7-days launches, fallback to plain rank when
  the week is empty. QUEUED — touches index.astro:41, same file as the scheduled filter, so it
  runs only after the promote fix unit lands (do not parallelize).
- Relaunch eligibility = 6 months + significant update, PH-aligned (DECISIONS.md +
  features/launch-events.md).

## Known pre-existing issues (reviewer finds, outside current units — recorded, not silently fixed)

- Sponsor booking unique index {slot,date} covers ALL statuses: an abandoned 'created' order
  blocks the date while /sponsor/availability still reports it free (sponsor.ts:187-193,
  mongo.ts:84-87). P1-relevant — candidate next unit.
- Rate-limiter proxy mode unverified (TRUST_PROXY_FORWARDED): one key for all traffic behind the
  proxy, or header-rotation bypass (utils/request.ts:34-51).
- slot_events no TTL; /sponsor/metrics full-scans; revenuePaise lifetime vs occupancy windowed.
- /sponsor/metrics unauthenticated, discloses lifetime revenue (owner call: methodology
  transparency or not).
- backend typecheck baseline error: tests/screener.test.ts bun:test (committed 0f167ba).
- webhook logs email on signature-mismatch warn (payments.ts:176).
- [slug].astro has 11 inline `style=` attributes — identical count at HEAD, pre-existing.

## Pending on Jay (none blocking today's build)

- Razorpay Dashboard: FIRS certificate check (C5 P1 item, owner-only).
- GST export invoicing / LUT: CA confirm + official source (portals were down 2026-10-08).
- ~~launch-events 2-2-2 reply rule~~ RESOLVED 2026-10-08: we write our own norm (owner pick).
- ~~Relaunch eligibility window~~ RESOLVED 2026-10-08: 6 months + significant update (owner pick).
- ~~Homepage launches section~~ RESOLVED 2026-10-08: recency + rank (owner pick Q1=C).
- Unauthenticated /sponsor/metrics disclosing lifetime revenue: is that intentional
  methodology transparency? (owner/taste call, surfaced by review).
- Deploy timing: re-asked when P1 wiring lands (answer 2026-10-08: not yet).

## Next

1. Confirm newsletter gates green on the box (running), then:
2. Embed badges (feature 04 — zero code today) + SEO quick wins (real screenshots,
   self-hosted fonts, `?ref=whyknot` outbound).
3. Adversarial pass on the sponsored money path after its fix (owed per rule 3).
4. Re-ask deploy timing when P1 wiring lands (owner answer 2026-10-08: not yet).
