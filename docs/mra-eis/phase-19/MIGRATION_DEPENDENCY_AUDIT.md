# Migration Dependency Audit

| Mechanism | Path / area | Classification |
|---|---|---|
| Prisma MRA EIS tables Phases 4–17 | `prisma/schema.prisma` | REUSE |
| `EISInvoice` / `EISConfiguration` / `EISSubmissionLog` | legacy models | LEGACY_READ_ONLY / discovery source |
| Phase 4/5 dry-run scripts | `scripts/` (where present) | EXTEND into assessor |
| `MraEisManualReviewCase` | domain | REUSE / WRAP |
| Phase 18 Admin Centre | `application/admin` | EXTEND (Migration section) |
| `lib/eisService.js` submit/status | legacy EIS | UNSAFE_HISTORICAL_TRANSMISSION — never call from migration |
| Sale finalization / Invoice issue | POS/Invoice services | UNSAFE_FINANCIAL_REPLAY — hook-isolated |
| Accounting posting / Stock posting | journals / inventory | UNSAFE_FINANCIAL_REPLAY / UNSAFE_INVENTORY_REPLAY |
| Seed / one-off SQL without lineage | ad-hoc scripts | UNSAFE_NO_LINEAGE / DEPRECATE for Production |
| Default tenant assignment patterns | any migration write | UNSAFE_DEFAULT_TENANT — removed for Phase 19 |
| Plaintext credential copy | forbidden | UNSAFE_PLAINTEXT_SECRET |
| Blind dump restore over Production | ops | UNSAFE_DIRECT_UPDATE — blocked |

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
