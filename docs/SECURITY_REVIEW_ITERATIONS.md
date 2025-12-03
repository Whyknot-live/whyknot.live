# Security Review (10 Iterative Passes)

## Summary of Confirmed Findings
| ID | Severity | Area | Finding | Evidence |
| --- | --- | --- | --- | --- |
| F-01 | High | API rate limiting | Rate limiting trusts spoofable IP headers, allowing bypass and shared-bucket abuse | backend/src/routes/waitlist.ts, backend/src/middleware/security.ts, backend/src/routes/admin.ts |
| F-02 | High | API rate limiting | In-memory fallback keeps unbounded per-IP history, enabling memory exhaustion via crafted headers | backend/src/routes/waitlist.ts |
| F-03 | Medium | API payload handling | Waitlist endpoint accepts unlimited payload/body size and unbounded interest arrays | backend/src/routes/waitlist.ts |
| F-04 | High | Frontend rendering | Blog related-posts rendering injects unsanitized API data via innerHTML, enabling stored XSS | frontend/src/pages/blog/[slug].astro, frontend/src/pages/blog/[...slug].astro |
| F-05 | Medium | Transport configuration | Admin and waitlist clients fall back to http://localhost API URLs, risking plaintext auth if env mis-set | admin/src/layouts/AdminLayout.astro, frontend/src/components/Waitlist.astro |
| F-06 | Low | Authentication | Admin password comparison uses direct string equality, exposing a theoretical timing side-channel | backend/src/routes/admin.ts |

## Pass 1 – Surface Mapping & Threat Model
- Enumerated externally reachable paths under `/api/*`, the root health checks, and static Astro frontends.
- Confirmed Hono middleware order (logger → timeout → security headers → CORS → rate limiting) aligns with expectations.
- No new issues in this pass; sets baseline for later passes.

## Pass 2 – Rate Limiting & DoS Controls
- **F-01**: Both the waitlist route and the global middleware treat `X-Forwarded-For`, `X-Real-IP`, and `CF-Connecting-IP` as fully trustworthy. An attacker hitting the origin service directly can spoof unique header values per request, defeating rate limits and evading block counters.
- **F-02**: The in-memory fallback (`recent` map) keeps an ever-growing array of timestamps per spoofed IP and never prunes the map, so a script issuing requests with random IP strings can trigger unbounded memory growth.
- Recommendation: normalize to the first proxy-set IP when behind trusted reverse proxies, ignore spoofed headers otherwise, and add eviction/TTL logic or fall back to a bounded LRU store.

## Pass 3 – Payload Validation & Size Limits
- **F-03**: `/api/waitlist` accepts arbitrary JSON without body-size limits or per-field bounds. Attackers can post multi-megabyte payloads or thousands of interest strings, consuming memory and storage before Zod rejects anything.
- Recommendation: add a body size guard (e.g., Hono `bodyLimit` middleware), cap `interests` length, and enforce max string sizes prior to persistence.

## Pass 4 – Authentication Hardening
- **F-06**: Admin login compares the supplied password with `===`. While practical exploitation is hard due to network jitter, it is not constant-time. Switching to a constant-time comparison (e.g., `crypto.timingSafeEqual` against a hashed secret) removes the theoretical leak.
- Noted that authentication currently depends on a single shared secret; consider migrating to named accounts stored hashed in the database for better accountability.

## Pass 5 – Session & Token Handling
- Reviewed JWT creation and cookie settings. `SameSite=Strict`, `HttpOnly`, and `Secure` (in production) mitigate CSRF and XSS token theft.
- No additional defects in this pass, but add token revocation or rotation if multiple admins are introduced.

## Pass 6 – Frontend Dynamic Rendering (Blog)
- **F-04**: Related-posts markup is assembled with `innerHTML` and string interpolation for `post.title`, `post.description`, and `post.slug` without sanitisation. Malicious content from the API (or compromised CMS) can break out of attributes and run arbitrary JavaScript.
- Recommendation: sanitise related-post payloads (e.g., via DOMPurify) or build DOM nodes via `createElement` + `textContent`.

## Pass 7 – Frontend API Clients
- **F-05**: Both the admin shell (`window.adminAPI.baseURL`) and the public waitlist form default to `http://localhost:10000` when `PUBLIC_API_URL` / `PUBLIC_API_BASE_URL` are unset. If a production deployment forgets these env vars, browsers will downgrade to plaintext HTTP (mixed content blocked in HTTPS contexts, or credentials leak in HTTP-only deployments).
- Recommendation: fail closed by throwing when the env variable is missing, or detect non-localhost origins and refuse to call insecure defaults.

## Pass 8 – Email Pipeline & Output Encoding
- Reviewed `generateWaitlistWelcomeEmail`; inputs flow through Zod email validation and controlled templating.
- No injection vectors found here. Ensure Resend API keys stay in secret stores and monitor send failures for abuse signals.

## Pass 9 – Third-Party Services & Secrets
- Redis helper supports plaintext `redis://` URLs; enforce `rediss://` for hosted services to prevent credential sniffing over the network.
- Validate that environment validation (`validateEnv`) also checks optional secrets when related features are enabled to avoid silent misconfiguration.

## Pass 10 – Monitoring, Logging, and Residual Risk
- Current logging strips stack details in production, reducing inadvertent leakage.
- Recommend adding security telemetry (rate limit trips, admin login failures) with alerting, plus routine dependency vulnerability scans to catch future issues.
