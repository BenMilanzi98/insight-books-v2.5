# Phase 8 Inputs (from Phase 7)

| Asset | Path / surface |
|-------|----------------|
| Customer 360 builder | `lib/admin/customers/customer360.js` |
| Lifecycle rules | `lib/admin/customers/lifecycle.js` (`customer-lifecycle-2026-07-28`) |
| Directory / overview | `directory.js`, `overviewPack.js` |
| Portfolios / ownership | `portfolios.js`, `portfolioScope.js`, Prisma `CustomerPortfolio` / `CustomerOwnership` |
| Segments (system) | `segments.js` — unassigned, renewals due |
| Signals engine | `signals.js`, `signalCatalogue.js` (`customer-signals-2026-07-28`) |
| Attention queue API | `GET .../customers/signals` |
| Signal state API | `POST .../customers/signals/[id]` |
| Light reconciliation | `reconciliation.js` / `GET .../customers/reconciliation` |
| Export foundation | `export.js` / `GET .../customers/export` |
| Canonical definition | `CANONICAL_CUSTOMER_DEFINITION.md` |
| Source readiness matrix | `CUSTOMER_SOURCE_READINESS_MATRIX.md` |
| 360 contract | `CUSTOMER_360_RESPONSE_CONTRACT.md` |
| Final Phase 7 | `FINAL_PHASE_07_REPORT.md` — READY_FOR_PHASE_8_WITH_BLOCKERS |

**Reuse from earlier phases:** metric envelopes, Phase 6 revenue helpers (commercial), authz / `authorizeAdminDecision`, Admin audit log.

**Do not consume:** Tenant Sale; opaque health / churn probability; invented adoption rates; support escalations without instrumentation.
