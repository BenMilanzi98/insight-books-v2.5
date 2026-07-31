# Phase 19 Gap Register

| ID | Gap | Severity | Status |
|---|---|---|---|
| G19-001 | Live Production customer DB read-only extraction not executed in this workspace | HIGH | BLOCKED (ops) |
| G19-002 | Durable worker queue persistence for multi-replica Production migrate | MEDIUM | PARTIAL (in-memory + schema) |
| G19-003 | Full Prisma write-path for every Run/Record (tests use memory) | MEDIUM | PARTIAL |
| G19-004 | Exhaustive table-by-table SOURCE_SCHEMA for every legacy dump on disk | MEDIUM | Framework ready; dumps require operator registration |
| G19-005 | Carry-forward Phase 13–18 MRA contract / sandbox blockers | HIGH | Carry-forward |
| G19-006 | Scheduled migration maintenance windows + pager alerts wiring | LOW | Structure via typed errors/metrics docs |
| G19-007 | Complete XLSX macro scanner vs antivirus integration | MEDIUM | Formula injection + path traversal blocked in policy |

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
