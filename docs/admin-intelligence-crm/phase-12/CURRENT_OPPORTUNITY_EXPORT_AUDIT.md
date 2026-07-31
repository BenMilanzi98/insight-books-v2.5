# Current Opportunity Export Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity export API | NOT_FOUND | — |
| CRM export foundation | PARTIAL / READY pattern | `lib/admin/crm/export.js` + `CrmExportAudit` — Lead/CRM JSON/CSV |
| Formula injection safety | CORRECT_AND_REUSABLE | `exportSafety.preventFormulaInjection` |
| Empty export ≠ invent rows | FORBIDDEN to invent | Preserve honesty |
| Export permissions | PARTIAL | CRM export keys Phase 11 — extend for Opportunity |

**Implication:** Wave 4 Opportunity export reuses safety + audit patterns; recheck permission on download.
