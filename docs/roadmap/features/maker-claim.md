# 08 — Maker claim (P1)

Goal: makers own their profiles with zero third-party verification.
Stolen from: PH claimed badge, TrustMRR claim-via-API-key (adapt: claim via
DNS, our method), BetaList dashboard.

## Constraints honored
C2 (DNS + email + manual review only), C4 (no new badge states), C5.

## Research before build
- [ ] PH maker-claim + verification UX
- [ ] TrustMRR claim-existing-profile flow (adapt API-key → DNS token)
- [ ] Our `verify/index.astro` methods — reuse token format

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
