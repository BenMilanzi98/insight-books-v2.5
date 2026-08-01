# MARKETING PRIVACY AUDIT

**Date:** 2026-08-01  
**Audit method:** Codebase search (Prisma, `app/insightbooks/**`, `lib/admin/**`, permissions)

## Finding

No visitor PII plane yet. Training omits marketingConsent from projections — good boundary. Design safe URL policy before capture. Classification: CREATE privacy-first.

## Evidence paths (representative)

- `prisma/schema.prisma` — `CrmLead`, `CrmCaptureRecord`, `CrmOpportunity`, `Affiliate*`, `AnalyticsEvent`
- `app/insightbooks/crm/**` — CRM hub (no marketing)
- `app/insightbooks/affiliate*/**` — affiliate
- `app/insightbooks/intelligence/product-analytics/**` — product funnels
- `lib/admin/customerSuccess/training/paOutcomeHandoff.js` — forbids marketing attribution
- `docs/admin-intelligence-crm/phase-22/PHASE_23_INPUTS.md` — consume contract

## Classification

See finding. No fabricated Campaign/Touchpoint/Spend/Attribution data exists to migrate.
