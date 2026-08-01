# CURRENT CHANNEL SOURCE MEDIUM AUDIT

**Date:** 2026-08-01  
**Audit method:** Codebase search (Prisma, `app/insightbooks/**`, `lib/admin/**`, permissions)

## Finding

CRM Lead uses free-text `source` + `channel` (default `ADMIN_MANUAL`). No governed catalogues or normalisation rule versions. Classification: STANDARDISE via new taxonomy; preserve raw CRM values.

## Evidence paths (representative)

- `prisma/schema.prisma` — `CrmLead`, `CrmCaptureRecord`, `CrmOpportunity`, `Affiliate*`, `AnalyticsEvent`
- `app/insightbooks/crm/**` — CRM hub (no marketing)
- `app/insightbooks/affiliate*/**` — affiliate
- `app/insightbooks/intelligence/product-analytics/**` — product funnels
- `lib/admin/customerSuccess/training/paOutcomeHandoff.js` — forbids marketing attribution
- `docs/admin-intelligence-crm/phase-22/PHASE_23_INPUTS.md` — consume contract

## Classification

See finding. No fabricated Campaign/Touchpoint/Spend/Attribution data exists to migrate.
