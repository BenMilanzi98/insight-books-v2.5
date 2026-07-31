# Phase 6 Inputs (from Phase 5)

| Asset | Path / surface |
|-------|----------------|
| Executive KPI pack | `lib/admin/intelligence/executiveKpiPack.js` |
| Metric envelopes | `lib/admin/intelligence/metricStates.js` |
| KPI catalogue (MRR/ARR estimated) | `lib/admin/intelligence/kpiCatalogue.js` |
| SaaS billing KPIs | `lib/admin/saasBillingKpis.js` |
| Executive APIs | `/api/admin/intelligence/executive/overview`, `export` |
| Executive UI | `/insightbooks/intelligence/executive/*` |
| AuthZ decision service | `lib/admin/authorization/` |
| Permission scaffold | `SYSTEM_ADMIN_PERMISSIONS.intel.*` |
| Analytics plane | `lib/admin/analytics/*`, `Analytics*` Prisma models |
| Payment recon | `reconcilePlatformPayments` |
| Platform ledger | `PlatformInvoice`, `PlatformPayment`, `PlatformCredit`, `PlatformRefund` |
| Subscriptions | `AccountSubscription`, `PlatformPlanVersion` |
| Phase 5 final | `FINAL_PHASE_05_REPORT.md` — CONDITIONAL GO; estimated MRR/ARR only |

**Do not consume:** `/api/admin/analytics` Tenant Sale aggregates; tenant GL; EIS fiscal `EISInvoice` as SaaS revenue.
