# Current Marketing Architecture Audit

**Date:** 2026-08-01

## Finding

There is **no** Marketing Attribution platform in the application today.

- Routes: `app/insightbooks/marketing/**` → **0 files**
- Prisma: no `MarketingCampaign`, `MarketingTouchpoint`, `MarketingVisitor`, `MarketingSession`, `Attribution*`, `MarketingSpend*` models
- Permissions: no `systemAdmin.marketing.*` keys found in `lib/permissionsMap.js`

## Adjacent planes (do not merge blindly)

1. **CRM Lead Capture** — `CrmLead.source`, `channel`, `CrmCaptureRecord`
2. **Affiliate** — `Affiliate`, `AffiliateReferral`
3. **Product Analytics** — `/insightbooks/intelligence/product-analytics`
4. **Training** — forbids marketing attribution
5. **GL marketing expense** — accounting only

## Classification

| Component | Class |
|-----------|-------|
| Missing marketing hub | CREATE as sole canonical |
| CRM lead source | EXTEND / REUSE_WITH_RECONCILIATION |
| Affiliate | DISCONNECTED (keep SoT) |
| Product funnels | WRONG_DOMAIN |
