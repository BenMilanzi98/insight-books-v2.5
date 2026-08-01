# CURRENT UTM CAPTURE AUDIT

**Date:** 2026-08-01  
**Audit method:** Codebase search (Prisma, `app/insightbooks/**`, `lib/admin/**`, permissions)

## Finding

No `utm_source` / `utmSource` fields in Prisma; no marketing UTM capture service. Classification: NOT_APPLICABLE (to create); ad hoc payload Json may hold raw values.

## Evidence paths (representative)

- `prisma/schema.prisma` — `CrmLead`, `CrmCaptureRecord`, `CrmOpportunity`, `Affiliate*`, `AnalyticsEvent`
- `app/insightbooks/crm/**` — CRM hub (no marketing)
- `app/insightbooks/affiliate*/**` — affiliate
- `app/insightbooks/intelligence/product-analytics/**` — product funnels
- `lib/admin/customerSuccess/training/paOutcomeHandoff.js` — forbids marketing attribution
- `docs/admin-intelligence-crm/phase-22/PHASE_23_INPUTS.md` — consume contract

## Classification

See finding. No fabricated Campaign/Touchpoint/Spend/Attribution data exists to migrate.
