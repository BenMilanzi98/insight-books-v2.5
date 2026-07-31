# Current CRM Import Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM Lead / Contact / Account import | NOT_FOUND | — |
| Import job / staging tables | NOT_FOUND | — |
| Validation + dry-run | NOT_FOUND | — |
| Consent required on imported rows | NOT_FOUND | — |
| Tenant client CSV import as CRM | WRONG_DOMAIN | If present, tenant data plane |
| Fabricated seed Leads | FORBIDDEN | Must not invent |

**Implication:** Wave 4 import **foundations** (contracts/stubs). Full importer deferred — exit with blockers, no fake import success metrics.
