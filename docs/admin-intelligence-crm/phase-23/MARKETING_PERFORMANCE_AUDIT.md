# MARKETING PERFORMANCE AUDIT

**Date:** 2026-08-01  
**Audit method:** Codebase search (Prisma, `app/insightbooks/**`, `lib/admin/**`, permissions)

## Finding

N/A until high-volume touchpoints. Design server-side pagination/indexes now. Classification: FUTURE_PHASE_SCOPE for scale programme.

## Evidence paths (representative)

- `prisma/schema.prisma` — `CrmLead`, `CrmCaptureRecord`, `CrmOpportunity`, `Affiliate*`, `AnalyticsEvent`
- `app/insightbooks/crm/**` — CRM hub (no marketing)
- `app/insightbooks/affiliate*/**` — affiliate
- `app/insightbooks/intelligence/product-analytics/**` — product funnels
- `lib/admin/customerSuccess/training/paOutcomeHandoff.js` — forbids marketing attribution
- `docs/admin-intelligence-crm/phase-22/PHASE_23_INPUTS.md` — consume contract

## Classification

See finding. No fabricated Campaign/Touchpoint/Spend/Attribution data exists to migrate.
