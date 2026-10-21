# whyknot.launch — K01 (sponsor paid transition) + K02 (PATCH /submissions auth) research

Read-only research, worktree `/Users/jay/Development/Projects/.agent-worktrees/whyknot/whyknot-launch`.
No repo file was created, edited or deleted; no .env/env file was read; no builds, installs or git writes.
Source files are cited `path:line` relative to the worktree root.

Queue context: `docs/agent-loops/whyknot-launch/queue.json:138-147` (K01, gate 7 owner approval before any
payment-state change), `:149-158` (K02, maker-auth scope is Jay's gate 12), `:160-169` (K03, webhook fails
open when `RAZORPAY_WEBHOOK_SECRET` unset — `backend/src/routes/payments.ts:239-246`).

---

## PART 1 — K01: sponsor slot orders are never marked `paid`

### The money path as built

Backend `backend/src/routes/sponsor.ts`:
- `POST /api/sponsor/order` — `:124-200`. Validates (`:128-135`), checks slot free by querying
  `status:'paid'` (`:140-147`), creates the Razorpay order **with booking details in order notes**
  (`:153-163`, notes = `{email, slot, date, url}`), inserts `slot_orders` with `status:'created'`
  (`:164-176`, insert at `:176`), duplicate-key → `409 slot_taken` (`:178-181`), returns
  `{orderId, amount, currency, keyId, eligibility}` (`:184-195`).
- Readers of `status:'paid'` (none of which can ever be true today):
  - `:92-96` — `GET /sponsor/availability` (taken set).
  - `:140-147` — conflict check inside `POST /sponsor/order`.
  - `:210-217` — `GET /sponsor/metrics` (occupancy + `revenuePaise`).
- Writer of `'paid'`: **none anywhere in the repo** (grep `slot_orders` → only sponsor.ts:93,140,176,211
  and the index setup in `backend/src/utils/mongo.ts:84-91`).
- Extra inventory bug: `mongo.ts:84-87` creates a **unique index on `{slot, date}`** (all statuses), so
  the *first* order — even an abandoned `'created'` one — permanently blocks re-booking via the
  duplicate-key 409 at `sponsor.ts:178-181`, while availability (`:92-97`) only counts `'paid'` and
  shows the slot as free. Result: invisible slot burn + permanently empty metrics. `orderId` is also
  unique (`mongo.ts:88-91`), which gives a safe idempotent update key for a future paid transition.

### (a) What the frontend does after `/sponsor/order` returns — nothing verifies it

- `frontend/src/pages/sponsor/index.astro:298-302` — `POST ${apiBase}/api/sponsor/order` with
  `{email, slot, date, url}`.
- `:310-325` — loads `checkout.js` (`:172-181`), opens `new window.Razorpay({key, amount, currency,
  order_id, ...})` (`:311-325`).
- `:320-322` — `handler: () => { window.location.href = '/payment/success?plan=sponsor'; }` — the
  handler **ignores the checkout response object** (`resp.razorpay_order_id/payment_id/signature` are
  never read): no `/payments/verify`, no sponsor confirm endpoint, no client-triggered anything.
- `frontend/src/pages/payment/success.astro:1-27` — static Astro page, only reads `?plan=`; no API call.
- So for sponsor orders: **the only possible server-side signal is Razorpay → `POST /api/payments/webhook`**
  (`backend/src/routes/payments.ts:233-283`), and that handler never touches `slot_orders`
  (it only `recordPaymentEvent` `:261-269` + `grantEntitlement` `:275-281`). Frontends never call webhooks.
- Contrast (working pattern in the same repo): the pricing page `frontend/src/pages/pricing/index.astro:9,98`
  renders `CheckoutButton`, whose **verified-plan** handler `frontend/src/components/CheckoutButton.astro:244-258`
  sends `resp.*` to `POST /api/payments/verify` on success (redirect `/payment/success` on 200, else
  `/payment/failure?reason=verify`, `:256-257`). The subscription branch (`:268-302`) also just redirects
  at `:290-292` and relies on the webhook — same gap as sponsor, but entitlements are granted by the
  webhook there; slot status has no webhook writer at all.
- Side-finding (money risk): `payments.ts:275-276` grants tier `'verified'` on any
  `payment.captured`/`order.paid` with an email — a **sponsor** payment's webhook would grant the buyer
  a free `verified` entitlement (email comes from `payment.email`, `:259-260`). Whatever fix lands for
  K01 should note this crossover.

### (b) Candidate locations for the `'paid' transition` (option, owner gate 7 before any change)

| # | Where | Edits needed | Pros / cons |
|---|-------|--------------|-------------|
| A | `POST /sponsor/verify` (or `/sponsor/confirm`) inside `backend/src/routes/sponsor.ts` (owned), called from `sponsor/index.astro:320` handler with the three checkout fields | Only owned files: `routes/sponsor.ts` + `frontend/src/pages/sponsor/index.astro` | Mirrors the verified-plan flow (`CheckoutButton.astro:244-258`). Verify HMAC (`order_id|payment_id`), then re-fetch the order server-side (`getRazorpay().orders.fetch`, pattern at `payments.ts:181-187`) to confirm amount/currency and `status:'paid'`, cross-check `order.notes` against the `slot_orders` doc, then `updateOne({orderId}, {$set:{status:'paid'}})` (idempotent; unique indexes at `mongo.ts:84-91` guard races). Signature helper: **import** exported `verifyOrderSignature` from `./payments` (`payments.ts:24`, import ≠ edit of the protected file) or copy the ~8 lines into an owned util. Still a money-path change → gate 7. |
| B | Shared helper `backend/src/utils/slot-orders.ts` (owned) containing `markSlotOrderPaid()`, called now from option A and later from the webhook as reconciliation | Owned util + **`routes/payments.ts` for the webhook call site → PROTECTED (owner-only)** | Keeps logic testable/idempotent and gives a second source of truth, but the webhook half cannot land without Jay editing payments.ts. |
| C | Rely on the webhook alone | `routes/payments.ts` is **PROTECTED**; also `:275-281` grants entitlements only | Not viable as-is: webhook never writes `slot_orders`; async/unverified in prod (`docs/roadmap/payments-local-test-2026-09-09.md:29-36`: webhook delivery blocked pending deploy); K03 says it fails open without a secret (`payments.ts:239-246`). |
| D | Admin backfill endpoint | new code in `routes/admin.ts` (owned) | No `slot_orders` admin route exists today (`admin.ts` has waitlist/stats/claims/submissions/newsletter only, `:177-513`); manual-only, does not fix the live flow. |

Recommendation shape (for the plan, not executed): **A now + B wired later if Jay approves a payments.ts
edit**; treat webhook as defence-in-depth, not the primary transition.

### (c) Existing signature-verification helpers

- `backend/src/routes/payments.ts:17-22` — `timingSafeEqualHex` (length check + `crypto.timingSafeEqual`).
- `backend/src/routes/payments.ts:24-27` — `export function verifyOrderSignature(orderId, paymentId,
  signature, secret)`: `HMAC-SHA256(orderId + '|' + paymentId, key_secret)` hex, timing-safe compare.
- `backend/src/routes/payments.ts:29-32` — `export function verifyWebhookSignature(rawBody, signature,
  secret)` over the raw body.
- Used at `payments.ts:164-177` (verify endpoint, order vs subscription recipe `:168-172`) and
  `:239-243` (webhook). Tests import them: `backend/src/tests/payments.test.ts:4,11-27`.
- **All three live in `routes/payments.ts`, which is PROTECTED** (report, do not edit). They are
  `export`ed, so an owned route can import them without touching the protected file. No duplicate
  HMAC helper exists in `backend/src/utils/*` (only `utils/verify-checks.ts:16-17` token-format comment;
  `routes/claim.ts:152-153` mints `crypto.randomBytes` tokens).
- Protected set (per task context): `backend/src/routes/payments.ts`, `backend/src/utils/razorpay.ts`,
  `backend/src/utils/entitlements.ts`, `backend/src/utils/env.ts`.

### (d) Do webhook payloads carry the order notes (email/slot/date/url) on `payment.captured`?

- Our handler: `payments.ts:247` types only `payload.payment.entity {id, order_id, email, notes}` and
  `payload.subscription.entity`; email = `payment.email ?? payment.notes.email ?? subscription.notes.email`
  (`:259-260`). It never reads `payload.order`.
- Razorpay docs (primary sources below): **`payment.captured` payload "only contains the payment entity"**
  — the payment entity has its own `notes` field, and the doc samples show it **empty (`[]`)** with the
  payer's `email` present; docs do **not** state that order notes propagate onto the payment entity.
  **`order.paid` payload "includes both order and payment entities"** — the order entity carries `notes`,
  i.e. the `{email, slot, date, url}` we set at `sponsor.ts:157-162` arrives **only via `order.paid`**
  (or via a server-side `orders.fetch(orderId)`).
- Consequence: a webhook-based fix must read `payload.order.entity.notes` on `order.paid` (requires
  editing protected `payments.ts`, option B) or re-fetch the order server-side; `payment.captured`
  alone cannot be trusted to carry the booking metadata.

### Primary sources (Razorpay official docs only)

1. **Payment signature verification** — https://razorpay.com/docs/payments/server-integration/nodejs/
   (Integration Steps section): *"Use the SHA256 algorithm, the `razorpay_payment_id` and the `order_id`
   to construct an HMAC hex digest: `generated_signature = hmac_sha256(order_id + "|" + razorpay_payment_id, secret)`"*
   compared against `razorpay_signature`; attributes table: *"`order_id` — Retrieve the `order_id` from your
   server. Do not use the `razorpay_order_id` returned by checkout"*; checkout success returns
   `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` to the handler and the docs' sample
   front-end POSTs them to a verify endpoint. Webhook sample: `validateWebhookSignature(rawBody, sig, secret)`
   over the **raw** body. Matches `payments.ts:24-31` exactly.
2. **Webhook payload shapes** — https://razorpay.com/docs/webhooks/payments/ : comparison table
   *"`payment.captured` … This payload **only contains the payment entity**"*; sample `payment.captured`
   payload has `"email"`, `"order_id"`, `"notes": []` on the payment entity; *"payload is a snapshot of
   the entity when the event occurred"*; note *webhook body must be used raw, do not parse or cast*.
3. **Order entity in `order.paid`** — https://razorpay.com/docs/webhooks/orders/ : *"`order.paid` …
   payload **includes both order and payment entities**"*; sample includes
   `"order": {"entity": {..., "status": "paid", "notes": [...]}}` — order notes ride here.
4. Orders `notes` parameter (order creation): same Integration Steps page — `notes` is a key-value object,
   max 15 pairs × 256 chars (what `sponsor.ts:157-162` uses).

Web use: 4 page fetches + 4 searches, razorpay.com only.

---

## PART 2 — K02: unauthenticated `PATCH /api/submissions/:slug`

### The endpoint

- `backend/src/routes/submit.ts:246-308` — `router.patch('/submissions/:slug', ...)`. Guards present:
  Zod `patchSchema` (`:39-46`, non-empty refine), bodyLimit 16 KB (`:55`), IP rate limit
  (`:254-258`, in-memory map `:49-96`), `status === 'queued'` else `409 locked` (`:269-271`).
  **No authentication, no ownership check, no token** — the TODO admits it: `:36-38`
  ("require a maker-auth session here … Lock PATCH to the owning maker account once maker-auth ships").
- Readable surface: `GET /api/submissions/:slug` (`:216-244`) returns `publicView` including `slug`,
  so every queued submission's edit endpoint is enumerable/guessable.
- Allowed fields: `name`, `tagline`, `topics`, `story` (`:39-45`, applied `:272-285`) — not `status`/
  `slotDate`/`url`, so impact is defacement of queued listings, not status escalation.
- CORS explicitly allows `PATCH` on `/api/*` (`backend/src/index.ts:63-70`, `:66`) with
  `credentials: true`; there is no CSRF token anywhere, so cross-origin browser writes are possible for
  allowlisted origins and trivial for curl from anywhere.

### Every caller of `PATCH /api/submissions` (or the endpoint) in `frontend/` and `admin/`

- **Zero.** Repo-wide searches: `method: 'PATCH'|'PATCH'` (only `submit.ts:37,246` and
  `index.ts:66`), `.patch(`/`.put(`/`axios` (no matches outside unrelated `Map.delete` hits),
  `api/submissions|submissions/|'/submissions` (only `submit.ts:216,246`, `admin.ts:472`).
- `frontend/`: no edit-submission UI at all. `frontend/src/pages/submit/index.astro:1-55` is a static
  contract page; `SubmitForm` posts to `/submit` only. No `PATCH`, no `axios`.
- `admin/`: calls only `/admin/*` endpoints — `admin/src/pages/index.astro:98` (`POST /admin/login`),
  `dashboard.astro:254,293,390` (`/admin/stats`, `/admin/waitlist`), `claims.astro:174,200,283`
  (`/admin/claims`, `POST /admin/claims/:id`), via the cookie wrapper `AdminLayout.astro:122-138`
  (`credentials:'include'`, 401 → redirect `/`). The backend's submission moderation is a *separate*
  route `POST /api/admin/submissions/:slug` behind `verifyAdminToken` (`admin.ts:472`, list at `:451`).
- The only in-repo "callers" are documentation/queue text: `docs/agent-loops/whyknot-launch/queue.json:150`
  and the TODO comment `submit.ts:36-38`. ⇒ Locking the endpoint down breaks **no** existing UI;
  it can be hard-gated immediately without a frontend migration.

### Auth primitives already in the repo

- **Admin session (JWT in HttpOnly cookie)** — `backend/src/routes/admin.ts`:
  - imports `sign`/`verify` from `hono/jwt` (`:3`), `setCookie/getCookie/deleteCookie` from `hono/cookie` (`:4`), `bcrypt` (`:6`).
  - `POST /admin/login` (`:40-…`): rate-limited 5/15 min per IP, bcrypt-compares against
    `ADMIN_PASSWORD_HASH`, `sign(...)` a JWT (`:99-107`), sets HttpOnly cookie `adminToken` (`:112-…`).
  - Middleware `verifyAdminToken(c, next)` (`:131-168`): `getCookie('adminToken')` → `verify(token,
    env.ADMIN_JWT_SECRET)` → subject allow-list → `401 token_expired | invalid_token`; applied to every
    admin route (`:177,270,356,362,385,422,451,472,494,513`). Plus `GET /admin/check` (`:327-…`, used by
    `AdminLayout.astro:110`) and `POST /admin/logout` (`:362`).
  - Secret: `ADMIN_JWT_SECRET` (≥32 chars) validated in `backend/src/utils/env.ts:28` (protected file).
  - This is the ready-made pattern for "require an authenticated session" — but it is **admin** identity,
    not maker identity.
- **Token minting/verification (maker-side precedent)** — `routes/claim.ts:152-153`
  (`crypto.randomBytes(12)` claimId, `crypto.randomBytes(16)` token stored on the `claims` doc `:155-169`);
  token format contract `utils/verify-checks.ts:16-17` (`/^[0-9a-f]{32}$/`), `buildExpectedValue` /
  `verificationFilePath` used by `runCheck` (`claim.ts:226`). Newsletter has `confirmToken` /
  `unsubscribeToken` fields (`routes/newsletter.ts:29-40`, unique index `utils/mongo.ts:116-119`).
- **Session storage (unused)** — `backend/src/utils/redis.ts:191-225` exports `sessionSet` /
  `sessionGet` / `sessionDelete`; grep shows **no callers** — a ready hook if a maker session is wanted
  without cookies. Same file: `rateLimitCheck` (`:107-142`), `cacheSet/Get/Delete` (`:148-186`, unused).
- **Request identity / limits / headers** — `utils/request.ts:34-52` `getClientAddress` (proxy headers
  only when `TRUST_PROXY_FORWARDED=1`, else `'shared'` fallback); `middleware/security.ts:52-74`
  `securityHeaders` (CSP, HSTS, frame-deny) and `:77-150` `rateLimitMiddleware` (global 100/min on
  `/api/*`, wired in `index.ts:73`); per-route in-memory limiters in `submit.ts:76-96` (PATCH uses it),
  `claim.ts`, `waitlist.ts`, `newsletter.ts`, `scrape.ts`.
- **No generic auth middleware** exists for non-admin routes; no maker/user accounts or sessions exist
  anywhere; no HMAC/signing helper in `utils/*` except the protected-file exports in payments.ts.

### Protected vs owned (for this fix)

- PROTECTED (report only): `backend/src/routes/payments.ts`, `backend/src/utils/razorpay.ts`,
  `backend/src/utils/entitlements.ts`, `backend/src/utils/env.ts`.
- Owned: `backend/src/routes/*` (incl. `submit.ts`, `admin.ts`, `claim.ts`, `sponsor.ts`),
  `backend/src/utils/*` (except the three protected), `middleware/security.ts`, `frontend/**`, `admin/**`.
- Scope note: full maker-auth design is owner gate 12 (`queue.json:150`); the plan below splits
  "interim, no new auth system" from "when maker-auth ships".

### Candidate options for the lock-down (plan only — nothing implemented)

1. **Interim signed-edit token (no accounts):** `POST /submit` mints an edit token with the existing
   `crypto.randomBytes(16)` pattern (`claim.ts:152-153`), stores `editTokenHash` + `editTokenExpiresAt`
   on the submission doc, returns the token once; `PATCH /submissions/:slug` requires it (timing-safe
   compare via `timingSafeEqualHex` logic) and 401s otherwise. Zero callers → no UI to update;
   frontend would store it in `localStorage` when an edit UI eventually ships. Add a TTL so abandoned
   queued rows stop being editable.
2. **Ownership by `makerHandle` + verified claim:** require the handle on the doc to have an
   `approved` claim (`claims` collection, `claim.ts:27,226-244`) and a session/proof binding requester →
   handle. Reuses existing data, but needs *some* session primitive (option 3 or 4) to be non-spoofable.
3. **Maker session via JWT cookie cloned from the admin pattern** (`admin.ts:99-168` → new
   `makerToken` cookie + `verifyMakerToken` middleware in an owned file). Cleanest fit with repo
   conventions; requires the maker-auth feature that is owner-gated (gate 12).
4. **Redis session** using the existing unused `sessionSet/sessionGet` (`redis.ts:191-216`) —
   server-side revocable sessions; same gate-12 dependency, plus Redis required (in-memory fallback
   would not survive multi-instance deploys).
5. **Interim belt-and-braces while 1–4 are pending:** keep `status==='queued'` check (`:269-271`),
   require header token, log `ip` (`getClientAddress`) on every accepted PATCH, and consider removing
   `PATCH` from CORS `allowMethods` (`index.ts:66`) if no cross-origin caller exists (none does).

Not evaluated as a fix: disabling the endpoint outright — safe from a caller standpoint (zero callers)
but it removes the documented "frictionless alpha submit" editing the TODO intentionally keeps open
until maker-auth ships (`submit.ts:36-38`); owner's call.

---

## Verification / caveats

- All file:line references read directly from the worktree in this session (read-only tools).
- Web claims limited to razorpay.com docs pages cited above; the docs show order notes on the
  **order** entity in `order.paid` and an (often empty) **payment**-level `notes` on `payment.captured`;
  no official doc states order→payment notes propagation, so the report treats it as *not guaranteed*.
- "Zero callers" = exhaustive content searches over `frontend/`, `admin/`, `docs/`, `scripts/` for
  `PATCH`, `.patch(`, `axios`, `api/submissions`, `submissions/`; no build/test was run (disallowed).
