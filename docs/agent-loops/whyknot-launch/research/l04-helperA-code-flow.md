# L04 helperA — WhyKnot maker-claim flow, end to end (read-only code research)

Worktree: `/Users/jay/Development/Projects/.agent-worktrees/whyknot/whyknot-launch`
Branch: `agent/whyknot-launch` (confirmed `git branch --show-current`).
Scope: read-only. Every claim below carries a `file:line` read this run. Anything not directly
confirmed is prefixed `UNVERIFIED:`.

Verdict summary: the claim flow is **real end to end for start → check → status → admin
approve/reject**, but the **owner email is never sent** (TODO), **nothing propagates an approved
claim onto the maker profile**, and the spec's **maker dashboard + claim-rate/edit-frequency
metrics do not exist**.

---

## 1. The real user flow, screen by screen

### 1a. Entry points (who links to the claim flow)

| Surface | file:line | What it does |
|---|---|---|
| `/maker/claim` page | `frontend/src/pages/maker/claim/index.astro:24` | Renders `<ClaimForm initialHandle={handle} />`; `handle` read from `?handle=` at `:12` |
| Maker profile page | `frontend/src/pages/maker/[handle].astro:40-42` | Shows `Editor-maintained · <a href="/maker/claim?handle=...">Claim this profile</a>` when `editorMaintained !== false` |
| `/verify` page | `frontend/src/pages/verify/index.astro:83,86` | CTA link + note "Maker claims reuse these three methods plus an owner email, with manual review within 48 hours." |
| Payment success | `frontend/src/pages/payment/success.astro:21` | Card link to `/maker/claim` |
| Sitemap | `frontend/src/pages/sitemap.xml.ts:33` | Lists `/maker/claim` |

### 1b. The 4-step form (frontend, one page — `frontend/src/components/ClaimForm.astro`)

- **Step 1 — Profile** (`:27-41`): `makerHandle` (`:31`), `domain` (`:35`). Continue validates both non-empty client-side (`:230-233`).
- **Step 2 — Method** (`:44-105`): tabs + radio group, three options `dns`/`file`/`meta` (`:46-63`); panels show the DNS TXT / file-path / meta-tag instructions with `YOUR_TOKEN` placeholders (`:64-100`).
- **Step 3 — Owner email** (`:108-119`): `ownerEmail` field (`:112`); note says "We send the token and review updates here" (`:113`) and "Reviews are manual (expect a reply within 48 hours)."
- **Step 4 — Verify** (`:122-135`): shows the token (`:124`) + per-method instruction (`:126-128`) and a **Verify now** button (`:132`).
- Client script: `submit` handler (`:288-322`) POSTs `/api/claim/start`; on success stores `claimId`, calls `renderToken(data.token)` (`:313`), advances to step 4, shows success "Token issued…" (`:315`). The **token is rendered in the page from the HTTP response**, not from email.
- **Verify now** handler (`:324-352`) POSTs `/api/claim/check` with `{claimId}` (`:330-334`); on `data.verified` shows "…now in the manual review queue (within 48 hours)" and calls `pollStatus()` (`:341-342`); else shows the `detail` reason (`:344`).
- `pollStatus()` (`:354-372`) GETs `/api/claim/status?makerHandle=` and flips the success/error copy on `approved`/`rejected`.

### 1c. Live status component (`frontend/src/components/ClaimStatus.astro`)

- Polls `GET /api/claim/status?makerHandle=` (`:123`), default `pollMs=15000` (`:15`), maps claim status → **existing 6 VerifyBadge states only** (`claimToBadge` `:54-60`, `claimLabel` `:62-69`). `pending`/`verified`→`pending`, `approved`→`verified`, `rejected`→`failed`, `failed`→`failed`, none→`unverified`.
- **Who renders it:** grep `ClaimStatus` across `frontend/src` + `admin/src` returns only its own file — **the component is defined but never imported/rendered by any page**. (UNVERIFIED: whether it is intended for a not-yet-built maker dashboard; no consumer found.)

### 1d. Backend API (`backend/src/routes/claim.ts`, mounted at `/api` via `backend/src/index.ts:13,82`)

- **`POST /api/claim/start`** `:130` → 201 `{ok, claimId, token, method, domain, status:'pending', expected, filePath}` (`:188-200`).
- **`POST /api/claim/check`** `:204` → `{ok, verified, status, detail}` (`:244`).
- **`GET /api/claim/status`** `:249` → `{ok, claim:{claimId,makerHandle,domain,method,status,updatedAt,checks}}` (`:271-282`); **never returns token or ownerEmail** (`:248` comment).

### 1e. Admin manual review (`backend/src/routes/admin.ts`, mounted `index.ts:82`)

- **`GET /api/admin/claims`** `:385` (`verifyAdminToken`) — list with `page/limit/search/method/status`, or `?stats=1` (`:396-408`) → `{pending, approved, medianReviewTimeMs}`.
- **`POST /api/admin/claims/:id`** `:422` (`verifyAdminToken`) — body `{decision:'approved'|'rejected', note?}` (`:427`); updates only a `status:'pending'` row (`:429-432`).
- Admin UI: `admin/src/pages/claims.astro` — stats `:170-186`, list `:188-275`, approve/reject buttons `:248-262`, `decideClaim()` POST `:277-296`. API base resolved `admin/src/layouts/AdminLayout.astro:70-79` (local `http://localhost:9000/api` :73, prod `https://api.whyknot.live/api` :79); `window.adminAPI.fetch` `:122-138`.

---

## 2. Code facts with file:line

### 2a. `backend/src/routes/claim.ts`

| Fact | Line |
|---|---|
| `MAKER_HANDLE_RE = /^[A-Za-z0-9_-]{1,64}$/` | `:23` |
| `CLAIM_ID_RE = /^[0-9a-f]{24}$/` | `:24` |
| `EMAIL_MAX_LENGTH = 254` | `:25` |
| `ClaimStatus = 'pending'|'verified'|'failed'|'approved'|'rejected'` | `:27` |
| `ClaimDoc` fields: claimId, makerHandle, domain, method, ownerEmail, token, status, `checkLog[]{at,ok,detail}`, createdAt, updatedAt, reviewedAt? | `:29-41` |
| `startSchema` (handle/domain/method/ownerEmail) | `:43-48` |
| `checkSchema` (`claimId` regex) | `:50-52` |
| In-memory rate limit: `WINDOW=60_000`, `MAX_PER_WINDOW=10`, `MAX_TRACKED_IPS=1000` | `:57-59` |
| `bodyLimit 16KB` on all claim routes | `:61` |
| `enforceRateLimit` (Redis if `USE_REDIS_RATE_LIMIT==='1'`, else in-memory, key `claim:${ip}`) | `:82-127` |
| start: rate limit → parse → `normalizeDomain`+`DOMAIN_RE` → `isBlockedHostname` → connect → insert | `:131-175` |
| `claimId = randomBytes(12).hex` (24 hex); `token = randomBytes(16).hex` (32 hex) | `:152-153` |
| `insertOne(doc)` with `status:'pending'` | `:169` |
| **Email TODO** `sendClaimVerificationEmail(...)` not called | `:184-186` |
| Token **returned to client** in response | `:192` |
| check: `findOne({claimId})`; 404 if missing | `:218-221` |
| check: short-circuit on `approved`/`rejected` | `:222-224` |
| check: `runCheck` → `verified`/`failed`; `updateOne` `$set` status + `$push` checkLog | `:226-236` |
| status: latest by `makerHandle` sorted `createdAt:-1` limit 1 | `:259-264` |
| status: returns `checks: claim.checkLog.length` only | `:280` |

### 2b. `backend/src/utils/verify-checks.ts`

| Fact | Line |
|---|---|
| `ClaimMethod = 'dns'|'file'|'meta'`; `CLAIM_METHODS` | `:12-14` |
| `VERIFY_TOKEN_RE = /^[0-9a-f]{32}$/` | `:17` |
| `DOMAIN_RE` (requires ≥1 dot, TLD ≥2) | `:20` |
| `FETCH_TIMEOUT_MS=5000`, `MAX_BODY_BYTES=1MB`, UA `whyknot-verify/1.0` | `:22-24` |
| `normalizeDomain` (strip scheme/path/query/port/userinfo) | `:33-53` |
| `buildExpectedValue` → `whyknot-verify=${token}` | `:56-58` |
| `verificationFilePath` → `/whyknot-verify-${token}.html` | `:61-63` |
| `matchFileBody` (substring) | `:66-68` |
| `matchMetaHtml` (regex both attr orders, case-insensitive) | `:79-90` |
| `isPrivateIpv4` / `isPrivateIpv6` / `isPrivateIp` | `:93-124` |
| `isBlockedHostname` (localhost, IP literals) | `:130-139` |
| `assertPublicHostname` (DNS `lookup all` → reject if ANY private; throws `blocked_target`) | `:145-161` |
| `withTimeout` 5s | `:171-179` |
| `checkDnsTxt` (exact TXT match) | `:182-201` |
| `checkFile` (redirect:'manual', SSRF guard, exact path) | `:204-240` |
| `checkMeta` (homepage, 1MB cap) | `:243-279` |
| `runCheck` dispatch | `:282-297` |

### 2c. `backend/src/tests/claim.test.ts`

- Imports **only** from `'../utils/verify-checks'` (`:4-16`): `CLAIM_METHODS, DOMAIN_RE, VERIFY_TOKEN_RE, buildExpectedValue, isBlockedHostname, isPrivateIp, isPrivateIpv4, matchFileBody, matchMetaHtml, normalizeDomain, verificationFilePath`. Plus `node:test`, `node:assert`, `zod` (`:1-3`).
- **It does NOT import `routes/claim.ts`, does not import `routes/admin.ts`, and constructs no Hono app.** No `app.request`/`fetch`/route call appears in the file (grep for `app.`/`new Hono`/`request(`/`fetch(`/`app.request` returns only incidental matches in domain-string literals at `:42,47,74,93`).
- Coverage: token format (`:20-32`), domain normalize (`:34-52`), method enum (`:54-68`), SSRF guard (`:70-96`), file matcher (`:98-113`), meta matcher (`:115-138`). **All pure helpers.**

### 2d. Route-level integration tests for `/claim/*`

- **None exist.** `grep -rn "claim/start|claim/check|claim/status|/api/claim|claimRouter|routes/claim" backend/src/tests/` returns exactly one hit — the TODO comment string inside `backend/src/routes/claim.ts:185`, not a test.
- `backend/src/tests/` contains only `claim.test.ts, launch-events.test.ts, newsletter.test.ts, payments.test.ts, schema.test.ts, screener.test.ts, sponsor.test.ts, submit.test.ts` (dir listing). There is **no `admin.test.ts`**.
- Only `newsletter.test.ts`, `sponsor.test.ts`, `payments.test.ts` import anything from `routes/` (grep `routes/` over `backend/src/tests/`). Claim routes are untested at the HTTP layer.

### 2e. MongoDB `claims` collection — all readers/writers

| File:line | Op | Fields |
|---|---|---|
| `backend/src/utils/mongo.ts:96-99` | index `{claimId:1}` unique | — |
| `backend/src/utils/mongo.ts:100-103` | index `{makerHandle:1, createdAt:-1}` | — |
| `backend/src/utils/mongo.ts:104-107` | index `{status:1, createdAt:-1}` | — |
| `backend/src/routes/claim.ts:169` | **insert** | full `ClaimDoc` (`:155-166`) |
| `backend/src/routes/claim.ts:218` | read | `findOne({claimId})` |
| `backend/src/routes/claim.ts:230-236` | **update** | `$set{status,updatedAt}` + `$push{checkLog}` |
| `backend/src/routes/claim.ts:259-264` | read | latest by `makerHandle` |
| `backend/src/routes/admin.ts:398` | read | `countDocuments({status:'pending'})` |
| `backend/src/routes/admin.ts:399` | read | `countDocuments({status:'approved'})` |
| `backend/src/routes/admin.ts:400` | read | `find({reviewedAt exists, createdAt exists}).project({createdAt,reviewedAt})` |
| `backend/src/routes/admin.ts:413-414` | read | `countDocuments` + `find(filter).sort(createdAt:-1)` |
| `backend/src/routes/admin.ts:429-432` | **update** | `{claimId,status:'pending'}` → `$set{status, reviewerNote, reviewedAt}` |

No writer of `reviewedAt` other than `admin.ts:431`. No writer/reader of `token` outside `claim.ts` (token is written at insert and read only for `runCheck` at `:226`).

### 2f. Status transition map

- `pending` → `verified` / `failed`: `claim.ts:227` (check result).
- `pending` → `approved` / `rejected`: `admin.ts:429-432` (guarded by `status:'pending'` filter).
- `approved`/`rejected`: terminal in check (`claim.ts:222-224` returns early).
- **`verified` ⇄ `failed` can flip freely** on repeat `/check` (only `approved`/`rejected` short-circuit) — no transition guard.
- No code path writes `verified`→`approved` automatically; approval is manual only.

---

## 3. Who writes / reads each piece of data

- **`token`**: written `claim.ts:153,161,169`; returned to client `claim.ts:192`; read only by `runCheck` `claim.ts:226`. Never in `/status` (`:271-282`). Never emailed.
- **`ownerEmail`**: written `claim.ts:160`; read only by admin list (`admin.ts:414` returns whole doc) and rendered `admin/src/pages/claims.astro:237`. **Never sent to.**
- **`claimId`**: written `claim.ts:152`; returned `:191`; the sole credential for `/check` (`:218`); surfaced in `/status` `:274` and admin actions `claims.astro:254,260`.
- **`makerHandle`**: written `claim.ts:157`; keyed by `/status` `:261` and admin search `admin.ts:410`.
- **`checkLog`**: appended only `claim.ts:234`; count read `/status` `:280` and admin `claims.astro:243`.
- **`reviewedAt`/`reviewerNote`**: written only `admin.ts:431`; `reviewedAt` read for median `admin.ts:400-406`.
- **`status`**: written `claim.ts:233`, `admin.ts:431`; read everywhere.
- **Frontend `claimStatus` field** (`content.config.ts:74`, enum `unclaimed|pending|claimed`): **written by nothing, read by nothing** (grep `claimStatus` = only the schema line). Dead schema.
- **`editorMaintained`** (`content.config.ts:76`, default true): read `maker/[handle].astro:40`; never written by claim code.

---

## 4. Decision points a guard must cover

1. **Input validation** — `startSchema` `claim.ts:43-48` (handle regex, domain ≤253, method enum, email ≤254); `checkSchema` `:50-52`; `/status` handle regex `:251`; body cap 16KB `:61`.
2. **Rate limiting** — per-route `enforceRateLimit` 10/min/IP `claim.ts:82-127`; global `rateLimitMiddleware` 100/min `index.ts:69` (`middleware/security.ts:77-...`); IP resolution `utils/request.ts:34-52` (forwarded headers only if `TRUST_PROXY_FORWARDED==='1'`, else `'shared'` fallback).
3. **SSRF / private-IP** — `isBlockedHostname` at start `claim.ts:145`; DNS/file/meta guards `verify-checks.ts:187,213,252`; `assertPublicHostname` resolves and rejects any private address `:145-161`. **Residual gap:** the fetch re-resolves the hostname after the guard (TOCTOU / DNS-rebinding) — no IP pinning on the outbound request.
4. **Token exposure** — token in `/start` response body `claim.ts:192` (and page DOM `ClaimForm.astro:124,200-203`); excluded from `/status` `:271-282`. `/check` trusts `claimId` alone with no ownership/auth proof (`:204-218`).
5. **Status transitions** — no guard on `verified⇄failed` flips; admin update correctly restricted to `pending` `admin.ts:430`.
6. **Who can approve/reject** — only `verifyAdminToken` `admin.ts:131-157` (HttpOnly `adminToken` cookie, JWT `sub==='admin'`, exp check). Single admin role; no per-claim scoping, no audit of reviewer identity.
7. **Email send** — **not implemented.** Only `sendWaitlistWelcomeEmail`/`sendWelcomeEmailIfEnabled` exist (`utils/email.ts:12,77`); no claim template (`templates/` = email-preview.html, newsletter-531.ts, waitlist-welcome.ts). `claim.ts:184-186` is a TODO; no approve/reject notification either.

---

## 5. Spec vs code — `docs/roadmap/features/maker-claim.md`

| Spec line | Status | Evidence / search that proves absence |
|---|---|---|
| `:16` "same 3 methods as verify (DNS TXT / file / meta) + owner email" | **3 methods BUILT; owner email captured but NOT sent** | methods `verify-checks.ts:182-279`; email field `claim.ts:47,160`; send TODO `claim.ts:184-186`; grep `sendClaimVerificationEmail` = 1 hit (the TODO itself) |
| `:17` "Manual review queue with SLA published (e.g. 48h)" | **queue BUILT; SLA published as copy only; no enforcement/escalation** | queue `admin.ts:385,422`; SLA copy `claims.astro:27`, `maker/claim/index.astro:30`, `ClaimForm.astro:341`; no cron/worker for claims (`backend/src/jobs/` contains only `send-newsletter.ts`) |
| `:18` "Dashboard: edit listing, view clicks/UTM, unanswered comments, invoices" | **NOT IMPLEMENTED (every sub-item)** | `find frontend/src/pages/maker` = only `claim/index.astro`, `[handle].astro`; no maker dashboard page; grep `edit listing|editListing` = 0; grep `utm` in frontend/src = only unrelated `ClaimForm`/`CheckoutButton` string matches; grep `invoice` in frontend/src/admin/src/backend/src = payment/sponsor copy only (`payment/success.astro:14`, `sponsor/index.astro:41,144`), no maker invoices surface; `unansweredCount` helper exists (`frontend/src/lib/launch-events.ts:141`) but no maker dashboard consumes it |
| `:21` "Metrics: Claim rate · median review time · edit frequency" | **median review time BUILT; claim rate NOT; edit frequency NOT** | median `admin.ts:400-406` → `claims.astro:178`; grep `claim.rate|claim_rate|claimRate|edit.frequency|editFrequency` across frontend/src, admin/src, backend/src, docs = only the spec line itself |
| `:24` "Claim completes without staff code changes" | **partly** — admin decision endpoint exists so approval needs no code change; but **no propagation** to profile | `admin.ts:422`; no writer of `maker.verified`/`claimStatus` after approval (grep `claimStatus` = schema only; `maker/[handle].astro:39` reads static `maker.verified`) |
| `:25` "Unclaimed profiles clearly marked as editor-maintained" | **BUILT** | `content.config.ts:76` default true; `maker/[handle].astro:40-42` renders "Editor-maintained · Claim this profile" |
| `:11-13` "Research before build" checkboxes | docs only, not verifiable from code | — |
| `:28` open question "Review SLA promise? (suggest 48h)" | copy says 48h but no staffing/mechanism | `claim/index.astro:30`, `claims.astro:27` |

### Additional gaps found in code (not spec lines)

- **No propagation / grant:** approved claim never sets `maker.verified` or `claimStatus`; the badge-grant path is absent (also flagged in `l00-truth-table.md:29`).
- **No email / resend:** token only in the HTTP response; a lost token is unrecoverable (no resend endpoint).
- **No route-level tests:** see §2c–2d.
- **Stale comment:** `admin/src/pages/claims.astro:5-8` says the admin endpoints "do not exist yet"; they DO exist (`admin.ts:385,422`). Comment is stale.
- **No dedupe:** multiple claims per `makerHandle` allowed; `/status` returns only the latest (`claim.ts:259-264`).
- **`checkLog` unbounded** — appended every `/check`, no cap/trim (`claim.ts:234`).
- **UNVERIFIED:** whether `/claims` is reachable from an admin nav menu — no nav markup with claim links found in `AdminLayout.astro` (only font/logo links at `:19-30`); page reachable by direct URL only, as far as this read shows.

---

## 6. Direct answers to the two explicit questions

1. **Does `claim.test.ts` test the routes or only the pure helpers?** Only the pure helpers. It imports exclusively from `../utils/verify-checks` (`claim.test.ts:4-16`) — no `routes/claim`, no `routes/admin`, no Hono app. Every assertion targets `normalizeDomain`, `DOMAIN_RE`, `VERIFY_TOKEN_RE`, `matchFileBody`, `matchMetaHtml`, `isBlockedHostname`, `isPrivateIp*`, `buildExpectedValue`, `verificationFilePath`.
2. **Any route-level integration tests for `/claim/start`, `/claim/check`, `/claim/status` in `backend/src/tests/`?** No. The only grep hit for those paths in `backend/src/tests/` is the TODO comment text in `routes/claim.ts:185`; `backend/src/tests/` has no claim route test and no `admin.test.ts`.

---

## 7. Could-not-verify (read-only limits)

- Did not open any `.env`/env file; env-gated behavior (`USE_REDIS_RATE_LIMIT`, `ENABLE_EMAIL`, `RESEND_API_KEY`, `CORS_ORIGIN`, `TRUST_PROXY_FORWARDED`) is read from source only.
- No builds/tests/installs run; verdicts are from source reads.
- UNVERIFIED: runtime behavior of Redis vs in-memory limiter under load; whether any external process writes `maker.verified`/`claimStatus` (no such writer found in-repo).
