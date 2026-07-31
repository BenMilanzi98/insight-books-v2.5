# Duplication Risk Register

**Audited:** 2026-07-28

| ID | Duplication | Severity | Recommendation |
|----|-------------|----------|----------------|
| DUP-01 | `AccountSubscription` vs `PlatformInvoice`/`PlatformPayment` for “revenue” | High | SaaS cash/revenue → Platform*; commercial access state → AccountSubscription |
| DUP-02 | Tenant `Invoice`/`Sale` vs Platform billing | Critical if conflated | Never use tenant sales as SaaS MRR |
| DUP-03 | Catalog plans in code (`subscriptionConfig`) vs `PlatformPlanVersion` | Medium | Prefer DB for published prices; code as fallback/features |
| DUP-04 | Multiple admin “dashboard” / overview pages | Medium | Consolidate under Executive Intelligence later; keep one KPI service |
| DUP-05 | MRA EIS entitlement vs EIS subscription SKU | Medium | Documented: subscription-first + entitlement unlock (choice A) — do not invent third gate |
| DUP-06 | Future Lead model vs Tenant/Client | High if confused | Leads are pre-tenant; Clients are TENANT_SCOPED customers |
| DUP-07 | Future SupportTicket vs PlatformSupportAccess | Medium | Different domains: tickets ≠ impersonation grants |
| DUP-08 | Competing AI “insights” without evidence store | Medium | Gate AI on verified metrics only |

## Zero-duplication rule for later phases

Before creating a Prisma model, Phase N must cite this register and prove no existing model covers the domain.
