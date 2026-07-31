# Multi-Tenant and Business Hierarchy

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## Answers

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Tenant = Business? | **Yes** | No Business model; accountingContext aliases |
| 2 | Multiple Businesses per tenant? | **No** | One Tenant row |
| 3 | Multiple branches? | **Yes** | Branch.tenantId |
| 4 | Shared warehouses? | Local InventoryLocation tenant-scoped; no Warehouse model |
| 5–6 | Multi-business users / switch? | **Yes** via TenantMembership + /api/tenant/switch |
| 7–8 | Context storage / server verify? | Session cookie tenantId; APIs filter by user.tenantId; V2 blocks foreign businessId |
| 9–11 | Jobs/exports/cache? | Crons use CRON_SECRET; Business Context in workers uneven — GAP |
| 12–13 | System admin / impersonation? | Admin panel separate; SecV2 may have impersonation fields — review |
| 14 | TIN location? | Tenant.tpin |
| 15–17 | Entitlement / ops / credentials? | Subscription + eisEnabled; EISConfiguration per tenant |
| 18 | Multiple TINs per tenant? | Not modeled |
| 19–20 | Multiple sites / tills? | Branches exist; terminal model incomplete |

## Cross-tenant risks

- Tenant switch unsigned session downgrade (**BLOCKER**).
- EIS settings JSON secrets.
- Cache keys must always include tenantId.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
