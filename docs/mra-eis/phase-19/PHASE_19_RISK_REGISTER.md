# Phase 19 Risk Register

| Risk | Mitigation |
|---|---|
| Bulk copy scripts reused | Dependency audit + DEPRECATE |
| Env mix | Classification + blockers |
| Financial replay | Hook isolation |
| Secret leakage | detectCredentialLeak + API bans |
| Irreversible Production import | Dry Run + backup + rollback |

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
