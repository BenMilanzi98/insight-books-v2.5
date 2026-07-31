# Phase 19 Deployment Plan

1. Deploy code + run `prisma migrate deploy` (20260723100000)
2. Grant Phase 19 permissions
3. Register read-only sources (Sandbox first)
4. Profile + Dry Run + approve
5. Production only with backupVerified + platform approveProduction
6. Verify recon + no Outbox transmission Events

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
