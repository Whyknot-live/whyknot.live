# API Documentation

Reference for the WhyKnot.live backend: `https://api.whyknot.live`.

Rewritten on 2026-10-21 from the source. The previous version documented only the waitlist
endpoint, from before the platform expansion.

## Base URLs

| Environment | URL |
|---|---|
| Production | `https://api.whyknot.live` |
| Local | `http://localhost:9000` (the `PORT` in `backend/.env`) |

The public site and the admin dashboard call the production URL. The admin build bakes in
`PUBLIC_API_URL=https://api.whyknot.live/api`; the public build bakes in
`PUBLIC_API_BASE_URL=https://api.whyknot.live`. Both are build-time values on Render, not files
in the repository.

## Authentication

Three models, in the order they matter:

| Area | Model |
|---|---|
| `/api/admin/*` | HttpOnly cookie `adminToken`, a JWT signed with `ADMIN_JWT_SECRET`, subject `admin`. `POST /api/admin/login` sets it. |
| `PATCH /api/submissions/:slug` | `Authorization: Bearer <maker session>`. The session is minted at submit time, is scoped to one listing (slug + maker handle), and carries its own audience claim, so an admin token can never be replayed as a maker token. |
| `POST /api/payments/webhook` | Razorpay signature in `x-razorpay-signature`, verified against `RAZORPAY_WEBHOOK_SECRET`. Outside development the webhook **fails closed** when the secret is unset. |

Everything else is public by design: the library, the screener, availability, claim status.

## Rate limiting

- **Global**: 100 requests per minute per IP on `/api/*`, in-memory unless `REDIS_URL` and
  `USE_REDIS_RATE_LIMIT=1` are set (then it is shared across instances).
- **Per route**: tighter windows on the routes that cost money or send mail — submit, claim,
  newsletter subscribe, sponsor event (30/min), admin login (5 per 15 minutes).
- Redis failures never block a request: the limiter logs and falls back to memory.

Headers on every limited response:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1698765432
```

Over the limit: `429` with `{"error":"rate_limited"}`.

## Response formats

Success returns the resource itself. Errors return a machine-readable code and nothing else:

```json
{ "error": "error_code" }
```

Internal failures are logged in full server-side and returned as `{"error":"server_error"}`.

### Error codes

| Code | Status | Meaning |
|---|---|---|
| `invalid_request` | 400 | Body failed validation (`details` carries the Zod issues) |
| `invalid_json` | 400 | Body was not JSON |
| `invalid_email` | 400 | Email format |
| `invalid_url` | 400 | URL could not be normalised, or points at a private host |
| `invalid_domain` | 400 | Domain malformed |
| `blocked_domain`, `blocked_host` | 400 | Host is not eligible |
| `invalid_handle` | 400 | Maker handle format |
| `invalid_date` | 400 | Date outside the allowed window |
| `invalid_claim_id` | 400 | Claim id malformed |
| `invalid_credentials` | 401 | Admin login failed |
| `unauthorized` | 401 | Missing or invalid credentials |
| `missing_token`, `invalid_token`, `token_expired` | 401 | Token problem |
| `forbidden` | 403 | Authenticated, but not the owner of this resource |
| `not_found`, `claim_not_found` | 404 | No such resource |
| `invalid_signature` | 400 | Razorpay signature mismatch |
| `webhook_not_configured` | 503 | `RAZORPAY_WEBHOOK_SECRET` missing outside development |
| `already_exists`, `already_submitted` | 409 | Duplicate |
| `slot_taken` | 409 | That sponsored date is sold |
| `slot_pending` | 409 | A checkout for that date is in flight (15 minute hold) |
| `locked` | 409 | The submission has left the queue; edits are closed |
| `amount_mismatch` | 400 | Paid amount does not match the order |
| `payments_not_configured` | 503 | Razorpay keys are not on the service |
| `subscription_plan_not_configured` | 503 | Subscription plans are not on the service |
| `no_slots` | 503 | No free launch day in the window |
| `scan_failed` | 502 | The screener could not read the site |
| `timeout`, `unreachable`, `dns_unreachable`, `http_error`, `not_html` | 502/504 | The site could not be fetched |
| `rate_limited` | 429 | Too many requests |
| `server_error` | 500 | Something broke. The detail is in the log, never in the response |

## Endpoints

### Health

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Mongo and Redis status. Public, not rate limited. |
| `GET` | `/` | Service name and version. |

### The loop (waitlist)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/waitlist` | Email signup, with interests. The form carries a honeypot field; the per-IP rate limit is what actually protects the endpoint. |

### Submit

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/submit` | - | Queues a listing, auto-assigns the next free launch day. Returns `{slug, slotDate, url, editToken}`. `editToken` is the maker's session for editing that listing. |
| `GET` | `/api/submissions/:slug` | - | The public view of a listing. With a valid maker session it also returns `story` (only to the owner). |
| `PATCH` | `/api/submissions/:slug` | maker session | Edits name, tagline, topics, story. `401` without a session, `403` for someone else's listing, `409` once the listing has left the queue. |

### Maker claim (DNS proof of ownership)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/claim/start` | Opens a claim, mints a verification token, returns the DNS/file value to publish. |
| `POST` | `/api/claim/check` | Runs the live check (DNS TXT, file, meta tag). |
| `GET` | `/api/claim/status?makerHandle=` | Latest claim state for a profile. Never returns the token or the owner email. |

### Payments (Razorpay, INR only)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/payments/config` | - | Key id and plan state. Never the secret. |
| `POST` | `/api/payments/create-order` | - | One-time order. |
| `POST` | `/api/payments/create-subscription` | - | Pro or Team subscription. |
| `POST` | `/api/payments/verify` | - | Verifies the payment signature and grants the entitlement. |
| `GET` | `/api/payments/status` | - | Entitlement status for a payment. |
| `POST` | `/api/payments/webhook` | Razorpay signature | Grants entitlements and flips sponsored slot orders to paid. Idempotent: the event id is the dedupe key, and a failed effect clears it so Razorpay can retry. |

### Sponsored slots

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/sponsor/availability` | - | 30 days. A date is unavailable if it is sold or held by a checkout in flight. |
| `GET` | `/api/sponsor/boost` | - | The active boost campaign for a date. Public, tiny, no PII. |
| `POST` | `/api/sponsor/order` | - | Starts a booking. `409 slot_taken` / `409 slot_pending` when the date is gone or in flight. |
| `POST` | `/api/sponsor/event` | - | Impression/click beacon for CTR. Slot id and event kind only, server timestamp. |
| `GET` | `/api/sponsor/metrics` | admin | Lifetime revenue, occupancy, CTR, conflicts. **Admin only** — it returns revenue, so it 401s before any env or database read. |

### Screener

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/screener/scan` | Runs a site audit, returns a scan id. |
| `GET` | `/api/screener/report/:id` | The audit for a scan. |
| `GET` | `/api/screener/domain/:domain` | The latest audit for a domain. |

### Newsletter

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/newsletter/subscribe` | Double opt-in: sends a confirmation link. |
| `GET` | `/api/newsletter/confirm` | Confirms the subscription. |
| `GET` | `/api/newsletter/unsubscribe` | Per-recipient HMAC link, no login. |
| `GET` | `/api/newsletter/issues` | The published issues. |

### Admin

Every route below needs the `adminToken` cookie, except `login` and `check`.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/admin/login` | Password + pepper, sets the HttpOnly cookie. 5 attempts per 15 minutes. |
| `GET` | `/api/admin/check` | Auth state, for the login page. |
| `POST` | `/api/admin/logout` | Clears the cookie. |
| `GET` | `/api/admin/verify` | Token still valid. |
| `GET` | `/api/admin/waitlist` | The loop list. |
| `GET` | `/api/admin/stats` | Counts and totals. |
| `GET` | `/api/admin/claims` | Maker-claim review queue. |
| `POST` | `/api/admin/claims/:id` | Approve or reject a claim. |
| `GET` | `/api/admin/submissions` | Submission review queue. |
| `POST` | `/api/admin/submissions/:slug` | Approve, request changes, or reject. |
| `POST` | `/api/admin/newsletter/preview` | Renders an issue without sending it. |
| `POST` | `/api/admin/newsletter/send` | Sends an issue. |

### Misc

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/scrape-preview` | Title, description and stack hints for a URL, for the submit form. |
| `GET` | `/api/slots/availability` | Launch-day capacity for the submit picker. |

## Data models

```typescript
interface Submission {
    slug: string;          // permanent, never changes after submit
    url: string;
    urlNormalized: string; // unique: one submission per site
    name: string;
    tagline: string;
    topics: string[];
    makerHandle: string;
    story: string;
    status: 'queued' | 'approved' | 'rejected' | ...;
    slotDate: string;      // YYYY-MM-DD, the assigned launch day
    createdAt: Date;
    updatedAt: Date;
}

interface SlotOrder {
    orderId: string;       // Razorpay order id
    email: string;
    slot: 'launch-boost' | 'newsletter';
    date: string;          // YYYY-MM-DD
    url: string;
    amount: number;        // paise
    currency: string;
    status: 'created' | 'paid' | 'conflict';
    createdAt: Date;
    paidAt?: Date;
    conflictAt?: Date;     // paid, but the date was taken first
}
```

**Indexes** (created on boot, `backend/src/utils/mongo.ts`): `submissions.urlNormalized` and
`submissions.slug` are unique. `slot_orders` is unique on `{slot, date}` **for paid orders only**
— a partial index — so an abandoned checkout never blocks a date.

## Security

- **SSRF guard** — every fetch of a user-supplied URL refuses loopback, link-local and private
  addresses, and refuses non-HTML responses.
- **CORS** — the origins in `CORS_ORIGIN` only, credentials allowed, `PATCH` included. The
  allowlist must carry `https://admin.whyknot.live`: the admin dashboard is on another host.
- **Security headers** — set on every response (`backend/src/middleware/security.ts`).
- **Input validation** — Zod on every body, query and parameter. Unknown fields are stripped.
- **Generic errors** — the client never learns why the server failed; the log does.
- **Honeypot** — the waitlist form carries a hidden field that a bot fills and a human never
  sees. The trap is client-side; the rate limit is what actually protects the endpoint.

## Versioning

No version prefix yet: the API lives under `/api/`. If a breaking change ever needs one, it goes
to `/api/v2/` and the old prefix keeps running for six months.

## Support

- [GitHub Discussions](https://github.com/Whyknot-live/whyknot.live/discussions)
- [Contact form](https://www.whyknot.live/contact)

---

Last Updated: October 21, 2026
