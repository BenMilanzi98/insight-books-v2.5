# Current Plan Pricing Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| PlatformPlanVersion | CORRECT_AND_REUSABLE (billing) / REUSE_WITH_RECONCILIATION (CRM) | `prisma` `PlatformPlanVersion` — versioned `basePrice`, currency, CORE/MRA_EIS, publish lifecycle |
| platformBilling plan versioning | CORRECT_AND_REUSABLE | `lib/admin/platformBilling.js` — price changes force new version |
| publicPlans storefront | CORRECT_AND_REUSABLE | `lib/admin/publicPlans.js` |
| subscriptionConfig hardcoded | WRONG_SOURCE | `lib/subscriptionConfig.js` MWK CORE/EIS defaults |
| CRM plan line on Quotation | NOT_FOUND | Opp products do not call `getSubscriptionPlan` / PlatformPlanVersion |
| MRA EIS plan entitlement as quote | WRONG_DOMAIN / FORBIDDEN | Fiscal/sandbox entitlements ≠ commercial Price Book |

**Implication:** CRM Price Book entries may pin PlatformPlanVersion IDs. Issued documents retain historical entry snapshots — never reprice from current plan.
