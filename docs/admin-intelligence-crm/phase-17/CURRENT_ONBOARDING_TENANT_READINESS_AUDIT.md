# Current Onboarding Tenant Readiness Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding tenant readiness evaluator | NOT_FOUND | Spec `readiness/tenant.js` not present |
| Tenant provision from conversion | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/tenantProvision.js` |
| Isolation baseline | CORRECT_AND_REUSABLE | `conversions/isolation.js` |
| Silent identity repair from onboarding | FORBIDDEN | Design: evaluate readiness; do not silently repair |
| Cross-tenant project access | CROSS_TENANT_RISK | `resolveCrmScope` stub `mode: 'all'` in `lib/admin/crm/authz.js`; CS portfolio scoping exists in `customerSuccess/authz.js` — EXTEND for onboarding |
| Tenant readiness UNKNOWN ≠ READY | GO_LIVE_TRUTH_RISK if ignored | Wave 3 must enforce |

**Implication:** Wave 3 evaluate readiness against accepted scope; reuse provisioned Tenant as input truth.
