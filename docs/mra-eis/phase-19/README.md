# Phase 19 — Existing Data Assessment & Controlled Migration

**Decision:** `READY_FOR_PHASE_20_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/migration/`
- API: `/api/mra-eis/migration`
- UI: `/settings/integrations/mra-eis/migration`
- Admin Centre section: Data Migration
- Prisma: `MraEisMigrationSourceSystem`, `MraEisMigrationRun`, `MraEisMigrationRecord`
- Migration SQL: `prisma/migrations/20260723100000_mra_eis_phase19_migration`
- Tests: `test/mraEis.phase19.migration.test.js`

## Hard rules
- Source access is read-only and checksummed
- No default Tenant / Business fallback
- Receipt / local status ≠ acceptance
- No fabricate MRA IDs, Response Evidence, or QR
- No historical transmit / offline upload
- No Journal / Stock Movement from migration
- Additive historical evidence + lineage only
- Production requires approved Dry Run checksum + backup

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
