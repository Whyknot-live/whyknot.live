# P1 payments — local test log (2026-09-09)

No Render deploy (owner deferred). All tests below run locally against Razorpay **Test mode**.
Docs sources: razorpay.com/docs — Test and Live Modes, API Keys, Node.js Integration Steps,
Set Up and Edit Payments Webhooks, Validate and Test Webhooks, Best Practices, About Webhooks,
IPs and Certificates.

## Test-mode credentials in use
- Key/secrets: local `backend/.env` only (gitignored). Test key `rzp_test_…` + test secret.
- Dashboard toggle: TEST. Test-mode OTP for webhook create/edit/delete: `754081`.
- Webhook (test mode, Enabled, 7 events): staging URL on Render dashboard.
  Localhost cannot receive webhooks (docs: public HTTPS 80/443 only; `localhost`,
  `ngrok.io`, `webhook.site`, `requestbin.com` etc blacklisted; use `zrok` or staging).

## What passed locally
1. `backend bun run typecheck` — clean. `bun test src/tests/` — 7 pass (3 waitlist + 4 Razorpay HMAC).
2. `GET /api/payments/config` (local :9000, no DB) — `configured:true`, `INR`, `99900`, pro/team unconfigured. Correct.
3. Razorpay Orders API with test keys — real test order created: amount `99900 INR`, status `created`.
   Proves key/secret pair is valid in test mode.
4. `POST /api/payments/verify` with bad signature — `invalid_signature`, no DB touch. HMAC path correct.
5. Webhook/order HMAC simulation (real secrets, sample payload) —
   `webhookValid:true`, `webhookTampered:false`, `orderValid:true`.
   Implementation matches docs: raw-body HMAC-SHA256, `X-Razorpay-Signature`,
   dedupe on `X-Razorpay-Event-Id`, grant only on `payment.captured`/`order.paid`
   (`payment.authorized` log-only, out-of-order safe), 2xx-in-5s handler.
6. `frontend tsc --noEmit` clean, `lint` + token-guard OK, `astro build` 65 pages incl `dist/payment/success|failure`.
   (`astro check` fails on language-server `fileExists` — pre-existing, path-with-spaces tooling bug.)

## Blocked locally (needs Render, not code)
- `POST /api/payments/create-order`, `/status`, `/webhook` full path need Mongo; local Atlas
  connection hangs (no error yet, 21s+ serverSelection retries — likely Atlas IP whitelist
  allows Render only). Render backend has Atlas access, so these pass after deploy.
- Test webhook currently points at Render URL running **old** code → expect `404` deliveries
  until new code deploys. Dashboard shows failures/retries (24h backoff, then disabled + alert email).
- Browser Checkout (test UPI `success@razorpay` / `failure@razorpay`, card `4100280000001007`,
  any future expiry) needs deployed backend + frontend pair. Not run locally.

## Deploy checklist (when owner approves)
1. Render env: `RAZORPAY_KEY_ID/SECRET` (test), `RAZORPAY_WEBHOOK_SECRET` (same as dashboard),
   `RAZORPAY_CURRENCY=INR`, plans empty.
2. Push payments code, wait for build, then `GET /api/payments/config` → `configured:true` (not 404).
3. Dashboard → Webhooks → test deliveries `2xx`. Run ₹999 test payment → `/api/payments/status` → `active`.
4. Create Plans (Dashboard → Subscriptions → Plans, monthly INR) → fill `PLAN_PRO/TEAM_ID` → test sub.

## Live cutover (per docs, later)
- Activate account + verify website (up to 3 working days) → generate **separate** live keys
  (one set per MID; only Key Id stays visible) → swap Render env test→live.
- Add **second** webhook in Live mode (test and live webhooks are separate) with a **new**
  webhook secret (≠ API secret). Enable auto-capture (uncaptured auto-refunds; deliver only on captured).
- Replace test keys in Checkout code path (ours reads `keyId` from backend config — no frontend change needed).

## Handoff: next P1 slice
Payments rails are code-complete pending deploy. Unblocks `submit-flow.md` paid-skip SKU
(one-time order reuse + refund-on-reject) and `sponsored-slots.md` booking (same rails).
Suggested next: `submit-flow` Step 1 scrape-preview + Step 2 form (no payments needed),
then wire paid-skip once backend is deployed. Pro/Team + newsletter sponsor slot wait on plan IDs.
Badges stay frozen at 6 states (C4).
