# CURRENT MARKETING SPEND AUDIT

**Date:** 2026-08-01  
**Audit method:** Codebase search (Prisma, `app/insightbooks/**`, `lib/admin/**`, permissions)

## Finding

No Marketing Spend Fact. GL marketing expenses must not auto-post from analytics. Classification: CREATE analytics spend; GL is WRONG_DOMAIN.

## Evidence paths (representative)

- `prisma/schema.prisma` — `CrmLead`, `CrmCaptureRecord`, `CrmOpportunity`, `Affiliate*`, `AnalyticsEvent`
- `app/insightbooks/crm/**` — CRM hub (no marketing)
- `app/insightbooks/affiliate*/**` — affiliate
- `app/insightbooks/intelligence/product-analytics/**` — product funnels
- `lib/admin/customerSuccess/training/paOutcomeHandoff.js` — forbids marketing attribution
- `docs/admin-intelligence-crm/phase-22/PHASE_23_INPUTS.md` — consume contract

## Classification

See finding. No fabricated Campaign/Touchpoint/Spend/Attribution data exists to migrate.
