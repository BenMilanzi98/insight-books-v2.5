# Record-Level Migration Manifest

`MraEisMigrationRecord` lineageKey = hash(sourceSystemId|entity|recordId|checksum|transform|env). Unique constraint prevents duplicate imports.

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
