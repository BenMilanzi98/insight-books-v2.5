# Current Tenant Provisioning Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Tenant model | CORRECT_AND_REUSABLE foundation | `prisma` `Tenant` — subdomain unique; status default `active` |
| Admin Tenant create | FOUNDATION / REUSE_WITH_RECONCILIATION | `POST app/api/admin/tenants/route.js` |
| Subdomain uniqueness | FOUNDATION | Collision suffix loop — TENANT_DUPLICATION_RISK without reserved-slug policy |
| Status before activation policy | PARTIAL_CONVERSION_RISK | Creates with `status: 'active'` immediately |
| Trial AccountSubscription side-create | SUBSCRIPTION_DUPLICATION_RISK / FOUNDATION | Always creates trial (`isActive: false`) |
| Financial defaults | REUSE_WITH_RECONCILIATION / ACCOUNTING_SIDE_EFFECT_RISK | `initializeNewTenantFinancialDefaults` — CoA/period only; forbid journals from conversion |
| Tenant lifecycle helpers | FOUNDATION | `lib/admin/tenantLifecycle.js` |
| Conversion CREATE_OR_LINK_TENANT | NOT_FOUND | — |
| Demo environment provision | WRONG_DOMAIN | `provisionDemoEnvironment` |
| Isolation baseline step | NOT_FOUND | — |

**Implication:** Orchestrator wraps provisioners with create-vs-link, reserved slugs, activation gating, accounting boundary asserts.
