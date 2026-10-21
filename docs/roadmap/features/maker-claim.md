# 08 — Maker claim (P1)

Goal: makers own their profiles with zero third-party verification.
Stolen from: PH claimed badge, TrustMRR claim-via-API-key (adapt: claim via
DNS, our method), BetaList dashboard.

## Constraints honored
C2 (DNS + email + manual review only), C4 (no new badge states), C5.

## Research before build
- [x] PH maker-claim + verification UX
- [x] TrustMRR claim-existing-profile flow (adapt API-key → DNS token)
- [x] Our `verify/index.astro` methods — reuse token format

## Research findings
Research finding (2026-10-08): Product Hunt claim flow: request from My
Products or the product page (More → Claim this page); a company email
matching the product domain claims instantly after email verification; a
mismatched email goes to moderation, usually reviewed in under 24 hours;
pages with an existing owner use invites or a request-access approval in
Page settings. Confirms our claim design (domain-matched email = fast
path, everything else = manual review queue) and supports a sub-48h SLA
promise.
— Source: https://help.producthunt.com/en/articles/6684701-how-do-i-claim-my-product-page
Research finding (2026-10-08): TrustMRR claim mechanism: adding or claiming
a startup requires connecting a read-only (or scoped) API key from a
supported payment provider; revenue is verified through it and the profile
is created or claimed, with add-ons going to Stripe checkout afterwards.
This is exactly the "claim via a secret you control" pattern we adapt: our
equivalent secret is the DNS/file/meta token, no third parties involved.
— Source: https://trustmrr.com/faq
Research finding (2026-10-08, codebase): our own methods are final and
consistent: token format `whyknot-verify=YOUR_TOKEN` across all three
methods (DNS TXT at host `@`, file at `/whyknot-verify-YOUR_TOKEN.html`
with redirects not followed, meta tag `whyknot-verify` on the logged-out
homepage), six badge states (pending, verified, stale, expired, failed,
unverified), continuous rechecks with every transition in the audit log,
and the claim page already reuses the same three methods plus owner email
with a 48-hour manual review note (frontend/src/pages/verify/index.astro).
Token format is safe to reuse for claims unchanged.
— Source: frontend/src/pages/verify/index.astro (local code)

## Build spec
- Claim: same 3 methods as verify (DNS TXT / file / meta) + owner email.
- Manual review queue with SLA published (e.g. 48h).
- Dashboard: edit listing, view clicks/UTM, unanswered comments, invoices.

## Metrics
- Claim rate · median review time · edit frequency.

## Acceptance
- [ ] Claim completes without staff code changes
- [ ] Unclaimed profiles clearly marked as editor-maintained

## Open questions (owner)
- Review SLA promise? (suggest 48h — confirm staffing)
