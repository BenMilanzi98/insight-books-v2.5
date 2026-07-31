# Current Opportunity Import Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity bulk import | NOT_FOUND | — |
| CRM import foundation | FOUNDATION | `foundations.js` IMPORT — no fake success rates |
| Lead import as Opportunity import | WRONG_DOMAIN | — |
| Invented import success % | FORBIDDEN | Phase 11 honesty gate — preserve |
| Idempotent import keys | NOT_FOUND | Wave 4 requirement |

**Implication:** Wave 4 Opportunity import in-phase with idempotency + honesty; foundations contract upgrades from FOUNDATION when shipped.
