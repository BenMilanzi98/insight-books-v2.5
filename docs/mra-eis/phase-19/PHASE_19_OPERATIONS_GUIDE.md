# Phase 19 Operations Guide

Commands (memory/demo path):
- POST register-source / create-manifest / profile-dataset
- POST create-run + dry-run
- POST approve-run + migrate (non-Prod or approved Prod)
- POST rollback
- GET /api/mra-eis/migration?runId=

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
