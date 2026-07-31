# Current Activity Export Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Activity export dataset | NOT_FOUND | `buildCrmExportPack` datasets = `leads` only |
| Export audit model | FOUNDATION | `CrmExportAudit` — reusable pattern for Activity exports later |
| Restricted notes in export | CORRECT_AND_REUSABLE (policy) | Must never default-export RESTRICTED note bodies |
| Formula injection safety | CORRECT_AND_REUSABLE | `preventFormulaInjection` used in export.js |
| XLSX/PDF Activity packs | NOT_FOUND / deferred | Lead export forbids XLSX/PDF — keep same for Activity unless explicitly approved |

**Implication:** Wave 4 may add Activity export with permission recheck + restricted-body exclusion; no Tenant GL/payment secrets.

