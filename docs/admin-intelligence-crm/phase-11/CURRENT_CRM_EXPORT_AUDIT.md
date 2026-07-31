# Current CRM Export Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM Lead/Contact export API | NOT_FOUND | — |
| Export audit trail | NOT_FOUND | — |
| Formula-injection prevention | READY (reuse) | `exportSafety.preventFormulaInjection` from prior phases |
| Permission `systemAdmin.crm.*.export` | NOT_FOUND | Scaffold has leads/pipeline keys only; no export key yet |
| Support export as CRM export | WRONG_DOMAIN | `systemAdmin.support.export` |
| PII export without consent check | BLOCKED (future) | Must gate when export ships |

**Implication:** Wave 4 export foundations reuse exportSafety; add CRM-specific authz + audit. Never export Tenant GL / payment secrets.
