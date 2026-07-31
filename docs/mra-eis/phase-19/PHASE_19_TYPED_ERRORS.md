# Phase 19 Typed Errors

`MigrationErrors` → `MraEisControlError` codes: SOURCE_READ_ONLY, SOURCE_CHECKSUM, CROSS_TENANT, ENVIRONMENT, FISCAL_NUMBER_CONFLICT, CREDENTIAL_LEAK, DRY_RUN_REQUIRED, APPROVAL_REQUIRED, HISTORICAL_TRANSMISSION_BLOCKED, ROLLBACK_NOT_ALLOWED, HOOK_ISOLATION, etc.

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
