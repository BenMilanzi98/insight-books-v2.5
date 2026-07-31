# Phase 8 Input Validation

**Date:** 2026-07-28  
**Source readiness:** Phase 7 `READY_FOR_PHASE_8_WITH_BLOCKERS`

## Required inputs present

| Input | Evidence | Status |
|-------|----------|--------|
| Canonical Customer = Tenant | `phase-07/CANONICAL_CUSTOMER_DEFINITION.md` | PASS |
| Customer 360 builder | `lib/admin/customers/customer360.js` | PASS |
| Commercial summary (platform billing) | `lib/admin/customers/commercial.js` | PASS_WITH_LIMITATIONS |
| Engagement login proxy | `lib/admin/customers/engagement.js` | PASS_WITH_LIMITATIONS |
| MRA EIS entitlement | `lib/admin/customers/mraEis.js` | PASS_WITH_LIMITATIONS |
| Portfolios / ownership / scope | `portfolios.js`, `portfolioScope.js`, Prisma models | PASS |
| Deterministic signals | `signals.js`, `signalCatalogue.js` (`customer-signals-2026-07-28`) | PASS |
| Metric envelopes | `lib/admin/intelligence/metricStates.js` | PASS |
| Authz pattern | `lib/admin/customers/authz.js`, `authorizeAdminDecision` | PASS |
| Phase 8 inputs pack | `phase-07/PHASE_08_INPUTS.md` | PASS |

## Blockers carried in (must not invent around)

| Blocker | Class | Phase 8 treatment |
|---------|-------|-------------------|
| FEATURE_USED / adoption | UNAVAILABLE | Health dim NOT_APPLICABLE; never score 0 |
| Unique-user DAU/WAU/MAU | UNAVAILABLE | Not a health dim in v1 |
| SupportTicket | NOT_INSTRUMENTED | Service dim N/A; no support-driven cases |
| Onboarding / training CS models | NOT_INSTRUMENTED | Source-gated foundations only |
| Opaque / ML health | FORBIDDEN | Explainable definition only |

## Decision for Wave 1 entry

**CONDITIONAL GO** — enough verified sources for a four-dimension renormalising health engine + CS case/renewal foundations. Adoption/support/onboarding remain blockers for full health coverage and full CS maturity (expected WITH_BLOCKERS exit).
