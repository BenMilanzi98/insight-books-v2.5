# Source System Registry

Implemented in `lib/mraEis/application/migration/sourceSystemRegistry.js` and `MraEisMigrationSourceSystem`.

Types: CURRENT/LEGACY InsightBooks, LEGACY_EFD/EIS, dumps, CSV/XLSX/JSON packages, receipt/log archives, offline agent DB.

Registration requires `readOnlyVerified: true`. Credential fields must be opaque Secret Provider references (no `password=` embeds).

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
