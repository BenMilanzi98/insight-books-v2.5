# Tenant Action Matrix

| Action | Trigger | Present today | Risks | Class |
|--------|---------|---------------|-------|-------|
| Create Tenant | Admin / signup | `admin/tenants`, `tenant/add` | NON_IDEMPOTENT retry; status active early | FOUNDATION |
| Link existing Tenant | Conversion decision | NOT_FOUND | — | NOT_FOUND |
| Reserved slug block | Policy | NOT_FOUND | TENANT_DUPLICATION_RISK | NOT_FOUND |
| Isolation / security baseline | Post-create | Partial (roles seed) | CROSS_TENANT_RISK | FOUNDATION |
| CoA template init | On create | `initializeNewTenantFinancialDefaults` | ACCOUNTING_SIDE_EFFECT_RISK if journals | REUSE_WITH_RECONCILIATION |
| Journals / OB / AR / revenue | Forbidden from conversion | Not from close/handoff | — | FORBIDDEN |
| Demo Tenant provision | Demo env | `provisionDemoEnvironment` | Wrong plane | WRONG_DOMAIN |
