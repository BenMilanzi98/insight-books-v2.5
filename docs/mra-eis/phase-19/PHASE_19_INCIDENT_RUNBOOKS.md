# Phase 19 Incident Runbooks

| Incident | Action |
|---|---|
| Historical transmit attempted | Block + Audit + CRITICAL alert |
| Credential in source row | BLOCKED_SECURITY + rotate/revoke |
| Checksum changed post Dry Run | Block migrate; re-profile |
| Duplicate fiscal# | Quarantine both; Manual Review |
| Cross-tenant | Block; security review |

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
