# Current Onboarding Accounting Setup Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding accounting readiness checklist | NOT_FOUND | Spec `readiness/accounting.js` absent |
| Conversion accounting boundary | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/accountingBoundary.js` `assertNoTenantAccountingSideEffects` |
| CoA/period init on Tenant provision | REUSE_WITH_RECONCILIATION | `tenantProvision.js` may call `initializeNewTenantFinancialDefaults` — CoA/period only |
| Direct Journal / OB / stock / AR / AP / tax from onboarding | FORBIDDEN | Design hard rule |
| System CoA admin path | FORBIDDEN / REMOVE | System `/insightbooks/chart-of-accounts` stays removed; Tenant CoA remains functional |
| Tenant Quotation as onboarding accounting truth | WRONG_DOMAIN | — |

**Implication:** Wave 3 boundary assert helper mirrored from conversion; checklist + call approved services only — never post.
