# Migration Decision Engine

`evaluateMigrationCandidate` — default QUARANTINE. Decisions include MIGRATE_AS_HISTORICAL_READ_ONLY, LINK_TO_EXISTING_CANONICAL_RECORD, BLOCKED_* .

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
