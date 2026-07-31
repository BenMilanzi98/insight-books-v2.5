# Current Opportunity Task Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity-scoped tasks | NOT_FOUND | `CrmTask` exists for CRM Lead/activity plane — no Opportunity FK |
| Lead tasks reuse without bridge | PARTIAL | May remain Lead-scoped until Opportunity task model |
| Sales sequences / cadences | NOT_FOUND / FORBIDDEN invent | Phase 11 tasks: TODO → COMPLETED only |
| Support tasks as Opportunity tasks | WRONG_DOMAIN | — |

**Implication:** Wave 3 Opportunity tasks (or explicit Lead→Opportunity task bridge). Do not auto-clone Lead tasks without audit trail.
