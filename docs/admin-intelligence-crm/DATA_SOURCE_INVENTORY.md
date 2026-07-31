# Data Source Inventory

**Audited:** 2026-07-28  
**Rule:** Operational systems remain authoritative; analytics may only derive.

## Scope tags

`PLATFORM_GLOBAL` · `TENANT_SCOPED` · `BUSINESS_SCOPED` · `USER_SCOPED` · `SECURITY_RESTRICTED` · `SALES_TEAM_SCOPED` (future)

## Authoritative sources (confirmed)

| Domain | Source of truth | Scope | Consumer notes |
|--------|-----------------|-------|----------------|
| Platform admins | `Admin` | PLATFORM_GLOBAL | Admin JWT |
| Admin actions | `AdminAuditLog` | PLATFORM_GLOBAL | Audit UI |
| Tenants | `Tenant` | TENANT_SCOPED | Tenant management |
| Tenant users | `User` + `Role` | TENANT_SCOPED / USER_SCOPED | User management |
| SaaS subscription commercial state | `AccountSubscription` | TENANT_SCOPED | Access + EIS SKU coexistence |
| SaaS cash (self-serve) | `AccountSubscription` / `BranchSubscription` + `PlatformPayment` | TENANT_SCOPED | Live cash path; PayChangu writes linked ledger |
| SaaS invoices/payments (admin ledger) | `PlatformInvoice`, `PlatformPayment`, credits, refunds | TENANT_SCOPED | Auto-created on PayChangu; historical gaps repaired via backfill |
| Plan catalogue | `PlatformPlanVersion` (+ `subscriptionConfig` charge path) | PLATFORM_GLOBAL | Storefront DB price vs checkout catalog price can **DISCONNECT** |
| Feature flags | `PlatformFeatureEntitlement` | PLATFORM / TENANT | Feature entitlements UI |
| MRA EIS entitlement | `MraEisTenantEntitlement` (+ ops tables) | TENANT_SCOPED | Compliance — not revenue |
| Affiliates | `Affiliate*` | PLATFORM_GLOBAL | Partner channel |
| Support access | `PlatformSupportAccess` | TENANT_SCOPED + SECURITY_RESTRICTED | Impersonation grants |
| Email templates | `PlatformEmail*` | PLATFORM_GLOBAL | Comms |
| Tenant sales/expenses/invoices | `Sale`, `Expense`, `Invoice`, … | TENANT_SCOPED | **Tenant business activity only** |

## Unsafe / incorrect as SaaS BI sources

| Source | Why unsafe |
|--------|------------|
| `prisma.sale.aggregate` in `/api/admin/dashboard/stats` | Aggregates all Tenant sales as “revenue” |
| Tenant `Expense` aggregates as platform costs | Not InsightBooks opex |
| Tenant GL | Wrong plane |

## Missing sources (instrumentation required)

| Need | Status |
|------|--------|
| Lead / CRM entities | NOT_FOUND |
| Product AnalyticsEvent stream | NOT_FOUND |
| Customer health scores | NOT_FOUND |
| Support tickets | NOT_FOUND |
| Marketing attribution | NOT_FOUND |
| Canonical churn reasons | NOT_FOUND |

## Derived / read-model strategy (target — not built)

| Read model | Built from | Must not replace |
|------------|------------|------------------|
| Daily SaaS revenue snapshot | PlatformPayment allocations | PlatformPayment rows |
| Tenant activity daily | future AnalyticsEvent / login audits | Tenant transactional tables |
| Lead funnel daily | future Lead stage history | Lead rows |
