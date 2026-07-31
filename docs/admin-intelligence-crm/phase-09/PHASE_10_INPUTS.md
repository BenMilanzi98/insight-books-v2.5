# Phase 10 Inputs (from Phase 9)

| Asset | Path / surface |
|-------|----------------|
| Product catalogue | `lib/admin/productCatalogue/*` (`PRODUCT_CATALOGUE_VERSION`) |
| Product analytics core | `lib/admin/productAnalytics/*` (`product-analytics-2026-07-29`) |
| Producers (Invoice / POS / EIS accept) | `producers.js` + call-sites (invoice post, POS complete, MRA online/offline/reconcile accept) |
| Usage facts / first-value / adoption | `facts.js`, `firstValue.js`, `repeatValue.js`, `activation.js`, `adoption.js` |
| Funnels / cohorts / signals / recon / export | `funnels.js`, `cohorts.js`, `signals.js`, `reconcile.js`, `export.js` |
| Reliability gate | `reliabilityGate.js` — `NOT_INSTRUMENTED` never numeric 0 |
| Authz | `authz.js` — read / export / recon / manageDefinitions / acknowledgeSignals / viewUserLevel |
| Workbench UI | `/insightbooks/intelligence/product-analytics/*` |
| APIs | `/api/admin/intelligence/product-analytics/*` |
| Prisma models | `AnalyticsFactProductUsage`, `ProductFirstValueFact`, `ProductAdoptionStateHistory` |
| Matrices / audits | `docs/admin-intelligence-crm/phase-09/*` (FUNNEL_MATRIX, gap register, etc.) |
| Final Phase 9 | `FINAL_PHASE_09_REPORT.md` — **READY_FOR_PHASE_10_WITH_BLOCKERS** |

**Reuse from earlier phases:** Phase 4 AnalyticsEvent / outbox / facts; Phase 7 portfolio scope; Phase 8 Health/CS (do not invent adoption from health); metric envelopes; `exportSafety.preventFormulaInjection`.

**Do not consume as truth:** Tenant Sale; login/page-view as product value; domain table counts without producers; Android product usage (absent); support tickets as product signals; invented probability/revenue; zero-filled missing funnel/cohort periods.
