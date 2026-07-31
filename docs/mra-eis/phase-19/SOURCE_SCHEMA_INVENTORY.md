# Source Schema Inventory

Framework inventories columns from extracted rows. Do not assume same field names share semantics across LEGACY_EFD vs LEGACY_EIS vs current InsightBooks.

Primary discovery targets: EISInvoice, EISSubmissionLog, Terminal metadata, fiscal numbers, receipt artifacts, offline queues, Journals, Stock Movements (link-only).

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
